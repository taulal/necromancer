/**
 * 301s for resurrected sites (NEC-14): old paths (from `redirect` docs written by
 * reanimate) → new paths, cached per dataset + perspective for a minute. Trailing
 * slashes are normalised first, so "/about/" and "/about" are one page.
 */
import {NextResponse, type NextRequest} from 'next/server'

const SITES = new Set(['showcase'])
const TTL_MS = 60_000
const projectId = process.env.SANITY_PROJECT_ID ?? 'v9dl2xdi'
const cache = new Map<string, {at: number; map: Map<string, string>}>()

async function redirectsFor(site: string, releaseId?: string): Promise<Map<string, string>> {
  const cacheKey = `${site}:${releaseId ?? 'published'}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.map

  const token = (process.env.SANITY_READ_TOKEN ?? process.env.SANITY_HQ_WRITE_TOKEN ?? '').trim()
  const query = encodeURIComponent(
    '*[_type == "redirect" && defined(from) && defined(to)]{from, to}',
  )
  const perspective = releaseId ? releaseId : 'published'
  const map = new Map<string, string>()
  try {
    const res = await fetch(
      `https://${projectId}.api.sanity.io/v2025-08-15/data/query/${site}?query=${query}&perspective=${perspective}`,
      {headers: token ? {Authorization: `Bearer ${token}`} : {}, cache: 'no-store'},
    )
    if (res.ok) {
      const body = (await res.json()) as {result?: Array<{from: string; to: string}>}
      for (const r of body.result ?? []) map.set(r.from, r.to)
    }
  } catch {
    // Redirects are best-effort; the page still renders (or 404s) without them.
  }
  cache.set(cacheKey, {at: Date.now(), map})
  return map
}

export async function proxy(req: NextRequest) {
  const {pathname} = req.nextUrl
  const match = pathname.match(/^\/([^/]+)(\/.*)?$/)
  if (!match || !SITES.has(match[1]!)) return NextResponse.next()
  const site = match[1]!
  const rest = match[2] ?? '/'

  if (rest.length > 1 && rest.endsWith('/')) {
    const url = req.nextUrl.clone()
    url.pathname = `/${site}${rest.replace(/\/+$/, '')}`
    return NextResponse.redirect(url, 308)
  }

  const releaseParam = req.nextUrl.searchParams.get('perspective') ?? undefined
  const releaseId =
    releaseParam && /^[a-zA-Z0-9_-]{1,64}$/.test(releaseParam) ? releaseParam : undefined
  const to = (await redirectsFor(site, releaseId)).get(rest)
  if (to && to !== rest) {
    const url = req.nextUrl.clone()
    url.pathname = `/${site}${to === '/' ? '' : to}`
    return NextResponse.redirect(url, 301)
  }
  return NextResponse.next()
}

export const config = {matcher: ['/((?!api|_next|favicon.ico).*)']}
