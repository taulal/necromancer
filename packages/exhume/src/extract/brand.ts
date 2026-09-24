import * as cheerio from 'cheerio'

export interface BrandExtraction {
  colors: string[]
  fonts: string[]
  logo?: string
  name?: string
}

const HEX_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g

export function extractBrand(html: string, pageUrl: string): BrandExtraction {
  const $ = cheerio.load(html)
  const styleText = $('style')
    .map((_, el) => $(el).html() ?? '')
    .get()
    .join('\n')

  const colorCounts = new Map<string, number>()
  for (const m of styleText.match(HEX_RE) ?? []) {
    const key = m.toLowerCase()
    colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1)
  }
  // CSS custom props
  for (const m of styleText.matchAll(/--[a-zA-Z0-9-]*color[a-zA-Z0-9-]*\s*:\s*([^;]+)/gi)) {
    const hex = m[1]?.match(HEX_RE)?.[0]
    if (hex) colorCounts.set(hex.toLowerCase(), (colorCounts.get(hex.toLowerCase()) ?? 0) + 3)
  }
  const colors = [...colorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([c]) => c)

  const fonts = [
    ...new Set(
      [...styleText.matchAll(/font-family\s*:\s*([^;!}{]+)/gi)]
        .map((m) => m[1]?.trim())
        .filter(Boolean) as string[],
    ),
  ].slice(0, 6)

  let logo: string | undefined
  const headerImg =
    $('header img[src], .site-logo img[src], .logo img[src], a[rel="home"] img[src]')
      .first()
      .attr('src') ||
    $('meta[property="og:image"]').attr('content') ||
    $('link[rel="icon"]').attr('href') ||
    $('link[rel="shortcut icon"]').attr('href')
  if (headerImg) {
    try {
      logo = new URL(headerImg, pageUrl).toString()
    } catch {
      logo = headerImg
    }
  }

  return {colors, fonts, logo}
}
