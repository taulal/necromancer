import {describe, expect, it} from 'vitest'
import {detectPlatform} from './fingerprints'

describe('detectPlatform', () => {
  it('spots WordPress', () => {
    expect(detectPlatform('<link href="/wp-content/themes/x/style.css">').platform).toBe(
      'wordpress',
    )
  })
  it('spots Durable', () => {
    expect(detectPlatform('<img src="https://cdn.durable.co/blocks/a.jpg">').platform).toBe(
      'durable',
    )
  })
  it('falls back to static', () => {
    expect(detectPlatform('<html><body>hi</body></html>').platform).toBe('static')
  })
})
