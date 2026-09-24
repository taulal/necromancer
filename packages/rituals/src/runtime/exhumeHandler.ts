/**
 * necro.exhume — crawl the dead site and write exhumedPage docs + seance stats.
 */
import {crawl, OffSiteRedirectError} from '@necro/exhume'
import type {EffectHandler} from '@sanity/workflow-engine'
import type {SanityClient} from '@sanity/client'
import {asDocumentId} from './refId'
import {createProgressThrottle} from './progressThrottle'

function publishedAndDraft(id: string): string[] {
  const published = id.replace(/^drafts\./, '')
  return [published, `drafts.${published}`]
}

function asSanity(client: EffectHandler extends never ? never : unknown): SanityClient {
  return client as SanityClient
}

export const exhumeHandler: EffectHandler = async (params, ctx) => {
  const seanceId = asDocumentId(params.seance)
  const ids = publishedAndDraft(seanceId)
  const client = asSanity(ctx.client)

  const seance = await client.fetch<{
    _id: string
    url?: string
    pageCap?: number
  } | null>(`*[_id in $ids] | order(_updatedAt desc)[0]{_id, url, pageCap}`, {ids})

  if (!seance?.url) {
    throw new Error(`Séance ${seanceId} has no url`)
  }

  const pageCap = seance.pageCap ?? 50
  const progress = createProgressThrottle((field, value) => ctx.setProgress(field, value))
  await progress(1)

  let result: Awaited<ReturnType<typeof crawl>>
  try {
    result = await crawl({
      url: seance.url,
      pageCap,
      onProgress: async ({fetched, totalHint}) => {
        const pct = Math.min(99, Math.round((fetched / Math.max(totalHint, pageCap, 1)) * 100))
        await progress(Math.max(1, pct))
      },
    })
  } catch (err) {
    // B5: leave a readable reason on the séance before the effect fails → entombed.
    if (err instanceof OffSiteRedirectError) {
      await client
        .patch(seance._id)
        .set({status: 'entombed', entombedReason: `Redirects off-site to ${err.to}`})
        .commit()
    }
    throw err
  }

  const existing = await client.fetch<string[]>(
    `*[_type == "exhumedPage" && seance._ref in $ids]._id`,
    {ids},
  )
  for (const id of existing) {
    await client.delete(id)
  }

  const seanceRef = seance._id.replace(/^drafts\./, '')
  for (const page of result.pages) {
    await client.create({
      _type: 'exhumedPage',
      seance: {_type: 'reference', _ref: seanceRef},
      url: page.url,
      path: page.path,
      httpStatus: page.httpStatus,
      title: page.title,
      meta: page.meta,
      headings: page.headings,
      sections: (page.sections ?? []).map((s) => ({
        _type: 'exhumedSection',
        _key: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
        ...s,
      })),
      images: (page.images ?? []).map((img) => ({
        _type: 'exhumedImage',
        _key: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
        ...img,
      })),
      links: [...page.links, ...page.assetLinks],
      detectedEntities: page.detectedEntities,
      contentHash: page.contentHash,
      html: page.html,
    } as {[key: string]: unknown; _type: string})
  }

  const {name: _brandName, ...brand} = result.brand
  await client
    .patch(seance._id)
    .set({
      platform: result.platform,
      platformConfidence: result.platformConfidence,
      brand,
      stats: result.stats,
    })
    .unset(['exhumeProgress'])
    .commit()

  await progress(100)
}
