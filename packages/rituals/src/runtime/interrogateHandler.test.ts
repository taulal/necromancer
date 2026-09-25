/**
 * Handler unit coverage: open-required recount query shape (question-gate parity).
 */
import {describe, expect, test, vi} from 'vitest'
import {countOpenRequiredQuestions} from './interrogateHandler'

describe('countOpenRequiredQuestions', () => {
  test('uses the same GROQ as question-gate', async () => {
    const fetch = vi.fn(async () => 3)
    const client = {fetch} as never
    const count = await countOpenRequiredQuestions(client, 'seance-1')
    expect(count).toBe(3)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('required == true && !defined(answer)'),
      {published: 'seance-1'},
    )
  })
})
