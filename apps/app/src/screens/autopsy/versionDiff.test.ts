import {describe, expect, test} from 'vitest'
import {diffProposals} from './versionDiff'
import type {ProposedTypeRow} from './types'

function type(
  name: string,
  fields: Array<{name: string; type?: string; required?: boolean}>,
): ProposedTypeRow {
  return {
    _key: name,
    name,
    kind: 'document',
    fields: fields.map((f) => ({
      _key: f.name,
      name: f.name,
      type: f.type ?? 'string',
      required: f.required,
      evidenceCount: 1,
    })),
  }
}

describe('diffProposals', () => {
  test('first version summary', () => {
    const d = diffProposals([type('page', [{name: 'title'}])], undefined)
    expect(d?.summary).toBe('First anatomy · 1 type')
  })

  test('counts added types and field changes', () => {
    const prior = [type('page', [{name: 'title', type: 'string'}])]
    const current = [
      type('page', [{name: 'title', type: 'string', required: true}, {name: 'slug'}]),
      type('service', [{name: 'title'}]),
    ]
    const d = diffProposals(current, prior)
    expect(d?.added).toEqual(['service'])
    expect(d?.fieldChanged).toBeGreaterThanOrEqual(2)
    expect(d?.summary).toMatch(/\+1 type/)
    expect(d?.summary).toMatch(/field/)
  })
})
