/**
 * necro.reanimate — materialise the accepted anatomy into the target dataset.
 *
 * 1. Showcase guard (one site at a time; wipe only with seance.replaceTarget).
 * 2. Plan (deterministic, @necro/reanimate): pages → Bones `page` / collection docs,
 *    siteSettings, redirects, ledger.
 * 3. Deploy the target schema (Bones + collections) via the schema store (NEC-10s).
 * 4. Content Release "Resurrection · <slug>"; upload images; write every doc as a
 *    release version (`versions.<rel>.<id>`). Re-runs overwrite the same ids and
 *    delete stale versions, so the release never duplicates.
 * 5. HQ: redirectLedgerEntry docs, exhumedPage.target mapping (cast + Ritual read it),
 *    séance releaseId/targetSchemaId. Never writes hq content outside this séance.
 *
 * Project mode stays a stretch path (logs and returns).
 */
import type {EffectHandler} from '@sanity/workflow-engine'
import type {SanityClient} from '@sanity/client'
import type {ProposedType} from '@necro/autopsy'
import {
  collectImageSources,
  key,
  planReanimation,
  resolveImageSources,
  targetSchemaManifest,
  type PlanPage,
  type PlanQuestion,
} from '@necro/reanimate'
import {asDocumentId} from './refId'
import {createProgressThrottle} from './progressThrottle'
import {projectId} from './client'
import {prepareShowcaseTarget, SHOWCASE_DATASET, SHOWCASE_OWNER_ID} from './showcaseGuard'
import {deployTargetSchema} from './schemaStore'

const MAX_IMAGES = 60
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const USER_AGENT = 'NecromancerBot (+https://github.com/taulal/necromancer)'
/** Content Releases need a recent API version. */
const TARGET_API_VERSION = '2025-08-15'

function publishedAndDraft(id: string): string[] {
  const published = id.replace(/^drafts\./, '')
  return [published, `drafts.${published}`]
}

/** Prefer each doc's draft (App edits land in drafts) over its published copy. */
function preferDrafts<T extends {_id: string}>(docs: T[]): T[] {
  const byId = new Map<string, T>()
  for (const d of docs) {
    const id = d._id.replace(/^drafts\./, '')
    const current = byId.get(id)
    if (!current || d._id.startsWith('drafts.')) byId.set(id, d)
  }
  return [...byId.values()]
}

export function releaseIdFor(seanceId: string): string {
  return `r${key('resurrection', seanceId.replace(/^drafts\./, '')).slice(0, 9)}`
}

async function uploadImages(
  target: SanityClient,
  urls: string[],
  log: (msg: string, meta?: Record<string, unknown>) => void,
  onProgress: (done: number) => Promise<void>,
): Promise<Map<string, string>> {
  const assets = new Map<string, string>()
  const queue = urls.slice(0, MAX_IMAGES)
  let done = 0
  const worker = async () => {
    for (;;) {
      const url = queue.shift()
      if (!url) return
      try {
        const res = await fetch(url, {
          headers: {'User-Agent': USER_AGENT},
          signal: AbortSignal.timeout(10_000),
        })
        const type = res.headers.get('content-type') ?? ''
        if (!res.ok || !type.startsWith('image/')) throw new Error(`${res.status} ${type}`)
        const buf = Buffer.from(await res.arrayBuffer())
        if (buf.byteLength > MAX_IMAGE_BYTES) throw new Error(`too large (${buf.byteLength} bytes)`)
        const filename = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'image')
        const asset = await target.assets.upload('image', buf, {
          filename,
          source: {name: 'necromancer', id: url, url},
        })
        assets.set(url, asset._id)
      } catch (err) {
        log('[reanimate] image skipped', {url, error: String(err)})
      }
      done++
      await onProgress(done)
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  if (urls.length > MAX_IMAGES)
    log('[reanimate] image cap reached', {total: urls.length, cap: MAX_IMAGES})
  return assets
}

export const reanimateHandler: EffectHandler = async (params, ctx) => {
  const seanceId = asDocumentId(params.seance)
  const ids = publishedAndDraft(seanceId)
  const seanceRef = seanceId.replace(/^drafts\./, '')
  const hq = ctx.client as SanityClient
  const token = process.env.SANITY_HQ_WRITE_TOKEN?.trim()
  if (!token) throw new Error('SANITY_HQ_WRITE_TOKEN is required for reanimate')
  // The HQ token is an Editor robot: content yes, schemas no (needs deploySchema /
  // deployStudio). Schema list/deploy/delete go through the org robot.
  const schemaToken = process.env.SANITY_ORG_TOKEN?.trim()
  if (!schemaToken) {
    throw new Error('SANITY_ORG_TOKEN is required for reanimate (schema deploy to showcase)')
  }

  const seance = await hq.fetch<{
    _id: string
    url?: string
    slug?: {current?: string}
    brand?: {colors?: string[]; fonts?: string[]; logo?: string}
    targetMode?: 'dataset' | 'project'
    targetDataset?: string
    targetProjectId?: string
    replaceTarget?: boolean
  } | null>(
    `*[_id in $ids] | order(_updatedAt desc)[0]{
      _id, url, slug, brand, targetMode, targetDataset, targetProjectId, replaceTarget
    }`,
    {ids},
  )
  if (!seance) throw new Error(`Séance ${seanceId} not found`)

  const progress = createProgressThrottle((field, value) => ctx.setProgress(field, value))
  await progress(5)

  const mode = seance.targetMode ?? 'dataset'
  const dataset = seance.targetDataset ?? SHOWCASE_DATASET
  if (mode === 'project') {
    ctx.log('[reanimate] project mode is a stretch path; nothing materialised', {
      seance: seanceRef,
      targetProjectId: seance.targetProjectId ?? null,
    })
    await progress(100)
    return
  }
  if (dataset !== SHOWCASE_DATASET) {
    throw new Error(`Only the showcase dataset is supported (dataset quota); got "${dataset}"`)
  }

  const {wiped} = await prepareShowcaseTarget({
    hq,
    seanceId: seanceRef,
    replaceTarget: Boolean(seance.replaceTarget),
    slug: seance.slug?.current,
    projectId,
    schemaToken,
  })
  await progress(15)

  // Inputs: accepted proposal (App edits live in drafts), pages, answered questions.
  const [proposals, pages, questions] = await Promise.all([
    hq.fetch<Array<{_id: string; version?: number; acceptedAt?: string; types?: ProposedType[]}>>(
      `*[_type == "schemaProposal" && seance._ref in $ids] | order(version desc){
        _id, version, acceptedAt,
        types[]{..., "evidence": evidence[]{"pageId": page._ref, "url": page->url, excerpt}}
      }`,
      {ids},
    ),
    hq.fetch<PlanPage[]>(
      `*[_type == "exhumedPage" && seance._ref in $ids]{
        _id, url, path, title, httpStatus, html, images, detectedEntities
      }`,
      {ids},
    ),
    hq.fetch<Array<PlanQuestion & {_id: string}>>(
      `*[_type == "question" && seance._ref in $ids]{_id, kind, answer, "evidence": evidence[]{url}}`,
      {ids},
    ),
  ])
  const latestVersion = proposals[0]?.version
  const proposal = preferDrafts(proposals.filter((p) => p.version === latestVersion))[0]
  if (!proposal?.types?.length)
    throw new Error(`No schemaProposal to reanimate for séance ${seanceRef}`)

  const plan = planReanimation({
    seance: {url: seance.url, brand: seance.brand},
    pages: preferDrafts(pages),
    types: proposal.types,
    questions: preferDrafts(questions),
  })
  ctx.log('[reanimate] planned', {
    docs: plan.docs.length,
    pages: plan.pageTargets.length,
    redirects: plan.docs.filter((d) => d._type === 'redirect').length,
    collections: plan.collections.map((c) => c.type),
    proposalVersion: proposal.version,
  })

  const target = hq.withConfig({dataset, apiVersion: TARGET_API_VERSION, perspective: 'raw'})
  const title = plan.siteTitle ?? seance.slug?.current ?? seanceRef
  const manifest = targetSchemaManifest(plan.extraTypes)
  const schemaId = await deployTargetSchema({
    projectId,
    dataset,
    token: schemaToken,
    types: manifest,
    title,
  })
  await progress(25)

  // Release: reuse while active; a published one means this séance already rose.
  const releaseId = releaseIdFor(seanceRef)
  const existing = await target.releases.get({releaseId}).catch(() => undefined)
  if (existing && existing.state !== 'active') {
    throw new Error(`Release ${releaseId} is ${existing.state}; this séance has already risen`)
  }
  if (!existing) {
    await target.releases.create({
      releaseId,
      metadata: {
        title: `Resurrection · ${seance.slug?.current ?? title}`,
        description: `Resurrected from ${seance.url ?? 'the dead site'} by Necromancer.`,
        releaseType: 'undecided',
      },
    })
  }
  await progress(30)

  const sources = [...collectImageSources(plan.docs)]
  const assets = await uploadImages(target, sources, ctx.log, (done) =>
    progress(30 + Math.round((done / Math.max(1, Math.min(sources.length, MAX_IMAGES))) * 40)),
  )
  const docs = resolveImageSources(plan.docs, assets)
  await progress(72)

  // Write versions; drop versions from an earlier run that the plan no longer has.
  const versionIds = new Set(docs.map((d) => `versions.${releaseId}.${d._id}`))
  const stale = await target.fetch<string[]>(`*[_id in path($prefix)]._id`, {
    prefix: `versions.${releaseId}.**`,
  })
  for (let i = 0; i < docs.length; i += 50) {
    const tx = target.transaction()
    for (const d of docs.slice(i, i + 50))
      tx.createOrReplace({...d, _id: `versions.${releaseId}.${d._id}`})
    await tx.commit({visibility: 'async'})
  }
  const toDelete = stale.filter((id) => !versionIds.has(id))
  if (toDelete.length) {
    const tx = target.transaction()
    for (const id of toDelete) tx.delete(id)
    await tx.commit({visibility: 'async'})
  }
  await target
    .patch(SHOWCASE_OWNER_ID)
    .set({
      releaseId,
      schemaId,
      siteTitle: title,
      seanceUrl: seance.url ?? null,
      collections: plan.collections.map((c) => ({_key: key(c.type), ...c})),
      schemaManifest: JSON.stringify(manifest),
      reanimatedAt: new Date().toISOString(),
    })
    .commit()
  await progress(85)

  // HQ: ledger, page → target mapping, séance pointers.
  const ledgerIds = new Set<string>()
  const hqTx = hq.transaction()
  for (const entry of plan.ledger) {
    const _id = `ledger.${seanceRef}.${key(entry.from)}`
    ledgerIds.add(_id)
    hqTx.createOrReplace({
      _id,
      _type: 'redirectLedgerEntry',
      seance: {_type: 'reference', _ref: seanceRef},
      from: entry.from,
      to: entry.to,
      status: entry.status,
      ...(entry.reason ? {reason: entry.reason} : {}),
    })
  }
  const mapped = new Map(plan.pageTargets.map((t) => [t.exhumedPageId, t]))
  const ledgerByPath = new Map(plan.ledger.map((l) => [l.from, l]))
  for (const page of pages) {
    const id = page._id.replace(/^drafts\./, '')
    const t = mapped.get(id)
    const path = page.path ? page.path.replace(/(.)\/+$/, '$1') : undefined
    const dropped = path ? ledgerByPath.get(path) : undefined
    hqTx.patch(page._id, (p) =>
      p.set({
        target: t
          ? {docId: t.docId, type: t.type, path: t.path, status: 'mapped'}
          : {path: dropped?.to ?? '/', status: 'dropped'},
      }),
    )
  }
  hqTx.patch(seance._id, (p) =>
    p.set({
      releaseId,
      targetSchemaId: schemaId,
      targetDataset: dataset,
      reanimatedAt: new Date().toISOString(),
    }),
  )
  await hqTx.commit({visibility: 'async'})
  const staleLedger = await hq.fetch<string[]>(
    `*[_type == "redirectLedgerEntry" && seance._ref == $s]._id`,
    {s: seanceRef},
  )
  const ledgerDelete = staleLedger.filter((id) => !ledgerIds.has(id))
  if (ledgerDelete.length) {
    const tx = hq.transaction()
    for (const id of ledgerDelete) tx.delete(id)
    await tx.commit({visibility: 'async'})
  }

  ctx.log('[reanimate] done', {
    releaseId,
    schemaId,
    wiped,
    docs: docs.length,
    images: `${assets.size}/${sources.length}`,
    staleVersionsDeleted: toDelete.length,
  })
  await progress(100)
}
