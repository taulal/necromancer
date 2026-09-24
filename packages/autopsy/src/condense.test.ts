import {describe, expect, test} from 'vitest'
import {condense, pathPrefixOf, signatureDistance} from './condense'
import {fixtureExhumedPages} from './__fixtures__/site'

describe('condense', () => {
  test('skips httpStatus >= 400', () => {
    const corpse = condense(fixtureExhumedPages)
    expect(corpse.pages.every((p) => p.httpStatus < 400)).toBe(true)
    expect(corpse.pages.find((p) => p.pageId === 'page-404')).toBeUndefined()
  })

  test('trims section text to 600 chars', () => {
    const long = 'x'.repeat(900)
    const corpse = condense([
      {
        _id: 'long',
        path: '/long',
        httpStatus: 200,
        sections: [{kind: 'prose', text: long}],
      },
    ])
    expect(corpse.pages[0]!.sections[0]!.text.length).toBeLessThanOrEqual(600)
  })

  test('clusters /services/* pages with similar kind signatures', () => {
    const corpse = condense(fixtureExhumedPages)
    const services = corpse.clusters.find((c) => c.pathPrefix === '/services')
    expect(services).toBeDefined()
    expect(services!.pageIds).toEqual(
      expect.arrayContaining(['page-drain', 'page-hotwater', 'page-gas']),
    )
    expect(services!.pageIds.length).toBeGreaterThanOrEqual(3)
    expect(services!.signature).toEqual(['hero', 'prose', 'cta'])
  })

  test('merges site-wide facts with page ids', () => {
    const corpse = condense(fixtureExhumedPages)
    const phone = corpse.facts.phones.find((p) => p.value === '021 152 6894')
    expect(phone).toBeDefined()
    expect(phone!.pages).toEqual(
      expect.arrayContaining(['page-home', 'page-drain', 'page-hotwater']),
    )
    expect(corpse.facts.emails.some((e) => e.value === 'hello@acme.example')).toBe(true)
    expect(corpse.facts.phones.some((p) => p.value === '021 000 0000')).toBe(false)
  })

  test('pathPrefixOf and signatureDistance helpers', () => {
    expect(pathPrefixOf('/services/drain')).toBe('/services')
    expect(pathPrefixOf('/')).toBe('/')
    expect(signatureDistance(['hero', 'prose'], ['hero', 'prose'])).toBe(0)
    expect(signatureDistance(['hero', 'prose'], ['hero', 'prose', 'cta'])).toBe(1)
    expect(signatureDistance(['hero'], ['cta', 'faq'])).toBeGreaterThan(1)
  })
})
