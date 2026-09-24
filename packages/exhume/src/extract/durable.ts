/**
 * Decode Cloudflare email protection (`data-cfemail`) and Durable __NEXT_DATA__ adapter.
 */
import * as cheerio from 'cheerio'
import type {ExhumedSection} from './page'

/** Cloudflare obfuscation: first byte is XOR key (review F11). */
export function decodeCfEmail(hex: string): string {
  const key = parseInt(hex.slice(0, 2), 16)
  if (Number.isNaN(key)) return ''
  let out = ''
  for (let i = 2; i < hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16) ^ key
    if (Number.isNaN(code)) return ''
    out += String.fromCharCode(code)
  }
  return out
}

/** Replace cfemail anchors with mailto:decoded in-place on a cheerio root. */
export function decodeCfEmailsInHtml(html: string): {html: string; emails: string[]} {
  const $ = cheerio.load(html)
  const emails: string[] = []
  $('[data-cfemail]').each((_, el) => {
    const hex = $(el).attr('data-cfemail')
    if (!hex) return
    const decoded = decodeCfEmail(hex)
    if (!decoded) return
    emails.push(decoded)
    $(el).attr('href', `mailto:${decoded}`)
    $(el).text(decoded)
    $(el).removeAttr('data-cfemail')
  })
  // Also catch /cdn-cgi/l/email-protection#HEX links
  $('a[href*="/cdn-cgi/l/email-protection"]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    const m = href.match(/#([a-f0-9]+)$/i)
    if (!m?.[1]) return
    const decoded = decodeCfEmail(m[1])
    if (!decoded) return
    emails.push(decoded)
    $(el).attr('href', `mailto:${decoded}`)
    if (!$(el).text().trim()) $(el).text(decoded)
  })
  return {html: $.html(), emails: [...new Set(emails)]}
}

const BLOCK_KIND: Record<string, string> = {
  banner: 'hero',
  about: 'mediaText',
  services: 'cardGrid',
  quote: 'testimonial',
  'image-carousel': 'gallery',
  contact: 'contactBlock',
}

export interface DurableExtraction {
  sections: ExhumedSection[]
  title?: string
  description?: string
  colors: string[]
  fonts: string[]
  brandName?: string
}

type NextData = {
  props?: {
    pageProps?: {
      page?: {
        blocks?: Array<{
          type?: string
          headline?: string
          content?: string
          items?: unknown[]
          buttons?: unknown[]
          image?: unknown
        }>
        seo?: {title?: string; description?: string; keywords?: string}
      }
      website?: {
        primaryColor?: string
        secondaryColor?: string
        colorPalette?: {Palette?: {colors?: Array<{hex?: string; value?: string}>}}
        fonts?: {head?: {family?: string}; body?: {family?: string}}
        Business?: {name?: string}
      }
    }
  }
}

function parseNextData(html: string): NextData | null {
  const m = html.match(/<script[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)
  if (!m?.[1]) return null
  try {
    return JSON.parse(m[1]) as NextData
  } catch {
    return null
  }
}

/** When Durable is detected, prefer __NEXT_DATA__ over DOM scrape (review F11). */
export function extractDurable(html: string): DurableExtraction | null {
  const data = parseNextData(html)
  const pageProps = data?.props?.pageProps
  if (!pageProps?.page?.blocks?.length) return null

  const sections: ExhumedSection[] = []
  for (const block of pageProps.page.blocks) {
    const type = block.type ?? 'prose'
    const kind = BLOCK_KIND[type] ?? type
    const parts = [
      block.headline,
      typeof block.content === 'string' ? block.content : undefined,
      block.items ? JSON.stringify(block.items).slice(0, 2000) : undefined,
    ].filter(Boolean)
    const text = parts.join('\n').replace(/\s+/g, ' ').trim()
    if (!text) continue
    sections.push({
      kind,
      html: `<section data-durable-block="${type}"><h2>${block.headline ?? ''}</h2><p>${block.content ?? ''}</p></section>`,
      text: text.slice(0, 4000),
    })
  }

  const website = pageProps.website
  const colors = [
    website?.primaryColor,
    website?.secondaryColor,
    ...(website?.colorPalette?.Palette?.colors?.map((c) => c.hex ?? c.value) ?? []),
  ].filter((c): c is string => Boolean(c))

  const fonts = [website?.fonts?.head?.family, website?.fonts?.body?.family].filter(
    (f): f is string => Boolean(f),
  )

  return {
    sections,
    title: pageProps.page.seo?.title,
    description: pageProps.page.seo?.description,
    colors: [...new Set(colors)],
    fonts: [...new Set(fonts)],
    brandName: website?.Business?.name,
  }
}
