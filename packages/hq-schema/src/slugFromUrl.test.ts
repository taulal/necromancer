import {describe, expect, test} from 'vitest'
import {slugFromUrl} from './slugFromUrl'

describe('slugFromUrl', () => {
  test('strips www and multi-part TLD', () => {
    expect(slugFromUrl('https://pnjbuild.co.nz')).toBe('pnjbuild')
    expect(slugFromUrl('https://www.pnjbuild.co.nz/about')).toBe('pnjbuild')
    expect(slugFromUrl('https://hewahihaumaru.org.nz')).toBe('hewahihaumaru')
  })

  test('drops single-label TLD', () => {
    expect(slugFromUrl('https://example.com')).toBe('example')
    expect(slugFromUrl('https://www.acme.io')).toBe('acme')
  })

  test('does not slugify the whole URL', () => {
    expect(slugFromUrl('https://pnjbuild.co.nz')).not.toMatch(/https/)
  })
})
