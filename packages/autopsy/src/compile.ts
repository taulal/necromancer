/**
 * Proposal → Sanity schema JSON (+ stub TS). Full deploy path is NEC-10.
 */
import {BONES} from '@necro/bones'
import type {ProposedField, ProposedType} from './proposal'

export type ManifestSchemaType = Record<string, unknown>

function fieldToSchema(field: ProposedField): ManifestSchemaType {
  const base: ManifestSchemaType = {
    name: field.name,
    type: field.type === 'portableText' ? 'array' : field.type,
    title: field.name,
  }

  if (field.description) base.description = field.description

  if (field.type === 'portableText') {
    base.of = [{type: 'block'}]
  } else if (field.type === 'array' && field.of?.length) {
    base.of = field.of.map((member) => {
      if (member === 'reference' && field.to?.length) {
        return {type: 'reference', to: field.to.map((n) => ({type: n}))}
      }
      return {type: member}
    })
  } else if (field.type === 'reference' && field.to?.length) {
    base.to = field.to.map((n) => ({type: n}))
  } else if (field.type === 'object') {
    // Sanity objects always need a fields array — never leave it undefined.
    base.fields =
      field.of?.length && field.of.length > 0
        ? field.of.map((n) => ({name: n, type: 'string'}))
        : [{name: 'value', type: 'string'}]
  }

  return base
}

function typeToSchema(t: ProposedType): ManifestSchemaType {
  const sanityType = t.kind === 'object' ? 'object' : 'document'
  const fields = Array.isArray(t.fields) ? t.fields : []
  return {
    name: t.name,
    title: t.title || t.name,
    type: sanityType,
    // Schema.compile errors if fields is missing/undefined on document|object.
    fields: fields.length > 0 ? fields.map(fieldToSchema) : [{name: 'title', type: 'string'}],
  }
}

/**
 * Structural compile of a proposal into Sanity schema type defs (array).
 * Bones block stubs are included so page.body.of members resolve under Schema.compile.
 * Also stubs `link` (shared object used by CTAs/cards).
 */
export function compileToSchemaJson(types: ProposedType[]): ManifestSchemaType[] {
  const boneStubs: ManifestSchemaType[] = [
    ...BONES.map((name) => ({
      name,
      title: name,
      type: 'object' as const,
      fields: [{name: 'placeholder', type: 'string'}],
    })),
    {
      name: 'link',
      title: 'Link',
      type: 'object',
      fields: [
        {name: 'label', type: 'string'},
        {name: 'href', type: 'url'},
      ],
    },
  ]

  const proposed = types.map(typeToSchema)
  const names = new Set(proposed.map((t) => String(t.name)))
  const extras = boneStubs.filter((b) => !names.has(String(b.name)))

  return [...extras, ...proposed]
}

/** Stub TypeScript source emitter (NEC-10 will flesh this out). */
export function compileToTypeScript(types: ProposedType[]): string {
  const names = types.map((t) => t.name).join(', ')
  return `// Autopsy-generated schema stub — do not edit by hand.\n// Types: ${names}\n`
}
