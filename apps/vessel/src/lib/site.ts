/**
 * Server-side data for a resurrected site. `site` → target dataset (showcase only for
 * now: dataset quota). Published by default; `?perspective=<releaseId>` previews the
 * release before Rise. Read with a server token; nothing here reaches the browser.
 */
import {createClient, type ClientPerspective, type SanityClient} from '@sanity/client'
import type {ManifestType, SiteSettings} from '@necro/bones/render'

export const SITES = ['showcase'] as const
export type Site = (typeof SITES)[number]

const projectId = process.env.SANITY_PROJECT_ID ?? 'v9dl2xdi'
const API_VERSION = '2025-08-15'

export function isSite(value: string): value is Site {
  return (SITES as readonly string[]).includes(value)
}

export function safeReleaseId(raw: string | string[] | undefined): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw
  return v && /^[a-zA-Z0-9_-]{1,64}$/.test(v) ? v : undefined
}

export function siteClient(site: Site, releaseId?: string): SanityClient {
  const token = (process.env.SANITY_READ_TOKEN ?? process.env.SANITY_HQ_WRITE_TOKEN ?? '').trim()
  const perspective: ClientPerspective = releaseId ? [releaseId] : 'published'
  return createClient({
    projectId,
    dataset: site,
    apiVersion: API_VERSION,
    useCdn: false,
    perspective,
    ...(token ? {token} : {}),
  })
}

export const imageContext = (site: Site) => ({projectId, dataset: site})

export type Owner = {
  seanceId?: string
  siteTitle?: string
  seanceUrl?: string
  releaseId?: string
  risenAt?: string
  collections?: Array<{type: string; route: string}>
  types: ManifestType[]
}

/** The showcase owner doc: which séance lives here, its collections and deployed schema. */
export async function getOwner(site: Site): Promise<Owner | null> {
  const raw = await siteClient(site)
    .withConfig({perspective: 'raw'})
    .fetch<(Omit<Owner, 'types'> & {schemaManifest?: string}) | null>(
      `*[_id == "necromancer.owner"][0]{seanceId, siteTitle, seanceUrl, releaseId, risenAt, collections, schemaManifest}`,
    )
  if (!raw) return null
  let types: ManifestType[] = []
  try {
    types = raw.schemaManifest ? (JSON.parse(raw.schemaManifest) as ManifestType[]) : []
  } catch {
    types = []
  }
  const {schemaManifest: _manifest, ...rest} = raw
  return {...rest, types}
}

export type NavItem = {title: string; path: string}

export async function getShell(
  client: SanityClient,
): Promise<{settings: SiteSettings; pages: NavItem[]}> {
  const data = await client.fetch<{
    settings: SiteSettings | null
    pages: Array<{title?: string; slug?: string}>
  }>(
    `{
      "settings": *[_type == "siteSettings"][0],
      "pages": *[_type == "page" && defined(slug.current)] | order(slug.current asc){title, "slug": slug.current}
    }`,
  )
  const pages = data.pages
    .filter((p) => p.slug && !p.slug.includes('/'))
    .map((p) => ({title: p.title ?? p.slug!, path: p.slug === 'home' ? '/' : `/${p.slug}`}))
    .sort((a, b) => (a.path === '/' ? -1 : b.path === '/' ? 1 : 0))
  return {settings: data.settings ?? {}, pages}
}

const LINKED = `{..., "internal": internal->{"slug": slug.current}}`

export async function getPage(client: SanityClient, slug: string) {
  return client.fetch<{
    _id: string
    title?: string
    seoTitle?: string
    seoDescription?: string
    body?: Array<{_type: string; _key?: string; [k: string]: unknown}>
  } | null>(
    `*[_type == "page" && slug.current == $slug][0]{
      _id, title, seoTitle, seoDescription,
      body[]{..., primaryCta${LINKED}, secondaryCta${LINKED}, button${LINKED}, cards[]{..., link${LINKED}}}
    }`,
    {slug},
  )
}

export async function getCollection(client: SanityClient, type: string) {
  return client.fetch<
    Array<{_id: string; _type: string; slug?: {current?: string}; [k: string]: unknown}>
  >(`*[_type == $type] | order(_id asc)`, {type})
}

export async function getCollectionDoc(client: SanityClient, type: string, slug: string) {
  return client.fetch<{_id: string; _type: string; [k: string]: unknown} | null>(
    `*[_type == $type && slug.current == $slug][0]`,
    {type, slug},
  )
}
