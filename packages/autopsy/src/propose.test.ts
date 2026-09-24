import {afterEach, describe, expect, test} from 'vitest'
import {resolveProposeModel} from './propose'

describe('resolveProposeModel', () => {
  const prev = {
    reasoning: process.env.NECRO_MODEL_REASONING,
    fast: process.env.NECRO_MODEL_FAST,
    flag: process.env.NECRO_AUTOPSY_FAST,
  }

  afterEach(() => {
    process.env.NECRO_MODEL_REASONING = prev.reasoning
    process.env.NECRO_MODEL_FAST = prev.fast
    process.env.NECRO_AUTOPSY_FAST = prev.flag
  })

  test('prefers REASONING by default', () => {
    process.env.NECRO_MODEL_REASONING = 'sonnet-test'
    process.env.NECRO_MODEL_FAST = 'haiku-test'
    delete process.env.NECRO_AUTOPSY_FAST
    expect(resolveProposeModel()).toBe('sonnet-test')
  })

  test('--fast / NECRO_AUTOPSY_FAST uses Haiku', () => {
    process.env.NECRO_MODEL_REASONING = 'sonnet-test'
    process.env.NECRO_MODEL_FAST = 'haiku-test'
    process.env.NECRO_AUTOPSY_FAST = '1'
    expect(resolveProposeModel()).toBe('haiku-test')
    delete process.env.NECRO_AUTOPSY_FAST
    expect(resolveProposeModel({fast: true})).toBe('haiku-test')
  })
})
