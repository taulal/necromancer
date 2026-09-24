import {XMLParser} from 'fast-xml-parser'
import {fetchText, normaliseUrl, sameOrigin} from './http'

const parser = new XMLParser({ignoreAttributes: false, trimValues: true})

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

/** Collect sitemap URLs from robots.txt body + common defaults. */
export function sitemapCandidates(origin: string, robotsTxt: string): string[] {
  const found = [...robotsTxt.matchAll(/^\s*Sitemap:\s*(\S+)/gim)].map((m) => m[1]!).filter(Boolean)
  const defaults = ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml']
  const urls = [...found, ...defaults.map((p) => new URL(p, origin).toString())]
  return [...new Set(urls)]
}

export async function collectSitemapUrls(
  origin: string,
  robotsTxt: string,
  pageCap: number,
): Promise<string[]> {
  const out = new Set<string>()
  const queue = sitemapCandidates(origin, robotsTxt)

  while (queue.length && out.size < pageCap) {
    const smUrl = queue.shift()!
    let body: string
    try {
      const res = await fetchText(smUrl)
      if (!res.ok) continue
      body = res.body
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
  }

  return [...out]
}
