import {describe, expect, test} from 'vitest'
import {BONES} from './bones'
import {BONES_CATALOGUE} from './catalogue'

describe('BONES_CATALOGUE', () => {
  test('covers every BONES name', () => {
    const names = new Set(BONES_CATALOGUE.map((entry) => entry.name))
    for (const bone of BONES) {
      expect(names.has(bone), `missing catalogue entry for ${bone}`).toBe(true)
    }
  })

  test('every bone entry has a purpose and fields', () => {
    for (const bone of BONES) {
      const entry = BONES_CATALOGUE.find((e) => e.name === bone)
      expect(entry).toBeDefined()
      expect(entry!.purpose.length).toBeGreaterThan(20)
      expect(Object.keys(entry!.fields).length).toBeGreaterThan(0)
    }
  })
})
