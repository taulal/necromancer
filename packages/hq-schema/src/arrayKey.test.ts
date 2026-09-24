import {describe, expect, test} from 'vitest'
import {arrayKey, withArrayKeys} from './arrayKey'

describe('withArrayKeys', () => {
  test('stamps unique _key on each item', () => {
    const out = withArrayKeys([{name: 'a'}, {name: 'b'}])
    expect(out).toHaveLength(2)
    expect(out[0]!._key).toBeTruthy()
    expect(out[1]!._key).toBeTruthy()
    expect(out[0]!._key).not.toBe(out[1]!._key)
    expect(out[0]!.name).toBe('a')
  })

  test('preserves existing _key', () => {
    const out = withArrayKeys([{name: 'a', _key: 'keep-me'}])
    expect(out[0]!._key).toBe('keep-me')
  })

  test('sets _type when typeName given', () => {
    const out = withArrayKeys([{src: 'https://x.test/i.jpg'}], 'exhumedImage')
    expect(out[0]).toMatchObject({_type: 'exhumedImage', src: 'https://x.test/i.jpg'})
    expect(out[0]!._key).toBeTruthy()
  })

  test('empty / null → []', () => {
    expect(withArrayKeys(null)).toEqual([])
    expect(withArrayKeys(undefined)).toEqual([])
    expect(withArrayKeys([])).toEqual([])
  })

  test('arrayKey is short hex', () => {
    expect(arrayKey()).toMatch(/^[0-9a-f]{12}$/)
  })
})
