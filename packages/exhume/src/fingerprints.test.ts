import {describe, expect, test} from 'vitest'
import {detectPlatform} from './fingerprints'

describe('detectPlatform (legacy)', () => {
  test('wordpress from wp-content', () => {
    expect(detectPlatform('<link href="/wp-content/themes/x.css">').platform).toBe('wordpress')
  })

  test('durable from cdn', () => {
    expect(detectPlatform('<script src="https://cdn.durable.co/x.js">').platform).toBe('durable')
  })

  test('empty → unknown', () => {
    expect(detectPlatform('').platform).toBe('unknown')
  })
})
