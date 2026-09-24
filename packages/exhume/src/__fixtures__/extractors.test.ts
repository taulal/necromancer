import {readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {describe, expect, test} from 'vitest'
import {detectPlatform} from '../fingerprints'
import {extractEntities} from '../extract/entities'
import {extractPage} from '../extract/page'
import {extractBrand} from '../extract/brand'
import {detectChrome} from '../extract/chrome'

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
