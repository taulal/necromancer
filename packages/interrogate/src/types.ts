/**
 * In-memory interrogation shapes (NEC-11 / BRIEF §7.3).
 */

export type QuestionKind =
  'contradiction' | 'authenticity' | 'keep-or-kill' | 'mapping' | 'missing-info'

export type QuestionSource = 'claude' | 'knowledgeBase'

export type Evidence = {
  pageId: string
  url: string
  /** Exact substring of page content (validated). */
  excerpt: string
}

export type DraftQuestion = {
  /** Stable fingerprint for idempotent doc ids. */
  fingerprint: string
  kind: QuestionKind
  prompt: string
  evidence: Evidence[]
  options: string[]
  required: boolean
  source: QuestionSource
  spawnsTasks: boolean
  /** Higher = keep first when capping at 15. */
  rank: number
}

export type InterrogatePageInput = {
  _id: string
  path?: string
  url?: string
  title?: string
  httpStatus?: number
  contentHash?: string
  headings?: string[]
  meta?: {description?: string; ogImage?: string; canonical?: string}
  sections?: Array<{kind?: string; html?: string; text?: string}>
  images?: Array<{src?: string; alt?: string}>
  links?: string[]
  detectedEntities?: {
    phones?: string[]
    emails?: string[]
    addresses?: string[]
    prices?: string[]
  }
}

export type ProposedTypeSummary = {
  name: string
  title: string
  kind: string
  confidence: number
  rationale: string
  bonesMatch?: string | null
  decision?: string
  evidence?: Evidence[]
}

export type InterrogateUsage = {
  model: string | null
  inputTokens: number
  outputTokens: number
}

export type InterrogateResult = {
  questions: DraftQuestion[]
  usage: InterrogateUsage
}
