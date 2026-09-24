import {createHash} from 'node:crypto'
import * as cheerio from 'cheerio'
import {extractEntities, type DetectedEntities} from './entities'
import {normaliseUrl} from '../crawl/http'
import {decodeCfEmailsInHtml, extractDurable} from './durable'
import {sanitizeStoredHtml} from './sanitizeHtml'

export interface ExhumedSection {
  kind: string
  html: string
  text: string
}

export interface ExhumedImage {
  src: string
  alt?: string
  width?: number
  height?: number
}

export interface ExtractedPage {
  url: string
  path: string
  httpStatus: number
  title?: string
  meta: {description?: string; ogImage?: string; canonical?: string}
  headings: string[]
  sections: ExhumedSection[]
  images: ExhumedImage[]
  links: string[]
  /** Non-HTML assets discovered (PDFs, images, zips) — not stored as pages (F10). */
  assetLinks: string[]
  detectedEntities: DetectedEntities
  contentHash: string
  html: string
}

function guessKind(text: string, html: string): string {
  const t = text.toLowerCase()
  if (/faq|frequently asked/i.test(t)) return 'faq'
  if (/testimonial|what our clients/i.test(t)) return 'testimonial'
  if (/contact|get in touch|phone|email/i.test(t)) return 'contact'
  if (/hero|welcome|we are/i.test(t) && html.includes('<h1')) return 'hero'
  if (html.includes('<form')) return 'form'
  return 'prose'
}

export function extractPage(args: {
  url: string
  status: number
  html: string
  origin: string
  platform?: string
}): ExtractedPage {
  const {url, status, origin} = args
  const {html: decodedHtml, emails: cfEmails} = decodeCfEmailsInHtml(args.html)
  const durable =
    args.platform === 'durable' || /cdn\.durable\.co|__NEXT_DATA__/i.test(decodedHtml)
      ? extractDurable(decodedHtml)
      : null

  const $ = cheerio.load(decodedHtml)
  $('script, style, noscript, iframe').remove()

  const title =
    durable?.title || $('title').first().text().trim() || $('h1').first().text().trim() || undefined
  const meta = {
    description:
      durable?.description || $('meta[name="description"]').attr('content')?.trim() || undefined,
    ogImage: $('meta[property="og:image"]').attr('content')?.trim(),
    canonical: $('link[rel="canonical"]').attr('href')?.trim(),
  }

  const headings = $('h1, h2, h3')
    .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter(Boolean)

  let sections: ExhumedSection[] = durable?.sections?.length ? [...durable.sections] : []
  if (sections.length === 0) {
    $('main section, article, main > div, .content, .entry-content')
      .slice(0, 40)
      .each((_, el) => {
        const node = $(el)
        const text = node.text().replace(/\s+/g, ' ').trim()
        if (text.length < 40) return
        const snip = $.html(el) ?? ''
        sections.push({
          kind: guessKind(text, snip),
          html: snip.slice(0, 4000),
          text: text.slice(0, 4000),
        })
      })
  }
  if (sections.length === 0) {
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim()
    if (bodyText) {
      sections.push({
        kind: 'prose',
        html: ($('body').html() ?? '').slice(0, 4000),
        text: bodyText.slice(0, 4000),
      })
    }
  }

  const images: ExhumedImage[] = []
  $('img[src]').each((_, el) => {
    const srcRaw = $(el).attr('src')
    if (!srcRaw || srcRaw.startsWith('data:')) return
    const src = normaliseUrl(srcRaw, url)
    if (!src) return
    const w = Number($(el).attr('width'))
    const h = Number($(el).attr('height'))
    images.push({
      src,
      alt: $(el).attr('alt') ?? undefined,
      width: Number.isFinite(w) ? w : undefined,
      height: Number.isFinite(h) ? h : undefined,
    })
  })

  const links: string[] = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return
    // Don't enqueue Cloudflare email-protection paths
    if (/\/cdn-cgi\/l\/email-protection/i.test(href)) return
    const abs = normaliseUrl(href, url)
    if (abs) links.push(abs)
  })

  const textBlob = [title, ...headings, ...sections.map((s) => s.text)].filter(Boolean).join('\n')
  const contentHash = createHash('sha256').update(textBlob).digest('hex').slice(0, 32)
  const entities = extractEntities(textBlob)
  if (cfEmails.length) {
    entities.emails = [...new Set([...entities.emails, ...cfEmails])]
  }

  let path = '/'
  try {
    path = new URL(url).pathname || '/'
  } catch {
    /* keep / */
  }

  return {
    url,
    path,
    httpStatus: status,
    title,
    meta: {
      description: meta.description,
      ogImage: meta.ogImage ? (normaliseUrl(meta.ogImage, origin) ?? meta.ogImage) : undefined,
      canonical: meta.canonical
        ? (normaliseUrl(meta.canonical, origin) ?? meta.canonical)
        : undefined,
    },
    headings,
    sections,
    images,
    links: [...new Set(links)],
    assetLinks: [],
    detectedEntities: entities,
    contentHash,
    html: sanitizeStoredHtml(args.html),
  }
}
