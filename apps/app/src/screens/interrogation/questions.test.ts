import {describe, expect, test} from 'vitest'
import {counts, evidencePath, nextQuestionId, orderQuestions, shortLabel} from './questions'

describe('shortLabel', () => {
  test('first sentence, clipped', () => {
    expect(shortLabel('/member-login/ has only 47 words. Keep it, merge it, or kill it?')).toBe(
      '/member-login/ has only 47 words.',
    )
    expect(shortLabel('a'.repeat(80), 20)).toHaveLength(20)
    expect(shortLabel(undefined)).toBe('Question')
  })
})

describe('orderQuestions', () => {
  test('required first, stable, ignores answers', () => {
    const qs = [
      {id: 'opt-open', required: false},
      {id: 'req-done', required: true, answer: 'x'},
      {id: 'req-open', required: true},
      {id: 'opt-done', required: false, answer: 'y'},
    ]
    expect(orderQuestions(qs).map((q) => q.id)).toEqual([
      'req-done',
      'req-open',
      'opt-open',
      'opt-done',
    ])
  })
})

describe('counts', () => {
  test('answered and required left', () => {
    expect(
      counts([{required: true}, {required: true, answer: 'a'}, {required: false}, {answer: ' '}]),
    ).toEqual({total: 4, answered: 1, requiredLeft: 1})
  })
})

describe('nextQuestionId', () => {
  const qs = [{_id: 'a'}, {_id: 'b', answer: 'x'}, {_id: 'c'}]
  test('skips answered and wraps', () => {
    expect(nextQuestionId(qs, 'a')).toBe('c')
    expect(nextQuestionId(qs, 'c')).toBe('a')
  })
  test('all answered → just the next one', () => {
    expect(
      nextQuestionId(
        [
          {_id: 'a', answer: 'x'},
          {_id: 'b', answer: 'y'},
        ],
        'a',
      ),
    ).toBe('b')
  })
  test('empty → null', () => {
    expect(nextQuestionId([], null)).toBeNull()
  })
})

describe('evidencePath', () => {
  test('path from url, keeps query', () => {
    expect(evidencePath({url: 'https://x.nz/member-login/?logged_out=true'})).toBe(
      '/member-login/?logged_out=true',
    )
  })
})
