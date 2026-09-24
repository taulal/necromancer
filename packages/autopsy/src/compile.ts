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
  } else if (field.type === 'object' && field.of?.length) {
    base.fields = field.of.map((n) => ({name: n, type: 'string'}))
  }

  return base
}

function typeToSchema(t: ProposedType): ManifestSchemaType {
  const sanityType = t.kind === 'object' ? 'object' : 'document'
  return {
    name: t.name,
    title: t.title,
    type: sanityType,
    fields: t.fields.map(fieldToSchema),
  }
}

/**
 * Structural compile of a proposal into Sanity schema type defs (array).
 * Bones block stubs are included so page.body.of members resolve under Schema.compile.
 */
export function compileToSchemaJson(types: ProposedType[]): ManifestSchemaType[] {
  const boneStubs: ManifestSchemaType[] = BONES.map((name) => ({
    name,
    title: name,
    type: 'object',
    fields: [{name: 'placeholder', type: 'string'}],
  }))

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
