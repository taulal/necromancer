/**
 * The in-memory shape of a schema proposal. Mirrors the `schemaProposal` HQ doc (BRIEF.md §6).
 */
export type FieldType =
  | 'string'
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'url'
  | 'slug'
  | 'image'
  | 'file'
  | 'array'
  | 'object'
  | 'reference'
  | 'portableText'

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
  model?: string
  inputTokens?: number
  outputTokens?: number
  repairRounds?: number
}

/** Human board edits to respect on autopsy re-run (batch-3 Step 2). */
export type HumanDecision =
  | {kind: 'rename'; from: string; to: string}
  | {kind: 'merge'; from: string; into: string}
  | {kind: 'drop'; typeName: string}
  | {kind: 'required'; typeName: string; field: string; required: boolean}

export type AutopsyUsage = {
  model: string
  inputTokens: number
  outputTokens: number
  repairRounds: number
}

export type AutopsyResult = {
  proposal: SchemaProposal
  usage: AutopsyUsage
}
