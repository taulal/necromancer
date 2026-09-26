/**
 * Pure helpers for the Interrogation screen (NEC-UI3).
 */

export type QuestionEvidence = {
  _key?: string
  quote?: string
  url?: string
  path?: string
}

export type QuestionRow = {
  _id: string
  kind?: string
  prompt?: string
  required?: boolean
  source?: string
  options?: string[]
  answer?: string
  answerNote?: string
  answeredBy?: string
  spawnsTasks?: boolean
  evidence?: QuestionEvidence[]
}

export const KIND_LABEL: Record<string, string> = {
  contradiction: 'Contradiction',
  authenticity: 'Authenticity',
  'keep-or-kill': 'Keep or kill',
  mapping: 'Mapping',
  'missing-info': 'Missing info',
}

export function isAnswered(q: Pick<QuestionRow, 'answer'>): boolean {
  return Boolean(q.answer?.trim())
}

/** Left-list label: the prompt's first sentence, clipped. */
export function shortLabel(prompt: string | undefined, max = 64): string {
  const text = (prompt ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return 'Question'
  const first = text.match(/^.+?[.?!](?=\s|$)/)?.[0] ?? text
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first
}

/** Required first, then original order. Ignores answers so the list never jumps. */
export function orderQuestions<T extends Pick<QuestionRow, 'required'>>(qs: T[]): T[] {
  return qs
    .map((q, i) => ({q, i}))
    .sort((a, b) => Number(!!b.q.required) - Number(!!a.q.required) || a.i - b.i)
    .map(({q}) => q)
}

export function counts(qs: Pick<QuestionRow, 'required' | 'answer'>[]) {
  return {
    total: qs.length,
    answered: qs.filter(isAnswered).length,
    requiredLeft: qs.filter((q) => q.required && !isAnswered(q)).length,
  }
}

/** Next question after `currentId`, preferring unanswered ones; wraps. */
export function nextQuestionId(
  qs: Pick<QuestionRow, '_id' | 'answer'>[],
  currentId: string | null,
): string | null {
  if (!qs.length) return null
  const start = Math.max(
    0,
    qs.findIndex((q) => q._id === currentId),
  )
  for (let step = 1; step <= qs.length; step++) {
    const q = qs[(start + step) % qs.length]!
    if (!isAnswered(q) && q._id !== currentId) return q._id
  }
  return qs[(start + 1) % qs.length]!._id
}

/** Display path for an evidence URL ("/contact"). */
export function evidencePath(e: QuestionEvidence): string {
  if (e.path) return e.path
  if (!e.url) return 'page'
  try {
    const u = new URL(e.url)
    return `${u.pathname}${u.search}` || '/'
  } catch {
    return e.url
  }
}
