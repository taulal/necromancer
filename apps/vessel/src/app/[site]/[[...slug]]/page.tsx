/**
 * Renders a resurrected dataset (NEC-14). Routes:
 *   /[site]                → page "home"
 *   /[site]/<route>        → collection index (from the deployed anatomy) or page
 *   /[site]/<route>/<slug> → collection doc (schema-driven fallback renderer)
 *   /[site]/<a>/<b>        → nested page slug
 * `?perspective=<releaseId>` previews the release (Rise screen iframe).
 */
import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {BonesBody, FallbackCard, FallbackDoc, type RenderContext} from '@necro/bones/render'
import {SiteShell} from '../../../components/SiteShell'
import {
  getCollection,
  getCollectionDoc,
  getOwner,
  getPage,
  getShell,
  imageContext,
  isSite,
  safeReleaseId,
  siteClient,
  type Site,
} from '../../../lib/site'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{site: string; slug?: string[]}>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function context(site: Site, releaseId?: string): RenderContext {
  const q = releaseId ? `?perspective=${releaseId}` : ''
  return {...imageContext(site), href: (path: string) => `/${site}${path === '/' ? '' : path}${q}`}
}

export async function generateMetadata({params, searchParams}: Props): Promise<Metadata> {
  const {site, slug = []} = await params
  if (!isSite(site)) return {}
  const client = siteClient(site, safeReleaseId((await searchParams).perspective))
  const [page, shell] = await Promise.all([
    getPage(client, slug.join('/') || 'home'),
    getShell(client),
  ])
  const siteTitle = shell.settings.siteTitle
  const title = page?.seoTitle ?? [page?.title, siteTitle].filter(Boolean).join(' | ')
  return {title: title || siteTitle || 'Vessel', description: page?.seoDescription}
}

export default async function SitePage({params, searchParams}: Props) {
  const {site, slug = []} = await params
  if (!isSite(site)) notFound()
  const releaseId = safeReleaseId((await searchParams).perspective)
  const client = siteClient(site, releaseId)
  const ctx = context(site, releaseId)
  const [owner, shell] = await Promise.all([getOwner(site), getShell(client)])

  const collections = owner?.collections ?? []
  const nav = [
    ...shell.pages,
    ...collections.map((c) => ({
      title: owner?.types.find((t) => t.name === c.type)?.title ?? c.type,
      path: `/${c.route}`,
    })),
  ]
  const shellProps = {ctx, settings: shell.settings, nav, releaseId}

  const [first, second] = slug
  const collection = first ? collections.find((c) => c.route === first) : undefined

  if (collection && slug.length <= 2) {
    const type = owner?.types.find((t) => t.name === collection.type)
    if (second) {
      const doc = await getCollectionDoc(client, collection.type, second)
      if (!doc) notFound()
      return (
        <SiteShell {...shellProps}>
          <FallbackDoc ctx={ctx} doc={doc} type={type} />
        </SiteShell>
      )
    }
    const docs = await getCollection(client, collection.type)
    return (
      <SiteShell {...shellProps}>
        <section className="bones-cards">
          <h1>{type?.title ?? collection.type}</h1>
          <div className="bones-grid">
            {docs.map((doc) => (
              <FallbackCard
                key={doc._id}
                ctx={ctx}
                doc={doc}
                type={type}
                href={ctx.href(`/${collection.route}/${doc.slug?.current ?? doc._id}`)}
              />
            ))}
          </div>
        </section>
      </SiteShell>
    )
  }

  const page = await getPage(client, slug.join('/') || 'home')
  if (!page) {
    if (slug.length === 0) {
      return (
        <SiteShell {...shellProps}>
          <section className="bones-rich site-empty">
            <h1>Nothing has risen here yet.</h1>
            <p>
              {owner?.releaseId
                ? 'A resurrection is waiting in its release. It appears here once it rises.'
                : 'The dead are patient.'}
            </p>
          </section>
        </SiteShell>
      )
    }
    notFound()
  }

  return (
    <SiteShell {...shellProps}>
      <BonesBody ctx={ctx} body={page.body} settings={shell.settings} />
    </SiteShell>
  )
}
