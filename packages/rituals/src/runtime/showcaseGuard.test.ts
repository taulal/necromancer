import {describe, expect, test} from 'vitest'
import {isOccupiedByOther, ShowcaseOccupiedError} from './showcaseGuard'

describe('showcase occupancy', () => {
  test('empty showcase is free for any séance', () => {
    expect(
      isOccupiedByOther({contentCount: 0, ownerSeanceId: null, schemaIds: []}, 'seance-a'),
    ).toBe(false)
  })

  test('owner matching current séance is not "other"', () => {
    expect(
      isOccupiedByOther({contentCount: 0, ownerSeanceId: 'seance-a', schemaIds: []}, 'seance-a'),
    ).toBe(false)
  })

  test('docs or other owner occupy showcase', () => {
    expect(
      isOccupiedByOther({contentCount: 3, ownerSeanceId: null, schemaIds: []}, 'seance-a'),
    ).toBe(true)
    expect(
      isOccupiedByOther(
        {contentCount: 0, ownerSeanceId: 'seance-b', schemaIds: ['_.schemas.x']},
        'seance-a',
      ),
    ).toBe(true)
  })

  test('ShowcaseOccupiedError names itself for handlers', () => {
    const err = new ShowcaseOccupiedError()
    expect(err.name).toBe('ShowcaseOccupiedError')
    expect(err.message).toMatch(/--replace/)
  })
})
