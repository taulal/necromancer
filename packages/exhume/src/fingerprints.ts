/**
 * Platform fingerprints (BRIEF.md §7.1). Confidence from hit count + response headers.
 */
export type Platform =
  'wordpress' | 'durable' | 'wix' | 'squarespace' | 'webflow' | 'static' | 'unknown'

export const FINGERPRINTS: Record<Exclude<Platform, 'static' | 'unknown'>, RegExp[]> = {
  wordpress: [/wp-content\//, /wp-json\//, /<meta[^>]+generator[^>]+WordPress/i],
  durable: [/cdn\.durable\.co/, /durable\.co/],
  wix: [/static\.wixstatic\.com/, /wixsite\.com/, /X-Wix-/i],
  squarespace: [/squarespace\.com/, /static1\.squarespace/],
  webflow: [/webflow\.com/, /data-wf-page/],
}

const HEADER_HINTS: Partial<Record<Platform, RegExp[]>> = {
  wordpress: [/wordpress/i, /wp\s*engine/i],
  wix: [/wix/i],
  squarespace: [/squarespace/i],
  webflow: [/webflow/i],
  durable: [/durable/i],
}

export function detectPlatform(
  html: string,
  headers?: Headers | Record<string, string>,
): {platform: Platform; hits: string[]; confidence: number} {
  const headerHits: string[] = []
  const get = (name: string) => {
    if (!headers) return null
    if (headers instanceof Headers) return headers.get(name)
    const found = Object.entries(headers).find(([k]) => k.toLowerCase() === name.toLowerCase())
    return found?.[1] ?? null
  }
  const server = [get('server'), get('x-powered-by'), get('x-wix-request-id')]
    .filter(Boolean)
    .join(' ')

  let best: {platform: Platform; hits: string[]; score: number} | null = null

  for (const [platform, patterns] of Object.entries(FINGERPRINTS) as [
    Exclude<Platform, 'static' | 'unknown'>,
    RegExp[],
  ][]) {
    const hits = patterns.filter((p) => p.test(html)).map(String)
    const hdrPatterns = HEADER_HINTS[platform] ?? []
    for (const p of hdrPatterns) {
      if (server && p.test(server)) {
        hits.push(`header:${p}`)
        headerHits.push(platform)
      }
    }
    if (hits.length) {
      const score = hits.length / Math.max(patterns.length, 1)
      if (!best || score > best.score) best = {platform, hits, score}
    }
  }

  if (best) {
    return {
      platform: best.platform,
      hits: best.hits,
      confidence: Math.min(0.97, 0.55 + best.score * 0.4),
    }
  }

  if (html.trim()) return {platform: 'static', hits: [], confidence: 0.6}
  return {platform: 'unknown', hits: [], confidence: 0.1}
}
