import {describe, expect, test} from 'vitest'
import {stripDocIds} from './ask'

describe('stripDocIds', () => {
  test('removes leaked document-id lists (cazskitchen, 26 Sep)', () => {
    expect(
      stripDocIds(
        'There are three duplicate /shop/ pages (RgPzjpQgR5OLQk5B8u3qt1, RgPzjpQgR5OLQk5B8u43dr, tshD2zmH8AFz2zCMfQJLGP) with identical product lists. Should we consolidate them into one?',
      ),
    ).toBe(
      'There are three duplicate /shop/ pages with identical product lists. Should we consolidate them into one?',
    )
  })

  test('keeps ordinary parentheses', () => {
    const p = 'The page lists hours (Thursday–Saturday). Keep it?'
    expect(stripDocIds(p)).toBe(p)
  })
})
