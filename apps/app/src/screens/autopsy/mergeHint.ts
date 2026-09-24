import type {ProposedTypeRow} from './types'
import {isVisibleType} from './types'

export type MergeHint = {
  a: string
  b: string
  overlap: number
}

/** Field-name Jaccard similarity; hint when ≥ 0.75 (batch-4). */
export function findMergeHints(types: ProposedTypeRow[], threshold = 0.75): MergeHint[] {
  const kept = types.filter(isVisibleType).filter((t) => (t.fields?.length ?? 0) > 0)
  const hints: MergeHint[] = []

  for (let i = 0; i < kept.length; i++) {
    for (let j = i + 1; j < kept.length; j++) {
      const a = kept[i]!
      const b = kept[j]!
      const overlap = fieldOverlap(a, b)
      if (overlap >= threshold && a.name && b.name) {
        hints.push({a: a.name, b: b.name, overlap})
      }
    }
  }

  return hints.sort((x, y) => y.overlap - x.overlap)
}

export function fieldOverlap(a: ProposedTypeRow, b: ProposedTypeRow): number {
  const aNames = new Set((a.fields ?? []).map((f) => f.name).filter(Boolean) as string[])
  const bNames = new Set((b.fields ?? []).map((f) => f.name).filter(Boolean) as string[])
  if (aNames.size === 0 || bNames.size === 0) return 0
  let inter = 0
  for (const n of aNames) if (bNames.has(n)) inter++
  const union = aNames.size + bNames.size - inter
  return union === 0 ? 0 : inter / union
}
