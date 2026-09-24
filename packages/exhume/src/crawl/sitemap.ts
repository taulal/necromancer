import {XMLParser} from 'fast-xml-parser'
import {fetchText, normaliseUrl, sameOrigin} from './http'

const parser = new XMLParser({ignoreAttributes: false, trimValues: true})

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

/** True when body looks like a sitemap (not HTML soft-404). */
export function looksLikeSitemapXml(body: string, contentType?: string | null): boolean {
  const ct = (contentType ?? '').split(';')[0]!.trim().toLowerCase()
  if (ct.includes('html')) return false
  const trimmed = body.trimStart()
  if (/^<!doctype\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) return false
  if (ct.includes('xml')) return true
  return trimmed.startsWith('<?xml') || /<(urlset|sitemapindex)[\s>]/i.test(trimmed.slice(0, 500))
}

/** Collect sitemap URLs from robots.txt body + common defaults. */
export function sitemapCandidates(origin: string, robotsTxt: string): string[] {
  const found = [...robotsTxt.matchAll(/^\s*Sitemap:\s*(\S+)/gim)].map((m) => m[1]!).filter(Boolean)
  const defaults = ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml', '/sitemap']
  const urls = [...found, ...defaults.map((p) => new URL(p, origin).toString())]
  return [...new Set(urls)]
}

export async function collectSitemapUrls(
  origin: string,
  robotsTxt: string,
  pageCap: number,
  fetchPage: typeof fetchText = fetchText,
): Promise<string[]> {
  const out = new Set<string>()
  const queue = sitemapCandidates(origin, robotsTxt)

  while (queue.length && out.size < pageCap) {
    const smUrl = queue.shift()!
    let body: string
    let contentType: string | null = null
    try {
      const res = await fetchPage(smUrl)
      if (!res.ok || !res.body) continue
      // Soft-404: Durable (and others) return 200 HTML for /sitemap.xml
      if (!looksLikeSitemapXml(res.body, res.headers.get('content-type'))) continue
      body = res.body
      contentType = res.headers.get('content-type')
    } catch {
      continue
    }

    let xml: unknown
    try {
      xml = parser.parse(body)
    } catch {
      continue
    }

    const root = xml as {
      sitemapindex?: {sitemap?: {loc?: string} | {loc?: string}[]}
      urlset?: {url?: {loc?: string} | {loc?: string}[]}
    }

    for (const sm of asArray(root.sitemapindex?.sitemap)) {
      if (sm?.loc) queue.push(sm.loc)
    }
    for (const u of asArray(root.urlset?.url)) {
      if (!u?.loc) continue
      const norm = normaliseUrl(u.loc, origin)
      if (norm && sameOrigin(norm, origin)) out.add(norm)
      if (out.size >= pageCap) break
    }

    void contentType
  }

  return [...out]
}
