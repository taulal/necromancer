/**
 * Platform fingerprints, lifted from runbooks/wp-modernisation-runbook.md.
 * TODO(NEC-08): add confidence weighting + header checks (x-powered-by, server, x-wix-*).
 */
export type Platform = 'wordpress' | 'durable' | 'wix' | 'squarespace' | 'webflow' | 'static' | 'unknown'

export const FINGERPRINTS: Record<Exclude<Platform, 'static' | 'unknown'>, RegExp[]> = {
  wordpress: [/wp-content\//, /wp-json\//, /<meta[^>]+generator[^>]+WordPress/i],
  durable: [/cdn\.durable\.co/, /durable\.co/],
  wix: [/static\.wixstatic\.com/, /wixsite\.com/],
  squarespace: [/squarespace\.com/, /static1\.squarespace/],
  webflow: [/webflow\.com/, /data-wf-page/],
}

export function detectPlatform(html: string): {platform: Platform; hits: string[]} {
  for (const [platform, patterns] of Object.entries(FINGERPRINTS)) {
    const hits = patterns.filter((p) => p.test(html)).map(String)
    if (hits.length) return {platform: platform as Platform, hits}
  }
  return {platform: html.trim() ? 'static' : 'unknown', hits: []}
}
