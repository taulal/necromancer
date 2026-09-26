/**
 * necro.plan-ritual · necro.cast · necro.rise (BRIEF §7.5–7.6, §5.1).
 *
 * plan-ritual: answers + findings → `task` docs in HQ (idempotent ids; tasks already
 *   cast keep their status).
 * cast (per page-ritual child, bound to an exhumedPage): runs that page's auto tasks
 *   on the release version `versions.<rel>.<docId>` (NEC-12s: GO) — Agent Actions
 *   generate (meta, alt) / transform (placeholder copy); deterministic patch for contact
 *   fixes. Any failure throws so the child enters reviewing with castFailed.
 * rise: publishes the release and marks the séance risen.
 */
import type {EffectHandler} from '@sanity/workflow-engine'
import type {SanityClient} from '@sanity/client'
import {planRitualTasks, type RitualPage, type RitualQuestion} from '@necro/reanimate'
import {asDocumentId} from './refId'
import {createProgressThrottle} from './progressThrottle'
import {SHOWCASE_DATASET, SHOWCASE_OWNER_ID} from './showcaseGuard'

const AGENT_API_VERSION = 'vX'
const TARGET_API_VERSION = '2025-08-15'

type Seance = {
  _id: string
  releaseId?: string
  targetSchemaId?: string
  targetDataset?: string
}

function publishedAndDraft(id: string): string[] {
  const published = id.replace(/^drafts\./, '')
  return [published, `drafts.${published}`]
}

function preferDrafts<T extends {_id: string}>(docs: T[]): T[] {
  const byId = new Map<string, T>()
  for (const d of docs) {
    const id = d._id.replace(/^drafts\./, '')
    if (!byId.has(id) || d._id.startsWith('drafts.')) byId.set(id, d)
  }
  return [...byId.values()]
}

async function loadSeance(hq: SanityClient, seanceId: string): Promise<Seance> {
  const seance = await hq.fetch<Seance | null>(
    `*[_id in $ids] | order(_updatedAt desc)[0]{_id, releaseId, targetSchemaId, targetDataset}`,
    {ids: publishedAndDraft(seanceId)},
  )
  if (!seance) throw new Error(`Séance ${seanceId} not found`)
  return seance
}

/* ---------------------------------------------------------------- plan-ritual */

export const planRitualHandler: EffectHandler = async (params, ctx) => {
  const seanceRef = asDocumentId(params.seance).replace(/^drafts\./, '')
  const ids = publishedAndDraft(seanceRef)
  const hq = ctx.client as SanityClient
  const progress = createProgressThrottle((field, value) => ctx.setProgress(field, value))
  await progress(10)

  const [pages, questions, existing] = await Promise.all([
    hq.fetch<RitualPage[]>(
      `*[_type == "exhumedPage" && seance._ref in $ids]{_id, url, path, meta, images, detectedEntities, target}`,
      {ids},
    ),
    hq.fetch<RitualQuestion[]>(
      `*[_type == "question" && seance._ref in $ids]{
        _id, kind, prompt, answer, answerNote, options, spawnsTasks, "evidence": evidence[]{url}
      }`,
      {ids},
    ),
    hq.fetch<Array<{_id: string; status?: string; result?: string}>>(
      `*[_type == "task" && seance._ref == $s]{_id, status, result}`,
      {s: seanceRef},
    ),
  ])

  const planned = planRitualTasks({seanceId: seanceRef, pages, questions: preferDrafts(questions)})
  const prior = new Map(existing.map((t) => [t._id, t]))
  const keepStatus = new Set(['casting', 'done', 'failed', 'skipped'])

  const tx = hq.transaction()
  for (const t of planned) {
    const before = prior.get(t._id)
    const status = before?.status && keepStatus.has(before.status) ? before.status : t.status
    tx.createOrReplace({
      _id: t._id,
      _type: 'task',
      seance: {_type: 'reference', _ref: seanceRef},
      page: t.page,
      pageType: t.pageType,
      pagePath: t.pagePath,
      exhumedPage: {_type: 'reference', _ref: t.exhumedPageId},
      title: t.title,
      mode: t.mode,
      action: t.action,
      why: t.why,
      ...(t.agentAction ? {agentAction: t.agentAction} : {}),
      status,
      ...(before?.result || t.result ? {result: before?.result ?? t.result} : {}),
      fromQuestion: {_type: 'reference', _ref: t.fromQuestion, _weak: true},
    })
  }
  const plannedIds = new Set(planned.map((t) => t._id))
  for (const t of existing) {
    if (!plannedIds.has(t._id) && (t.status === 'todo' || !t.status)) tx.delete(t._id)
  }
  await tx.commit({visibility: 'async'})

  ctx.log('[plan-ritual] tasks written', {
    total: planned.length,
    auto: planned.filter((t) => t.mode === 'auto').length,
    human: planned.filter((t) => t.mode === 'human').length,
  })
  await progress(100)
}

/* ---------------------------------------------------------------------- cast */

type Task = {
  _id: string
  action: string
  mode: string
  status?: string
  page: string
  pageType?: string
  agentAction?: {kind?: string; instruction?: string}
}

type PathSegment = string | {_key: string}

/** Alt-text paths on a Bones page that have an image but no alt yet. */
export function missingAltPaths(doc: {body?: unknown[]}): PathSegment[][] {
  const paths: PathSegment[][] = []
  for (const raw of doc.body ?? []) {
    const b = raw as Record<string, unknown> & {_key?: string}
    if (!b._key) continue
    const img = b.image as {asset?: unknown; alt?: string} | undefined
    if (img?.asset && !img.alt?.trim()) paths.push(['body', {_key: b._key}, 'image', 'alt'])
    for (const item of (b.images as Array<{
      _key?: string
      image?: {asset?: unknown}
      alt?: string
    }>) ?? []) {
      if (item._key && item.image?.asset && !item.alt?.trim()) {
        paths.push(['body', {_key: b._key}, 'images', {_key: item._key}, 'alt'])
      }
    }
    for (const card of (b.cards as Array<{
      _key?: string
      image?: {asset?: unknown; alt?: string}
    }>) ?? []) {
      if (card._key && card.image?.asset && !card.image.alt?.trim()) {
        paths.push(['body', {_key: b._key}, 'cards', {_key: card._key}, 'image', 'alt'])
      }
    }
  }
  return paths
}

/** Replace wrong contact values in every string of a document (keys starting "_" untouched). */
export function replaceStrings<T>(
  value: T,
  from: string[],
  to: string,
): {value: T; changed: number} {
  let changed = 0
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      let out = v
      for (const f of from) if (f && out.includes(f)) out = out.split(f).join(to)
      if (out !== v) changed++
      return out
    }
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([k, child]) => [
          k,
          k.startsWith('_') ? child : walk(child),
        ]),
      )
    }
    return v
  }
  return {value: walk(value) as T, changed}
}

async function runTask(opts: {
  task: Task
  target: SanityClient
  schemaId: string
  documentId: string
  releaseId: string
}): Promise<{status: 'done' | 'skipped'; result: string}> {
  const {task, target, schemaId, documentId} = opts
  const agent = target.withConfig({apiVersion: AGENT_API_VERSION})
  const instruction = task.agentAction?.instruction ?? ''
  const isPage = (task.pageType ?? 'page') === 'page'

  switch (task.action) {
    case 'generate-meta': {
      if (!isPage) return {status: 'skipped', result: 'Collection docs have no SEO fields.'}
      const out = await agent.agent.action.generate({
        schemaId,
        documentId,
        instruction,
        target: [{path: 'seoTitle'}, {path: 'seoDescription'}],
      })
      const o = out as {seoTitle?: string; seoDescription?: string}
      return {
        status: 'done',
        result: `SEO title: “${o.seoTitle ?? ''}” · description: “${o.seoDescription ?? ''}”`,
      }
    }
    case 'generate-alt': {
      if (!isPage) return {status: 'skipped', result: 'Collection images have no alt field.'}
      const doc = await target.getDocument<{body?: unknown[]}>(documentId)
      const paths = doc ? missingAltPaths(doc) : []
      if (!paths.length) return {status: 'skipped', result: 'No images missing alt text.'}
      await agent.agent.action.generate({
        schemaId,
        documentId,
        instruction,
        target: paths.map((path) => ({path})),
      })
      return {
        status: 'done',
        result: `Alt text written for ${paths.length} image${paths.length === 1 ? '' : 's'}.`,
      }
    }
    case 'rewrite-placeholder': {
      if (!isPage) return {status: 'skipped', result: 'Only page bodies are rewritten.'}
      await agent.agent.action.transform({
        schemaId,
        documentId,
        instruction,
        target: {path: 'body'},
      })
      return {status: 'done', result: 'Placeholder copy rewritten in the site’s voice.'}
    }
    case 'fix-contact': {
      const {replace, with: to} = JSON.parse(instruction || '{}') as {
        replace?: string[]
        with?: string
      }
      if (!to || !replace?.length) return {status: 'skipped', result: 'Nothing to replace.'}
      let total = 0
      for (const id of [documentId, `versions.${opts.releaseId}.siteSettings`]) {
        const doc = await target.getDocument(id)
        if (!doc) continue
        const {value, changed} = replaceStrings(doc, replace, to)
        if (changed) {
          await target.createOrReplace(value)
          total += changed
        }
      }
      return {
        status: 'done',
        result: `Replaced ${total} occurrence${total === 1 ? '' : 's'} with “${to}”.`,
      }
    }
    default:
      return {status: 'skipped', result: 'No automatic recipe; handled elsewhere.'}
  }
}

export const castHandler: EffectHandler = async (params, ctx) => {
  const pageId = asDocumentId(params.page).replace(/^drafts\./, '')
  const hq = ctx.client as SanityClient
  const progress = createProgressThrottle((field, value) => ctx.setProgress(field, value))

  const page = await hq.fetch<{
    seance?: {_ref?: string}
    target?: {docId?: string; status?: string}
  } | null>(`*[_id == $id][0]{seance, target}`, {id: pageId})
  if (!page?.seance?._ref) throw new Error(`exhumedPage ${pageId} not found`)
  if (!page.target?.docId) {
    ctx.log('[cast] page was dropped or merged; nothing to cast', {page: pageId})
    return
  }
  const seance = await loadSeance(hq, page.seance._ref)
  if (!seance.releaseId || !seance.targetSchemaId)
    throw new Error('Séance has not been reanimated yet')

  const tasks = await hq.fetch<Task[]>(
    `*[_type == "task" && exhumedPage._ref == $page && mode == "auto" && status in ["todo", "failed"]]{
      _id, action, mode, status, page, pageType, agentAction
    }`,
    {page: pageId},
  )
  if (!tasks.length) {
    ctx.log('[cast] no auto tasks for this page', {page: pageId})
    return
  }

  const target = hq.withConfig({
    dataset: seance.targetDataset ?? SHOWCASE_DATASET,
    apiVersion: TARGET_API_VERSION,
    perspective: 'raw',
  })
  const documentId = `versions.${seance.releaseId}.${page.target.docId}`
  const failures: string[] = []

  for (const [i, task] of tasks.entries()) {
    await hq.patch(task._id).set({status: 'casting'}).commit({visibility: 'async'})
    const t0 = Date.now()
    try {
      const {status, result} = await runTask({
        task,
        target,
        schemaId: seance.targetSchemaId,
        documentId,
        releaseId: seance.releaseId,
      })
      const ms = Date.now() - t0
      await hq
        .patch(task._id)
        .set({status, result, castMs: ms, castAt: new Date().toISOString()})
        .commit()
      ctx.log('[cast] task', {task: task._id, action: task.action, status, ms})
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      failures.push(`${task.action}: ${message}`)
      await hq
        .patch(task._id)
        .set({status: 'failed', result: message.slice(0, 500), castMs: Date.now() - t0})
        .commit()
      ctx.log('[cast] task failed', {
        task: task._id,
        action: task.action,
        error: message.slice(0, 300),
      })
    }
    await progress(Math.round(((i + 1) / tasks.length) * 100))
  }

  if (failures.length)
    throw new Error(`Cast failed for ${failures.length} task(s): ${failures.join('; ')}`)
}

/* ---------------------------------------------------------------------- rise */

export const riseHandler: EffectHandler = async (params, ctx) => {
  const seanceRef = asDocumentId(params.seance).replace(/^drafts\./, '')
  const hq = ctx.client as SanityClient
  const seance = await loadSeance(hq, seanceRef)
  if (!seance.releaseId) throw new Error('Nothing to raise: the séance has no release')

  const target = hq.withConfig({
    dataset: seance.targetDataset ?? SHOWCASE_DATASET,
    apiVersion: TARGET_API_VERSION,
    perspective: 'raw',
  })
  const release = await target.releases.get({releaseId: seance.releaseId})
  if (!release) throw new Error(`Release ${seance.releaseId} not found`)
  if (release.state !== 'published') {
    await target.releases.publish({releaseId: seance.releaseId})
  }

  const risenAt = new Date().toISOString()
  const vessel = (process.env.VESSEL_URL ?? '').trim().replace(/\/$/, '')
  const vesselUrl = vessel ? `${vessel}/${seance.targetDataset ?? SHOWCASE_DATASET}` : null
  await hq.patch(seance._id).set({status: 'risen', risenAt, vesselUrl}).commit()
  await target
    .patch(SHOWCASE_OWNER_ID)
    .set({risenAt})
    .commit()
    .catch(() => undefined)
  ctx.log('[rise] release published', {releaseId: seance.releaseId, vesselUrl})
}
