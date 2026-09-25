/**
 * Rank and cap questions to the 5–15 target band (NEC-11).
 * Never pads below 5 — thin sites may have fewer findings.
 */
import type {DraftQuestion} from './types'

export const MAX_QUESTIONS = 15

const KIND_FLOOR: Record<DraftQuestion['kind'], number> = {
  contradiction: 100,
  authenticity: 90,
  mapping: 70,
  'missing-info': 55,
  'keep-or-kill': 45,
}

export function rankScore(q: DraftQuestion): number {
  return q.rank || KIND_FLOOR[q.kind] || 0
}

export function rankAndCap(questions: DraftQuestion[], max = MAX_QUESTIONS): DraftQuestion[] {
  const seen = new Set<string>()
  const deduped: DraftQuestion[] = []
  for (const q of questions) {
    if (seen.has(q.fingerprint)) continue
    seen.add(q.fingerprint)
    deduped.push(q)
  }

  // Prefer required questions when trimming.
  deduped.sort((a, b) => {
    const req = Number(b.required) - Number(a.required)
    if (req !== 0) return req
    const score = rankScore(b) - rankScore(a)
    if (score !== 0) return score
    return a.fingerprint.localeCompare(b.fingerprint)
  })

  return deduped.slice(0, max)
}
