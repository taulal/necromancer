import {describe, expect, test} from 'vitest'
import {fieldOverlap, findMergeHints} from './mergeHint'
import type {ProposedTypeRow} from './types'

function type(name: string, fields: string[]): ProposedTypeRow {
  return {
    _key: name,
    name,
    kind: 'document',
    decision: 'keep',
    fields: fields.map((f) => ({_key: f, name: f, type: 'string', evidenceCount: 1})),
  }
}

describe('findMergeHints', () => {
  test('hints when field overlap ≥ 75%', () => {
    const a = type('teamMember', ['title', 'name', 'role', 'photo'])
    const b = type('staffProfile', ['title', 'name', 'role', 'bio'])
    // 3/5 = 0.6 — below
    expect(fieldOverlap(a, b)).toBeCloseTo(0.6, 5)
    expect(findMergeHints([a, b])).toHaveLength(0)

    const c = type('staffProfile', ['title', 'name', 'role', 'photo'])
    // 4/4 = 1
    expect(fieldOverlap(a, c)).toBe(1)
    const hints = findMergeHints([a, c])
    expect(hints).toHaveLength(1)
    expect(hints[0]).toMatchObject({a: 'teamMember', b: 'staffProfile', overlap: 1})
  })

  test('ignores dropped types', () => {
    const a = type('a', ['x', 'y', 'z', 'w'])
    const b = {...type('b', ['x', 'y', 'z', 'w']), decision: 'drop' as const}
    expect(findMergeHints([a, b])).toHaveLength(0)
  })
})
