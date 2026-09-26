import {describe, expect, test} from 'vitest'
import {
  collectDeterministicQuestions,
  findBoilerplate,
  findContradictions,
  findHttpErrorPages,
  findMissingMetaAlt,
  findThinPages,
  rankAndCap,
} from './index'
import type {InterrogatePageInput} from './types'

const base = (over: Partial<InterrogatePageInput> & {_id: string}): InterrogatePageInput => ({
  path: '/',
  url: `https://acme.example${over.path ?? '/'}`,
  title: 'Acme',
  httpStatus: 200,
  contentHash: over._id,
  sections: [{kind: 'prose', text: 'We fix pipes fast across Auckland every weekday morning.'}],
  images: [],
  detectedEntities: {phones: [], emails: [], addresses: [], prices: []},
  ...over,
})

describe('findContradictions', () => {
  test('flags different phones across pages', () => {
    const pages = [
      base({
        _id: 'p1',
        path: '/',
        sections: [{kind: 'contact', text: 'Call 021 152 6894 today.'}],
        detectedEntities: {phones: ['021 152 6894'], emails: [], addresses: [], prices: []},
      }),
      base({
        _id: 'p2',
        path: '/about',
        sections: [{kind: 'contact', text: 'Call 09 555 0100 today.'}],
        detectedEntities: {phones: ['09 555 0100'], emails: [], addresses: [], prices: []},
      }),
    ]
    const qs = findContradictions(pages)
    expect(qs).toHaveLength(1)
    expect(qs[0]!.kind).toBe('contradiction')
    expect(qs[0]!.required).toBe(true)
    expect(qs[0]!.options).toContain('021 152 6894')
    expect(qs[0]!.options).toContain('09 555 0100')
    expect(qs[0]!.evidence.every((e) => e.excerpt.length > 0)).toBe(true)
  })

  test('no question when values agree', () => {
    const pages = [
      base({
        _id: 'p1',
        detectedEntities: {phones: ['021 152 6894'], emails: [], addresses: [], prices: []},
        sections: [{kind: 'contact', text: 'Call 021 152 6894'}],
      }),
      base({
        _id: 'p2',
        path: '/b',
        detectedEntities: {phones: ['021 152 6894'], emails: [], addresses: [], prices: []},
        sections: [{kind: 'contact', text: 'Call 021 152 6894'}],
      }),
    ]
    expect(findContradictions(pages)).toHaveLength(0)
  })
})

describe('findContradictions (directory sites)', () => {
  const contact = (
    id: string,
    path: string,
    entities: Partial<InterrogatePageInput['detectedEntities']>,
    text: string,
  ) =>
    base({
      _id: id,
      path,
      sections: [{kind: 'contact', text}],
      detectedEntities: {phones: [], emails: [], addresses: [], prices: [], ...entities},
    })

  test('one-off listing values are not site facts', () => {
    // hewahihaumaru: kiaora@ in chrome everywhere; each /space/ listing has its own email.
    const pages = [
      contact('p1', '/', {emails: ['kiaora@hewahihaumaru.org.nz']}, 'kiaora@hewahihaumaru.org.nz'),
      contact(
        'p2',
        '/about',
        {emails: ['kiaora@hewahihaumaru.org.nz']},
        'kiaora@hewahihaumaru.org.nz',
      ),
      contact('p3', '/space/meteor/', {emails: ['clare@themeteor.co.nz']}, 'clare@themeteor.co.nz'),
      contact('p4', '/space/dropin/', {emails: ['shop@dropin.nz']}, 'shop@dropin.nz'),
    ]
    expect(findContradictions(pages)).toEqual([])
  })

  test('same phone in different formats is not a contradiction', () => {
    const pages = [
      contact('p1', '/contact', {phones: ['(03) 260 1566']}, 'Call (03) 260 1566'),
      contact('p2', '/space/x/', {phones: ['032601566']}, 'Call 032601566'),
      contact('p3', '/space/y/', {phones: ['032601566']}, 'Call 032601566'),
    ]
    expect(findContradictions(pages)).toEqual([])
  })

  test('header value vs contact page value is still flagged', () => {
    const pages = [
      contact('p1', '/', {phones: ['09 555 0142']}, 'Call 09 555 0142'),
      contact('p2', '/services', {phones: ['09 555 0142']}, 'Call 09 555 0142'),
      contact('p3', '/contact', {phones: ['09 555 0198']}, 'Phone: 09 555 0198'),
    ]
    const [q] = findContradictions(pages)
    expect(q?.options).toEqual(['09 555 0142', '09 555 0198', 'None of these — I will clarify'])
  })
})

describe('findThinPages (URL variants)', () => {
  test('one question per path, variants folded into evidence', () => {
    const thin = [{kind: 'prose', text: 'Sign In Email Password Remember Me'}]
    const pages = [
      base({_id: 'a', path: '/member-login/', url: 'https://x.test/member-login/', sections: thin}),
      base({
        _id: 'b',
        path: '/member-login/',
        url: 'https://x.test/member-login/?logged_out=true',
        sections: thin,
      }),
    ]
    const qs = findThinPages(pages)
    expect(qs).toHaveLength(1)
    expect(qs[0]!.prompt).toContain('(2 URL variants)')
    expect(qs[0]!.evidence).toHaveLength(2)
  })
})

describe('findMissingMetaAlt', () => {
  test('flags missing meta description and alt', () => {
    const pages = [
      base({
        _id: 'p1',
        meta: {},
        images: [{src: 'https://acme.example/a.jpg', alt: ''}],
        sections: [
          {kind: 'prose', text: 'Plenty of words about plumbing services in Auckland city.'},
        ],
      }),
    ]
    const qs = findMissingMetaAlt(pages)
    expect(qs.some((q) => q.prompt.includes('meta description'))).toBe(true)
    expect(qs.some((q) => q.prompt.includes('alt text'))).toBe(true)
    expect(qs.every((q) => q.required === false)).toBe(true)
  })
})

describe('findHttpErrorPages', () => {
  test('keeps 404 pages as keep-or-kill', () => {
    const pages = [
      base({
        _id: 'gone',
        path: '/missing',
        httpStatus: 404,
        title: 'Not found',
        sections: [{kind: 'prose', text: 'Not found'}],
      }),
    ]
    const qs = findHttpErrorPages(pages)
    expect(qs).toHaveLength(1)
    expect(qs[0]!.kind).toBe('keep-or-kill')
    expect(qs[0]!.prompt).toContain('404')
  })
})

describe('findThinPages', () => {
  test('flags pages under 60 words', () => {
    const pages = [
      base({
        _id: 'thin',
        path: '/tiny',
        sections: [{kind: 'prose', text: 'Too short.'}],
      }),
    ]
    const qs = findThinPages(pages)
    expect(qs).toHaveLength(1)
    expect(qs[0]!.prompt).toMatch(/words/)
  })
})

describe('findBoilerplate', () => {
  test('detects Welcome to our website', () => {
    const pages = [
      base({
        _id: 'home',
        sections: [
          {
            kind: 'hero',
            text: 'Welcome to our website. We hope you enjoy your stay with Acme Plumbing.',
          },
        ],
      }),
    ]
    const qs = findBoilerplate(pages)
    expect(qs).toHaveLength(1)
    expect(qs[0]!.kind).toBe('authenticity')
    expect(qs[0]!.required).toBe(true)
    expect(qs[0]!.evidence[0]!.excerpt).toBe('Welcome to our website')
  })
})

describe('rankAndCap', () => {
  test('caps at 15 preferring required', () => {
    const many = Array.from({length: 20}, (_, i) => ({
      fingerprint: `f${i}`,
      kind: 'keep-or-kill' as const,
      prompt: `Q ${i}`,
      evidence: [{pageId: `p${i}`, url: `https://x.test/p${i}`, excerpt: 'x'}],
      options: ['a', 'b'],
      required: i < 3,
      source: 'claude' as const,
      spawnsTasks: false,
      rank: i,
    }))
    const capped = rankAndCap(many, 15)
    expect(capped).toHaveLength(15)
    expect(capped.filter((q) => q.required)).toHaveLength(3)
  })
})

describe('rankAndCap overlap', () => {
  const kok = (fingerprint: string, paths: string[], rank = 40) => ({
    fingerprint,
    kind: 'keep-or-kill' as const,
    prompt: fingerprint,
    evidence: paths.map((p) => ({pageId: p, url: `https://x.test${p}`, excerpt: 'x'})),
    options: ['a'],
    required: false,
    source: 'claude' as const,
    spawnsTasks: true,
    rank,
  })

  test('drops a thin-page question already covered by a wider keep-or-kill', () => {
    // hewahihaumaru: Claude asked about /member-login/ variants; thin-page asked again.
    const claude = kok('login-variants', ['/member-login/', '/member-login/?logged_out=true'], 45)
    const thin = kok('thin-login', ['/member-login/'])
    const other = kok('thin-reset', ['/password-reset/'])
    const out = rankAndCap([thin, claude, other]).map((q) => q.fingerprint)
    expect(out).toEqual(['login-variants', 'thin-reset'])
  })

  test('never drops required questions for overlap', () => {
    const wide = kok('wide', ['/a', '/b'])
    const req = {...kok('req', ['/a']), required: true}
    expect(rankAndCap([wide, req]).map((q) => q.fingerprint)).toContain('req')
  })
})

describe('collectDeterministicQuestions', () => {
  test('returns a mixed set for a messy site', () => {
    const pages = [
      base({
        _id: 'home',
        path: '/',
        meta: {description: 'ok'},
        sections: [
          {
            kind: 'hero',
            text: 'Welcome to our website. Call 021 152 6894 for service across Auckland.',
          },
        ],
        detectedEntities: {phones: ['021 152 6894'], emails: [], addresses: [], prices: []},
      }),
      base({
        _id: 'about',
        path: '/about',
        meta: {},
        sections: [{kind: 'prose', text: 'About us. Call 09 555 0100 please.'}],
        detectedEntities: {phones: ['09 555 0100'], emails: [], addresses: [], prices: []},
        images: [{src: 'https://acme.example/x.jpg'}],
      }),
      base({
        _id: 'gone',
        path: '/old',
        httpStatus: 404,
        title: 'Gone',
        sections: [{kind: 'prose', text: 'Gone'}],
      }),
    ]
    const qs = collectDeterministicQuestions(pages)
    expect(qs.some((q) => q.kind === 'contradiction')).toBe(true)
    expect(qs.some((q) => q.kind === 'authenticity')).toBe(true)
    expect(qs.some((q) => q.kind === 'keep-or-kill')).toBe(true)
    expect(qs.some((q) => q.kind === 'missing-info')).toBe(true)
  })
})
