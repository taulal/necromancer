import {loadRobots, isAllowed} from './robots'
import {collectSitemapUrls} from './sitemap'
import {DEFAULT_CONCURRENCY, DEFAULT_PAGE_CAP, fetchText, normaliseUrl, sameOrigin} from './http'
import {detectPlatform, type Platform} from '../fingerprints'
import {extractPage, type ExtractedPage} from '../extract/page'
import {extractBrand, type BrandExtraction} from '../extract/brand'
import {detectChrome} from '../extract/chrome'

export interface CrawlProgress {
  fetched: number
  totalHint: number
  currentUrl?: string
}

export interface CrawlResult {
  origin: string
  platform: Platform
  platformConfidence: number
  platformHits: string[]
  brand: BrandExtraction
  chromeBlocks: string[]
  pages: ExtractedPage[]
  stats: {pages: number; images: number; words: number; links: number}
}

export interface CrawlOptions {
  url: string
  pageCap?: number
  concurrency?: number
  onProgress?: (p: CrawlProgress) => void | Promise<void>
  /** Injected fetch for tests. */
  fetchPage?: typeof fetchText
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  let i = 0
  const workers = Array.from({length: Math.min(concurrency, items.length)}, async () => {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx]!)
    }
  })
  await Promise.all(workers)
  return results
}

export async function crawl(options: CrawlOptions): Promise<CrawlResult> {
  const pageCap = options.pageCap ?? DEFAULT_PAGE_CAP
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY
  const fetchPage = options.fetchPage ?? fetchText

  const start = normaliseUrl(options.url, options.url)
  if (!start) throw new Error(`Invalid start URL: ${options.url}`)
  const origin = new URL(start).origin

  const robots = await loadRobots(origin)
  let robotsTxt = ''
  try {
    const r = await fetchPage(new URL('/robots.txt', origin).toString())
    if (r.ok) robotsTxt = r.body
  } catch {
    /* empty */
  }

  const fromSitemap = await collectSitemapUrls(origin, robotsTxt, pageCap)
  const queue: string[] = []
  const seen = new Set<string>()
  const enqueue = (u: string) => {
    const n = normaliseUrl(u, origin)
    if (!n || seen.has(n) || !sameOrigin(n, origin)) return
    if (!isAllowed(robots, n)) return
    seen.add(n)
    queue.push(n)
  }

  for (const u of fromSitemap) enqueue(u)
  enqueue(start)
  enqueue(new URL('/', origin).toString())

  const pages: ExtractedPage[] = []
  let platform: Platform = 'unknown'
  let platformConfidence = 0.1
  let platformHits: string[] = []
  let brand: BrandExtraction = {colors: [], fonts: []}

  while (queue.length && pages.length < pageCap) {
    const batch = queue.splice(0, Math.min(concurrency, pageCap - pages.length))
    const batchResults = await mapPool(batch, concurrency, async (url) => {
      await options.onProgress?.({
        fetched: pages.length,
        totalHint: Math.min(pageCap, seen.size),
        currentUrl: url,
      })
      try {
        const res = await fetchPage(url)
        return {url, res}
      } catch (err) {
        return {
          url,
          res: {
            ok: false,
            status: 0,
            headers: new Headers(),
            body: '',
            finalUrl: url,
            error: err,
          },
        }
      }
    })

    for (const row of batchResults) {
      if (pages.length >= pageCap) break
      const {url, res} = row
      if (!res.body && res.status === 0) continue

      if (pages.length === 0 || platform === 'unknown' || platform === 'static') {
        const verdict = detectPlatform(res.body, res.headers)
        if (verdict.confidence >= platformConfidence) {
          platform = verdict.platform
          platformConfidence = verdict.confidence
          platformHits = verdict.hits
        }
      }

      if (pages.length === 0) {
        brand = extractBrand(res.body, url)
      }

      const page = extractPage({
        url: res.finalUrl || url,
        status: res.status,
        html: res.body,
        origin,
      })
      pages.push(page)

      if (pages.length < pageCap) {
        for (const link of page.links) enqueue(link)
      }

      await options.onProgress?.({
        fetched: pages.length,
        totalHint: Math.min(pageCap, Math.max(seen.size, pages.length)),
        currentUrl: url,
      })
    }
  }

  const chromeBlocks = detectChrome(pages.map((p) => p.sections.map((s) => s.text).join('\n')))
  const images = new Set(pages.flatMap((p) => p.images.map((i) => i.src)))
  const links = new Set(pages.flatMap((p) => p.links))
  const words = pages.reduce(
    (n, p) => n + p.sections.reduce((m, s) => m + s.text.split(/\s+/).filter(Boolean).length, 0),
    0,
  )

  return {
    origin,
    platform,
    platformConfidence,
    platformHits,
    brand,
    chromeBlocks,
    pages,
    stats: {pages: pages.length, images: images.size, words, links: links.size},
  }
}
