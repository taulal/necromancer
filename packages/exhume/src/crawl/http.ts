export const USER_AGENT = 'NecromancerBot (+https://github.com/taulal/necromancer)'
export const FETCH_TIMEOUT_MS = 10_000
export const DEFAULT_PAGE_CAP = 50
export const DEFAULT_CONCURRENCY = 5
/** Abort reading bodies larger than this (review F10). */
export const MAX_BODY_BYTES = 5 * 1024 * 1024

export type FetchKind = 'html' | 'xml' | 'asset' | 'empty' | 'error'

export interface FetchResult {
  ok: boolean
  status: number
  headers: Headers
  body: string
  finalUrl: string
  kind: FetchKind
  error?: unknown
}

function contentType(headers: Headers): string {
  return (headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
}

function classify(ct: string, url: string): FetchKind {
  if (ct === 'text/html' || ct === 'application/xhtml+xml') return 'html'
  if (
    ct === 'application/xml' ||
    ct === 'text/xml' ||
    ct === 'application/rss+xml' ||
    ct === 'application/atom+xml' ||
    /\.xml(\?|$)/i.test(url)
  ) {
    return 'xml'
  }
  if (!ct) {
    // No content-type: sniff later; treat as html candidate for pages, xml for sitemaps
    return 'html'
  }
  return 'asset'
}

async function readBodyCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return ''
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const {done, value} = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new Error(`body exceeds ${maxBytes} bytes`)
    }
    chunks.push(value)
  }
  const merged = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    merged.set(c, offset)
    offset += c.byteLength
  }
  return new TextDecoder('utf-8').decode(merged)
}

export async function fetchText(url: string, init?: RequestInit): Promise<FetchResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      ...init,
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...(init?.headers ?? {}),
      },
    })
    const ct = contentType(res.headers)
    const kind = classify(ct, url)

    // F10: skip non-HTML/XML bodies (PDFs, images, zips) — don't buffer them.
    if (kind === 'asset') {
      try {
        await res.body?.cancel()
      } catch {
        /* ignore */
      }
      return {
        ok: res.ok,
        status: res.status,
        headers: res.headers,
        body: '',
        finalUrl: res.url,
        kind: 'asset',
      }
    }

    let body: string
    try {
      body = await readBodyCapped(res, MAX_BODY_BYTES)
    } catch (err) {
      return {
        ok: false,
        status: res.status,
        headers: res.headers,
        body: '',
        finalUrl: res.url,
        kind: 'error',
        error: err,
      }
    }

    return {
      ok: res.ok,
      status: res.status,
      headers: res.headers,
      body,
      finalUrl: res.url,
      kind: body ? kind : 'empty',
    }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      headers: new Headers(),
      body: '',
      finalUrl: url,
      kind: 'error',
      error: err,
    }
  } finally {
    clearTimeout(timer)
  }
}

/** True when hosts match, or apex ↔ www only (review F8). */
export function sameOrigin(a: string, b: string): boolean {
  try {
    const ua = new URL(a)
    const ub = new URL(b)
    if (ua.protocol !== ub.protocol) return false
    if (ua.origin === ub.origin) return true
    const ha = ua.hostname.replace(/^www\./i, '').toLowerCase()
    const hb = ub.hostname.replace(/^www\./i, '').toLowerCase()
    return ha === hb
  } catch {
    return false
  }
}

export function normaliseUrl(href: string, base: string): string | null {
  try {
    const u = new URL(href, base)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    u.hash = ''
    ;[
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
    ].forEach((k) => u.searchParams.delete(k))
    return u.toString()
  } catch {
    return null
  }
}
