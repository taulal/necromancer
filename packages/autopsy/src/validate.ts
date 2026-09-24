/**
 * Step 3 — deterministic validate + Schema.compile check (docs/batch-3.md NEC-09).
 */
import {BONES} from '@necro/bones'
import {Schema} from '@sanity/schema'
import {groupProblems, validateSchema} from '@sanity/schema/_internal'
import type {Corpse} from './corpse'
import {compileToSchemaJson} from './compile'
import type {ProposedType} from './proposal'

export const RESERVED_TYPE_NAMES = new Set(['type', 'id', 'document', 'image'])

const CAMEL_CASE = /^[a-z][a-zA-Z0-9]*$/

export type ValidateResult = {
  types: ProposedType[]
  errors: string[]
}

function pageTextById(corpse: Corpse): Map<string, string> {
  const map = new Map<string, string>()
  for (const page of corpse.pages) {
    const parts = [page.title ?? '', ...page.sections.map((s) => s.text), ...corpse.chrome]
    map.set(page.pageId, parts.join('\n'))
  }
  return map
}

function ensurePageAndSiteSettings(types: ProposedType[]): ProposedType[] {
  const names = new Set(types.map((t) => t.name))
  const out = [...types]

  if (!names.has('page')) {
    out.push({
      name: 'page',
      title: 'Page',
      kind: 'document',
      bonesMatch: null,
      fields: [
        {name: 'title', type: 'string', required: true, evidenceCount: 0},
        {name: 'slug', type: 'slug', required: true, evidenceCount: 0},
        {
          name: 'body',
          type: 'array',
          of: [...BONES],
          evidenceCount: 0,
        },
      ],
      rationale: 'Default routable page document (injected — model omitted it).',
      evidence: [],
      confidence: 0.4,
      decision: 'keep',
    })
  }

  if (!names.has('siteSettings')) {
    out.push({
      name: 'siteSettings',
      title: 'Site settings',
      kind: 'singleton',
      bonesMatch: null,
      fields: [
        {name: 'siteTitle', type: 'string', evidenceCount: 0},
        {name: 'phone', type: 'string', evidenceCount: 0},
        {name: 'email', type: 'string', evidenceCount: 0},
      ],
      rationale: 'Singleton for site-wide facts (injected — model omitted it).',
      evidence: [],
      confidence: 0.4,
      decision: 'keep',
    })
  }

  return out
}

function filterEvidence(types: ProposedType[], corpse: Corpse): ProposedType[] {
  const texts = pageTextById(corpse)
  return types.map((type) => {
    const kept = type.evidence.filter((ev) => {
      const haystack = texts.get(ev.pageId) ?? ''
      return ev.excerpt.length > 0 && haystack.includes(ev.excerpt)
    })
    let confidence = type.confidence
    if (type.evidence.length > 0 && kept.length === 0) {
      confidence = Math.max(0, confidence - 0.2)
    }
    return {...type, evidence: kept, confidence}
  })
}

function collectNameErrors(types: ProposedType[]): string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const type of types) {
    if (!CAMEL_CASE.test(type.name)) {
      errors.push(`Type name "${type.name}" is not camelCase`)
    }
    if (RESERVED_TYPE_NAMES.has(type.name)) {
      errors.push(`Type name "${type.name}" is reserved`)
    }
    if (seen.has(type.name)) {
      errors.push(`Duplicate type name "${type.name}"`)
    }
    seen.add(type.name)

    for (const field of type.fields) {
      if (!CAMEL_CASE.test(field.name)) {
        errors.push(`Field "${type.name}.${field.name}" is not camelCase`)
      }
      if (field.name.startsWith('_')) {
        errors.push(`Field "${type.name}.${field.name}" must not start with _`)
      }
    }
  }
  return errors
}

function collectRefAndBoneErrors(types: ProposedType[]): string[] {
  const errors: string[] = []
  const docNames = new Set(
    types.filter((t) => t.kind === 'document' || t.kind === 'singleton').map((t) => t.name),
  )
  // Objects may also be referenced via of[]; allow any proposed name as a type target.
  const allNames = new Set(types.map((t) => t.name))
  const boneSet = new Set<string>(BONES)

  for (const type of types) {
    if (type.bonesMatch != null && type.bonesMatch !== '') {
      if (!boneSet.has(type.bonesMatch)) {
        errors.push(`Unknown bonesMatch "${type.bonesMatch}" on type "${type.name}"`)
      }
    }

    for (const field of type.fields) {
      if (field.to) {
        for (const target of field.to) {
          if (!docNames.has(target) && !allNames.has(target)) {
            errors.push(
              `Dangling ref "${type.name}.${field.name}" → "${target}" (not a proposed type)`,
            )
          }
        }
      }
      if (field.of) {
        for (const member of field.of) {
          const builtin = new Set([
            'string',
            'text',
            'number',
            'boolean',
            'date',
            'datetime',
            'url',
            'slug',
            'image',
            'file',
            'reference',
            'block',
            'object',
          ])
          if (
            !builtin.has(member) &&
            !boneSet.has(member) &&
            !allNames.has(member) &&
            member !== 'link'
          ) {
            errors.push(
              `Unknown array member "${member}" on "${type.name}.${field.name}" (not Bones or proposed)`,
            )
          }
        }
      }
    }

    if (type.name === 'page') {
      const body = type.fields.find((f) => f.name === 'body' && f.type === 'array')
      if (body?.of) {
        for (const member of body.of) {
          if (!boneSet.has(member) && !allNames.has(member) && member !== 'link') {
            errors.push(`page.body.of member "${member}" must be a Bones block or proposed object`)
          }
        }
      }
    }
  }

  return errors
}

function collectCompileErrors(types: ProposedType[]): string[] {
  const errors: string[] = []
  try {
    const schemaJson = compileToSchemaJson(types)
    const validated = validateSchema(schemaJson)
    const problems = groupProblems(validated.getTypes()).filter((group) =>
      group.problems.some((p) => p.severity === 'error'),
    )
    for (const group of problems) {
      for (const problem of group.problems) {
        if (problem.severity !== 'error') continue
        const path = group.path.map(String).join('.')
        errors.push(`Schema validate: ${path}: ${problem.message}`)
      }
    }
    Schema.compile({name: 'autopsyProposal', types: schemaJson})
  } catch (err) {
    errors.push(`Schema.compile failed: ${err instanceof Error ? err.message : String(err)}`)
  }
  return errors
}

/**
 * Validate a proposal against the Corpse evidence and Sanity schema rules.
 * Mutates evidence (drops bad excerpts) and may inject page/siteSettings.
 */
export function validateProposal(types: ProposedType[], corpse: Corpse): ValidateResult {
  let next = filterEvidence(types, corpse)
  next = ensurePageAndSiteSettings(next)

  const errors = [
    ...collectNameErrors(next),
    ...collectRefAndBoneErrors(next),
    ...collectCompileErrors(next),
  ]

  return {types: next, errors}
}
