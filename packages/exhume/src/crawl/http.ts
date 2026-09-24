export const USER_AGENT = 'NecromancerBot (+https://github.com/taulal/necromancer)'
export const FETCH_TIMEOUT_MS = 10_000
export const DEFAULT_PAGE_CAP = 50
export const DEFAULT_CONCURRENCY = 5

export async function fetchText(
  url: string,
  init?: RequestInit,
): Promise<{ok: boolean; status: number; headers: Headers; body: string; finalUrl: string}> {
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
    const body = await res.text()
    return {ok: res.ok, status: res.status, headers: res.headers, body, finalUrl: res.url}
  } finally {
    clearTimeout(timer)
  }
}

export function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin
  } catch {
    return false
  }
}

export function normaliseUrl(href: string, base: string): string | null {
  try {
    const u = new URL(href, base)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    u.hash = ''
    // Drop common tracking params
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
