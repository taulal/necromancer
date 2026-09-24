import {describe, expect, test} from 'vitest'
import {isAppRoutePath} from './AppRouter'

describe('isAppRoutePath', () => {
  test('allows graveyard and séance stages', () => {
    expect(isAppRoutePath('/')).toBe(true)
    expect(isAppRoutePath('/seance/abc')).toBe(true)
    expect(isAppRoutePath('/seance/abc/autopsy')).toBe(true)
  })

  test('rejects host junk', () => {
    expect(isAppRoutePath('/@or6mff29v/apps/foo')).toBe(false)
    expect(isAppRoutePath('/welcome')).toBe(false)
  })
})
