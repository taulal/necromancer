import {Schema} from '@sanity/schema'
import type {ProposedType} from '@necro/autopsy'
import {describe, expect, test} from 'vitest'
import {targetSchemaManifest} from './manifest'
import {
  pickBrandColors,
  pickBrandFonts,
  planReanimation,
  siteNameFromTitles,
  type PlanPage,
} from './plan'

const html = (h1: string, p = 'Some words about this page that are long enough to keep.') =>
  `<main><h1>${h1}</h1><p>${p}</p></main>`

const pages: PlanPage[] = [
  {
    _id: 'p-home',
    url: 'https://caz.test/',
    path: '/',
    title: "Baking HQ | Caz's Kitchen",
    html: html('Welcome'),
  },
  {
    _id: 'p-about',
    url: 'https://caz.test/about/',
    path: '/about/',
    title: "About | Caz's Kitchen",
    html: html('About'),
  },
  {
    _id: 'p-login',
    url: 'https://caz.test/login/',
    path: '/login/',
    title: "Login | Caz's Kitchen",
    html: html('Login'),
  },
  {
    _id: 'p-login2',
    url: 'https://caz.test/login/?x=1',
    path: '/login/',
    title: "Login | Caz's Kitchen",
    html: html('Login'),
  },
  {
    _id: 'p-cake',
    url: 'https://caz.test/product/brownie/',
    path: '/product/brownie/',
    title: "Brownie | Caz's Kitchen",
    html: html('Brownie', 'Rich chocolate brownie, baked daily in Waterloo.'),
    detectedEntities: {prices: ['£18.00']},
  },
  {_id: 'p-gone', url: 'https://caz.test/old/', path: '/old/', httpStatus: 404},
]

const product: ProposedType = {
  name: 'product',
  title: 'Product',
  kind: 'document',
  bonesMatch: null,
  fields: [
    {name: 'name', type: 'string', evidenceCount: 1},
    {name: 'price', type: 'number', evidenceCount: 1},
    {name: 'description', type: 'text', evidenceCount: 1},
  ],
  rationale: 'Shop items.',
  evidence: [{pageId: 'p-cake', url: 'https://caz.test/product/brownie/', excerpt: 'Brownie'}],
  confidence: 0.9,
  decision: 'keep',
}

describe('planReanimation', () => {
  const plan = planReanimation({
    seance: {
      brand: {
        colors: ['#fff', '#2ea3f2'],
        fonts: ['inherit', 'Open Sans'],
        logo: 'https://caz.test/logo.png',
      },
    },
    pages,
    types: [product],
    questions: [
      {
        kind: 'keep-or-kill',
        answer: 'Kill this page',
        evidence: [{url: 'https://caz.test/login/'}],
      },
    ],
  })
  const byId = new Map(plan.docs.map((d) => [d._id, d]))

  test('site name comes from shared title suffix; page titles lose it', () => {
    expect(plan.siteTitle).toBe("Caz's Kitchen")
    expect(byId.get('page-about')?.title).toBe('About')
    expect(byId.get('page-home')?.slug).toEqual({_type: 'slug', current: 'home'})
  })

  test('detail pages evidenced by a collection type become collection docs', () => {
    const doc = byId.get('product-brownie')
    expect(doc).toMatchObject({_type: 'product', name: 'Brownie', price: 18})
    expect(String(doc?.description)).toContain('Rich chocolate brownie')
    expect(plan.pageTargets.find((t) => t.exhumedPageId === 'p-cake')?.path).toBe(
      '/product/brownie',
    )
  })

  test('answered "kill" drops the page and 301s it home; 404s are dropped too', () => {
    expect(byId.has('page-login')).toBe(false)
    expect(plan.ledger.find((l) => l.from === '/login')).toMatchObject({status: 'dropped', to: '/'})
    expect(plan.ledger.find((l) => l.from === '/old')).toMatchObject({
      status: 'dropped',
      reason: 'HTTP 404',
    })
    // One redirect per moved path, even with query-string variants (/login/?x=1).
    const froms = plan.docs.filter((d) => d._type === 'redirect').map((d) => d.from)
    expect(froms.sort()).toEqual(['/login', '/old'])
  })

  test('trailing slashes never produce redirects', () => {
    expect(plan.ledger.find((l) => l.from === '/about')).toMatchObject({
      to: '/about',
      status: 'mapped',
    })
  })

  test('siteSettings carries real brand picks', () => {
    expect(byId.get('siteSettings')).toMatchObject({
      siteTitle: "Caz's Kitchen",
      brand: {primaryColor: '#2ea3f2', fontHeading: 'Open Sans'},
    })
  })

  test('target schema (Bones + collections) compiles', () => {
    const types = targetSchemaManifest(plan.extraTypes)
    expect(types.some((t) => t.name === 'product')).toBe(true)
    expect(() => Schema.compile({name: 'target', types})).not.toThrow()
  })
})

describe('brand + titles', () => {
  test('pickers skip white/grey, CSS keywords and code fonts', () => {
    expect(pickBrandColors(['#ffffff', '#666', '#c0392b']).primary).toBe('#c0392b')
    expect(pickBrandFonts(['inherit', 'Courier New,monospace', 'Lato'])).toEqual({
      heading: 'Lato',
      body: 'Lato',
    })
  })
  test('no shared suffix → no site name', () => {
    expect(siteNameFromTitles(['Home', 'About us'])).toBeUndefined()
  })
})
