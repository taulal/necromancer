/**
 * Derive séance slug from hostname (review F7).
 * `https://www.pnjbuild.co.nz` → `pnjbuild` (not `https-pnjbuild-co-nz`).
 */
const MULTI_TLDS = [
  '.co.nz',
  '.org.nz',
  '.net.nz',
  '.ac.nz',
  '.co.uk',
  '.org.uk',
  '.com.au',
  '.net.au',
  '.org.au',
]

export function slugFromUrl(url: string): string {
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return ''
  }
  host = host.replace(/^www\./i, '').toLowerCase()
  if (!host) return ''

  let base = host
  for (const tld of MULTI_TLDS) {
    if (host.endsWith(tld)) {
      base = host.slice(0, -tld.length)
      break
    }
  }
  if (base === host) {
    const parts = host.split('.').filter(Boolean)
    base = parts.length > 1 ? parts.slice(0, -1).join('.') : parts[0]!
  }

  return base
    .split('.')
    .join('-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
}
