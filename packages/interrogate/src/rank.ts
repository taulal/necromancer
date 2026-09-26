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

/** Evidence pages by path (query string dropped), for overlap checks. */
function evidencePaths(q: DraftQuestion): Set<string> {
  const paths = new Set<string>()
  for (const e of q.evidence) {
    try {
      paths.add(new URL(e.url).pathname)
    } catch {
      if (e.pageId) paths.add(e.pageId)
    }
  }
  return paths
}

/**
 * Keep-or-kill questions about the same pages ask the same thing twice (e.g. a
 * thin-page finding and Claude's "consolidate these login pages"). Keep the one
 * covering the most pages; drop optional ones whose pages are all covered by a kept one.
 */
function dropOverlappingKeepOrKill(questions: DraftQuestion[]): DraftQuestion[] {
  const kok = questions
    .filter((q) => q.kind === 'keep-or-kill')
    .map((q) => ({q, paths: evidencePaths(q)}))
    .filter(({paths}) => paths.size > 0)
    .sort(
      (a, b) =>
        b.paths.size - a.paths.size ||
        rankScore(b.q) - rankScore(a.q) ||
        a.q.fingerprint.localeCompare(b.q.fingerprint),
    )
  const kept: Set<string>[] = []
  const dropped = new Set<DraftQuestion>()
  for (const {q, paths} of kok) {
    const covered = kept.some((k) => [...paths].every((p) => k.has(p)))
    if (covered && !q.required) dropped.add(q)
    else kept.push(paths)
  }
  return questions.filter((q) => !dropped.has(q))
}

export function rankAndCap(questions: DraftQuestion[], max = MAX_QUESTIONS): DraftQuestion[] {
  const seen = new Set<string>()
  const unique: DraftQuestion[] = []
  for (const q of questions) {
    if (seen.has(q.fingerprint)) continue
    seen.add(q.fingerprint)
    unique.push(q)
  }
  const deduped = dropOverlappingKeepOrKill(unique)

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
