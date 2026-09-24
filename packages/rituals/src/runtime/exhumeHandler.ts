/**
 * necro.exhume — crawl the dead site and write exhumedPage docs + seance stats.
 */
import {crawl} from '@necro/exhume'
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

  const result = await crawl({
    url: seance.url,
    pageCap,
    onProgress: async ({fetched, totalHint}) => {
      const pct = Math.min(99, Math.round((fetched / Math.max(totalHint, pageCap, 1)) * 100))
      await progress(Math.max(1, pct))
    },
  })

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
      sections: page.sections,
      images: page.images,
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

  return {
    outputs: {
      pages: result.stats.pages,
      platform: result.platform,
      chromeBlocks: result.chromeBlocks.length,
      assetLinks: result.assetLinks.length,
    },
  }
}
