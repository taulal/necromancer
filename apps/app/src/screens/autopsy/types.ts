/** Shared shapes for the Autopsy board (schemaProposal.types[]). */

export type ProposedFieldRow = {
  _key?: string
  name?: string
  type?: string
  of?: string[]
  to?: string[]
  required?: boolean
  evidenceCount?: number
  description?: string
}

export type ProposedEvidenceRow = {
  _key?: string
  excerpt?: string
  pageUrl?: string
  pagePath?: string
  pageId?: string
}

export type ProposedTypeRow = {
  _key?: string
  name?: string
  title?: string
  kind?: 'document' | 'object' | 'singleton' | string
  bonesMatch?: string | null
  rationale?: string
  confidence?: number
  decision?: 'keep' | 'merge' | 'drop' | string
  mergeInto?: string | null
  fields?: ProposedFieldRow[]
  evidence?: ProposedEvidenceRow[]
}

export type ProposalProjection = {
  _id?: string
  version?: number
  acceptedAt?: string
  model?: string
  inputTokens?: number
  outputTokens?: number
  repairRounds?: number
  types?: ProposedTypeRow[]
}

export type NodeKind = 'document' | 'singleton' | 'bones' | 'object'

export function classifyNode(t: ProposedTypeRow): NodeKind {
  if (t.kind === 'singleton') return 'singleton'
  if (t.kind === 'object' || (t.bonesMatch && t.kind !== 'document')) {
    // Bones blocks are objects with a bonesMatch; custom objects stay 'object'.
    if (t.bonesMatch) return 'bones'
    return 'object'
  }
  return 'document'
}

export function isVisibleType(t: ProposedTypeRow): boolean {
  return t.decision !== 'drop' && t.decision !== 'merge'
}
