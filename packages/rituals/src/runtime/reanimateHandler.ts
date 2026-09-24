/**
 * necro.reanimate — materialise the accepted anatomy into the target dataset/project.
 *
 * Plan (dataset quota → showcase only for MVP):
 * 1. If targetMode=dataset && targetDataset=showcase → prepareShowcaseTarget
 *    (refuse if occupied unless seance.replaceTarget; wipe docs+schemas on replace).
 * 2. Deploy compiled schema to the target (NEC-10 HTTP PUT).
 * 3. Create Content Release; import docs as versions; upload assets; write redirects.
 * 4. Project mode (stretch): create project + production dataset, store targetProjectId — not default.
 *
 * Steps 2–4 are still TODO (stub after the showcase gate). Never touches hq content.
 */
import type {EffectHandler} from '@sanity/workflow-engine'
import type {SanityClient} from '@sanity/client'
import {asDocumentId} from './refId'
import {createProgressThrottle} from './progressThrottle'
import {projectId} from './client'
import {prepareShowcaseTarget, SHOWCASE_DATASET} from './showcaseGuard'

function publishedAndDraft(id: string): string[] {
  const published = id.replace(/^drafts\./, '')
  return [published, `drafts.${published}`]
}

export const reanimateHandler: EffectHandler = async (params, ctx) => {
  const seanceId = asDocumentId(params.seance)
  const ids = publishedAndDraft(seanceId)
  const hq = ctx.client as SanityClient
  const token = process.env.SANITY_HQ_WRITE_TOKEN?.trim()
  if (!token) {
    throw new Error('SANITY_HQ_WRITE_TOKEN is required for reanimate')
  }

  const seance = await hq.fetch<{
    _id: string
    slug?: {current?: string}
    targetMode?: 'dataset' | 'project'
    targetDataset?: string
    targetProjectId?: string
    replaceTarget?: boolean
  } | null>(
    `*[_id in $ids] | order(_updatedAt desc)[0]{
      _id, slug, targetMode, targetDataset, targetProjectId, replaceTarget
    }`,
    {ids},
  )

  if (!seance) {
    throw new Error(`Séance ${seanceId} not found`)
  }

  const progress = createProgressThrottle((field, value) => ctx.setProgress(field, value))
  await progress(5)

  const mode = seance.targetMode ?? 'dataset'
  const dataset = seance.targetDataset ?? SHOWCASE_DATASET

  if (mode === 'project') {
    ctx.log('[reanimate] project mode is stretch — create project + production dataset (TODO)', {
      seance: seance._id,
      targetProjectId: seance.targetProjectId ?? null,
    })
    // Keep code path; do not invent a project create here without NEC-10p go.
    await progress(100)
    return
  }

  if (dataset === SHOWCASE_DATASET) {
    const {wiped} = await prepareShowcaseTarget({
      hq,
      seanceId: seance._id.replace(/^drafts\./, ''),
      replaceTarget: Boolean(seance.replaceTarget),
      slug: seance.slug?.current,
      projectId,
      token,
    })
    ctx.log('[reanimate] showcase prepared', {wiped, dataset: SHOWCASE_DATASET})
  } else {
    ctx.log('[reanimate] non-showcase dataset target (rip-* blocked by quota)', {dataset})
  }

  await progress(20)
  ctx.log(
    '[reanimate] TODO: deploy schema → create release → import versions → assets → redirects',
    {seance: seance._id, mode, dataset},
  )
  await progress(100)
}
