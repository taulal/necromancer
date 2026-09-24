import {readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {describe, expect, test} from 'vitest'
import {detectPlatform} from '../fingerprints'
import {extractEntities} from '../extract/entities'
import {extractPage} from '../extract/page'
import {extractBrand} from '../extract/brand'
import {detectChrome} from '../extract/chrome'
import {decodeCfEmail, extractDurable} from '../extract/durable'
import {sanitizeStoredHtml} from '../extract/sanitizeHtml'
import {looksLikeSitemapXml} from '../crawl/sitemap'
import {sameOrigin} from '../crawl/http'
import {crawl} from '../crawl/crawl'
import type {FetchResult} from '../crawl/http'

const dir = dirname(fileURLToPath(import.meta.url))
const load = (name: string) => readFileSync(join(dir, name), 'utf8')

describe('detectPlatform', () => {
  test('wordpress fixture', () => {
    const html = load('wordpress-home.html')
    const v = detectPlatform(html)
    expect(v.platform).toBe('wordpress')
    expect(v.confidence).toBeGreaterThan(0.5)
  })

  test('durable fixture', () => {
    const html = load('durable-home.html')
    const v = detectPlatform(html)
    expect(v.platform).toBe('durable')
  })

  test('static when no CMS markers', () => {
    const v = detectPlatform('<html><body><p>Hello</p></body></html>')
    expect(v.platform).toBe('static')
  })
})

describe('extractEntities', () => {
  test('finds NZ phone, email, price, address', () => {
    const html = load('wordpress-home.html')
    const page = extractPage({
      url: 'https://acme.example/',
      status: 200,
      html,
      origin: 'https://acme.example',
    })
    expect(page.detectedEntities.phones.some((p) => p.includes('021'))).toBe(true)
    expect(page.detectedEntities.emails).toContain('hello@acme-plumbing.example')
    expect(page.detectedEntities.prices.some((p) => p.includes('120'))).toBe(true)
    expect(page.detectedEntities.addresses.length).toBeGreaterThan(0)
  })
})

describe('extractBrand', () => {
  test('picks colours, fonts and logo', () => {
    const html = load('wordpress-home.html')
    const brand = extractBrand(html, 'https://acme.example/')
    expect(brand.colors.length).toBeGreaterThan(0)
    expect(brand.fonts.some((f) => /Helvetica/i.test(f))).toBe(true)
    expect(brand.logo).toMatch(/logo\.png/)
  })
})

describe('detectChrome', () => {
  test('flags repeated blocks across pages', () => {
    const chrome = 'Home About Contact © Acme Plumbing · Privacy · Terms'
    const pages = [
      `${chrome}\nUnique home content about pipes`,
      `${chrome}\nUnique about content about the team`,
      `${chrome}\nUnique contact content with a form`,
    ]
    const found = detectChrome(pages)
    expect(found.some((b) => b.includes('Acme Plumbing'))).toBe(true)
  })
})

describe('extractEntities standalone', () => {
  test('uk and au phones', () => {
    const e = extractEntities('Call +44 20 7946 0958 or 04 1234 5678 for AU$99')
    expect(e.phones.length).toBeGreaterThan(0)
    expect(e.prices.length).toBeGreaterThan(0)
  })
})

describe('F8 sameOrigin apex↔www', () => {
  test('treats apex and www as same site', () => {
    expect(sameOrigin('https://example.com/a', 'https://www.example.com/b')).toBe(true)
    expect(sameOrigin('https://www.example.com/', 'https://example.com/')).toBe(true)
    expect(sameOrigin('https://example.com/', 'https://other.com/')).toBe(false)
  })

  test('crawl locks origin to finalUrl after redirect', async () => {
    const pages = new Map<string, FetchResult>([
      [
        'https://target.example/',
        {
          ok: true,
          status: 200,
          headers: new Headers({'content-type': 'text/html'}),
          body: '<html><body><a href="/about">About</a><p>Home page content here with enough text.</p></body></html>',
          finalUrl: 'https://www.target.example/',
          kind: 'html',
        },
      ],
      [
        'https://www.target.example/robots.txt',
        {
          ok: true,
          status: 200,
          headers: new Headers({'content-type': 'text/plain'}),
          body: 'User-agent: *\nAllow: /\n',
          finalUrl: 'https://www.target.example/robots.txt',
          kind: 'html',
        },
      ],
      [
        'https://www.target.example/',
        {
          ok: true,
          status: 200,
          headers: new Headers({'content-type': 'text/html'}),
          body: '<html><body><a href="/about">About</a><main><section><p>Home page content here with enough text for section.</p></section></main></body></html>',
          finalUrl: 'https://www.target.example/',
          kind: 'html',
        },
      ],
      [
        'https://www.target.example/about',
        {
          ok: true,
          status: 200,
          headers: new Headers({'content-type': 'text/html'}),
          body: '<html><body><main><section><p>About page content here with enough text for section extract.</p></section></main></body></html>',
          finalUrl: 'https://www.target.example/about',
          kind: 'html',
        },
      ],
    ])

    const fetchPage = async (url: string): Promise<FetchResult> => {
      const hit = pages.get(url)
      if (hit) return hit
      // sitemap defaults miss
      if (url.includes('sitemap')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({'content-type': 'text/html'}),
          body: '<!doctype html><html><body>soft 404</body></html>',
          finalUrl: url,
          kind: 'html',
        }
      }
      return {
        ok: false,
        status: 404,
        headers: new Headers(),
        body: '',
        finalUrl: url,
        kind: 'empty',
      }
    }

    const result = await crawl({
      url: 'https://target.example/',
      pageCap: 10,
      fetchPage,
    })
    expect(result.origin).toBe('https://www.target.example')
    expect(result.pages.length).toBeGreaterThanOrEqual(2)
  })
})

describe('F9 sanitizeStoredHtml', () => {
  test('strips Durable privacy fields from __NEXT_DATA__', () => {
    const html = load('durable-home.html')
    const out = sanitizeStoredHtml(html)
    expect(out).not.toMatch(/ipAddress/)
    expect(out).not.toMatch(/captchaKey/)
    expect(out).not.toMatch(/apiUrl/)
    expect(out).toMatch(/__NEXT_DATA__/)
    expect(out).toMatch(/Built to last/)
  })
})

describe('F10 non-HTML assets', () => {
  test('records PDF as asset link, not a page', async () => {
    const fetchPage = async (url: string): Promise<FetchResult> => {
      if (url === 'https://site.example/' || url === 'https://site.example') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({'content-type': 'text/html'}),
          body: '<html><body><main><section><p>Home with a <a href="/brochure.pdf">PDF</a> link and enough text here.</p></section></main></body></html>',
          finalUrl: 'https://site.example/',
          kind: 'html',
        }
      }
      if (url.endsWith('/brochure.pdf')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({'content-type': 'application/pdf'}),
          body: '',
          finalUrl: url,
          kind: 'asset',
        }
      }
      if (url.includes('robots')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          body: '',
          finalUrl: url,
          kind: 'empty',
        }
      }
      if (url.includes('sitemap')) {
        return {
          ok: false,
          status: 404,
          headers: new Headers(),
          body: '',
          finalUrl: url,
          kind: 'empty',
        }
      }
      return {
        ok: false,
        status: 404,
        headers: new Headers(),
        body: '',
        finalUrl: url,
        kind: 'empty',
      }
    }

    const result = await crawl({url: 'https://site.example/', pageCap: 10, fetchPage})
    expect(result.pages.every((p) => !p.url.endsWith('.pdf'))).toBe(true)
    expect(result.assetLinks.some((u) => u.endsWith('/brochure.pdf'))).toBe(true)
  })
})

describe('F11 durable + cfemail + sitemap soft-404', () => {
  test('Durable adapter maps blocks and seo', () => {
    const html = load('durable-home.html')
    const d = extractDurable(html)
    expect(d).not.toBeNull()
    expect(d!.sections.some((s) => s.kind === 'hero')).toBe(true)
    expect(d!.sections.some((s) => s.kind === 'mediaText')).toBe(true)
    expect(d!.sections.some((s) => s.kind === 'cardGrid')).toBe(true)
    expect(d!.title).toMatch(/PNJ Build/)
    expect(d!.colors).toContain('#2B6BE7')
    expect(d!.fonts.some((f) => /Madefor/i.test(f))).toBe(true)
  })

  test('extractPage uses Durable sections and strips privacy in stored html', () => {
    const html = load('durable-home.html')
    const page = extractPage({
      url: 'https://pnjbuild.example/',
      status: 200,
      html,
      origin: 'https://pnjbuild.example',
      platform: 'durable',
    })
    expect(page.sections.some((s) => s.kind === 'hero')).toBe(true)
    expect(page.html).not.toMatch(/captchaKey/)
    expect(page.title).toMatch(/Quality Construction/)
  })

  test('decodeCfEmail XOR', () => {
    // key 0x4f, email hello@x.co
    const email = 'hello@x.co'
    const key = 0x4f
    let hex = key.toString(16).padStart(2, '0')
    for (const ch of email) hex += (ch.charCodeAt(0) ^ key).toString(16).padStart(2, '0')
    expect(decodeCfEmail(hex)).toBe(email)
  })

  test('sitemap soft-404 HTML is rejected', () => {
    expect(
      looksLikeSitemapXml('<!doctype html><html><body>catch-all</body></html>', 'text/html'),
    ).toBe(false)
    expect(
      looksLikeSitemapXml(
        '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
        'application/xml',
      ),
    ).toBe(true)
    expect(
      looksLikeSitemapXml('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'),
    ).toBe(true)
  })
})
