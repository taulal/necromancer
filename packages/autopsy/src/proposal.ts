/**
 * The in-memory shape of a schema proposal. Mirrors the `schemaProposal` HQ doc (BRIEF.md §6).
 * TODO(NEC-09/10): compileToSchemaJson(proposal), compileToTypeScript(proposal)
 */
export type FieldType =
  | 'string' | 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'url' | 'slug'
  | 'image' | 'file' | 'array' | 'object' | 'reference' | 'portableText'

export interface ProposedField {
  name: string
  type: FieldType
  of?: string[]
  to?: string[]
  required?: boolean
  validation?: {min?: number; max?: number; regex?: string}
  description?: string
  evidenceCount: number
}

export interface Evidence {
  pageId: string
  url: string
  excerpt: string
}

export interface ProposedType {
  name: string
  title: string
  kind: 'document' | 'object' | 'singleton'
  bonesMatch: string | null
  fields: ProposedField[]
  rationale: string
  evidence: Evidence[]
  confidence: number
  decision: 'keep' | 'merge' | 'drop'
  mergeInto?: string
}

export interface SchemaProposal {
  seanceId: string
  version: number
  types: ProposedType[]
}
