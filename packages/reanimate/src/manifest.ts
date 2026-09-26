/**
 * Target schema = the real Bones types + the site's own collection types.
 * Serialised to the manifest shape the schema store accepts (NEC-10s): plain JSON,
 * no validation functions, `of`/`to` as `{type}` members.
 */
import {bonesSchemaTypes} from '@necro/bones'
import {compileProposedTypes, type ManifestSchemaType, type ProposedType} from '@necro/autopsy'

type Def = {
  name?: string
  type: string
  title?: string
  description?: string
  fields?: Def[]
  of?: Def[]
  to?: Array<{type: string}> | {type: string}
  options?: {list?: unknown[]}
  rows?: number
}

export function toManifest(def: Def): ManifestSchemaType {
  const out: ManifestSchemaType = {type: def.type}
  if (def.name) out.name = def.name
  if (def.title) out.title = def.title
  if (def.description) out.description = def.description
  if (def.fields?.length) out.fields = def.fields.map(toManifest)
  if (def.of?.length) out.of = def.of.map(toManifest)
  if (def.to) out.to = (Array.isArray(def.to) ? def.to : [def.to]).map((t) => ({type: t.type}))
  if (def.options?.list) out.options = {list: def.options.list}
  if (def.rows) out.rows = def.rows
  return out
}

export function targetSchemaManifest(extraTypes: ProposedType[]): ManifestSchemaType[] {
  const bones = (bonesSchemaTypes as unknown as Def[]).map(toManifest)
  const names = new Set(bones.map((t) => String(t.name)))
  const extras = compileProposedTypes(extraTypes).filter((t) => !names.has(String(t.name)))
  return [...bones, ...extras]
}
