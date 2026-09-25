/**
 * necro.interrogate — deterministic findings + Claude ask_questions → question docs.
 */
import {runInterrogate, type DraftQuestion, type ProposedTypeSummary} from '@necro/interrogate'
import {withArrayKeys} from '@necro/hq-schema/arrayKey'
import type {EffectHandler, FieldOp} from '@sanity/workflow-engine'
import type {SanityClient} from '@sanity/client'
import {asDocumentId} from './refId'
import {createProgressThrottle} from './progressThrottle'

const INTERROGATION_SLA_MS = 48 * 60 * 60 * 1000

function publishedAndDraft(id: string): string[] {
  const published = id.replace(/^drafts\./, '')
  return [published, `drafts.${published}`]
}

function asSanity(client: unknown): SanityClient {
  return client as SanityClient
}

function questionDocId(seanceRef: string, fingerprint: string): string {
  return `question.${seanceRef}.${fingerprint}`
}

function toHqEvidence(evidence: DraftQuestion['evidence']) {
  return withArrayKeys(
    evidence.map((e) => ({
      page: {_type: 'reference' as const, _ref: e.pageId.replace(/^drafts\./, '')},
      quote: e.excerpt,
      url: e.url,
    })),
    'evidenceItem',
  )
}

export async function countOpenRequiredQuestions(
  client: SanityClient,
  seancePublished: string,
): Promise<number> {
  return client.fetch<number>(
    `count(*[_type == "question" && seance._ref == $published && required == true && !defined(answer)])`,
    {published: seancePublished},
  )
}

export const interrogateHandler: EffectHandler = async (params, ctx) => {
  const seanceId = asDocumentId(params.seance)
  const ids = publishedAndDraft(seanceId)
  const client = asSanity(ctx.client)

  const progress = createProgressThrottle((field, value) => ctx.setProgress(field, value))
  await progress(5)

  const seance = await client.fetch<{_id: string} | null>(
    `*[_id in $ids] | order(_updatedAt desc)[0]{_id}`,
    {ids},
  )
  if (!seance) {
    throw new Error(`Séance ${seanceId} not found`)
  }

  const seanceRef = seance._id.replace(/^drafts\./, '')

  const pages = await client.fetch<
    Array<{
      _id: string
      path?: string
      url?: string
      title?: string
      httpStatus?: number
      contentHash?: string
      headings?: string[]
      meta?: {description?: string; ogImage?: string; canonical?: string}
      sections?: Array<{kind?: string; html?: string; text?: string}>
      images?: Array<{src?: string; alt?: string}>
      links?: string[]
      detectedEntities?: {
        phones?: string[]
        emails?: string[]
        addresses?: string[]
        prices?: string[]
      }
    }>
  >(
    `*[_type == "exhumedPage" && seance._ref in $ids]{
      _id, path, url, title, httpStatus, contentHash, headings, meta, sections, images, links, detectedEntities
    }`,
    {ids},
  )

  if (pages.length === 0) {
    throw new Error(`No exhumedPage docs for séance ${seanceId}`)
  }

  await progress(20)

  const proposal = await client.fetch<{
    types?: Array<{
      name?: string
      title?: string
      kind?: string
      confidence?: number
      rationale?: string
      bonesMatch?: string | null
      decision?: string
      evidence?: Array<{
        page?: {_ref?: string}
        excerpt?: string
        quote?: string
        url?: string
      }>
    }>
  } | null>(`*[_type == "schemaProposal" && seance._ref in $ids] | order(version desc)[0]{types}`, {
    ids,
  })

  const proposalTypes: ProposedTypeSummary[] = (proposal?.types ?? [])
    .filter((t): t is typeof t & {name: string} => Boolean(t.name))
    .map((t) => ({
      name: t.name!,
      title: t.title ?? t.name!,
      kind: t.kind ?? 'document',
      confidence: typeof t.confidence === 'number' ? t.confidence : 0.5,
      rationale: t.rationale ?? '',
      bonesMatch: t.bonesMatch,
      decision: t.decision,
      evidence: (t.evidence ?? [])
        .filter((e) => e.page?._ref && (e.excerpt || e.quote))
        .map((e) => ({
          pageId: e.page!._ref!,
          url: e.url ?? '',
          excerpt: e.excerpt ?? e.quote ?? '',
        })),
    }))

  await progress(35)

  const {questions, usage} = await runInterrogate({
    pages,
    proposalTypes,
  })

  await progress(70)

  const keptIds = new Set<string>()
  for (const q of questions) {
    const _id = questionDocId(seanceRef, q.fingerprint)
    keptIds.add(_id)

    const existing = await client.fetch<{
      answer?: string
      answeredBy?: string
      answeredAt?: string
    } | null>(`*[_id == $id || _id == $draft][0]{answer, answeredBy, answeredAt}`, {
      id: _id,
      draft: `drafts.${_id}`,
    })

    const doc: {[key: string]: unknown; _id: string; _type: string} = {
      _id,
      _type: 'question',
      seance: {_type: 'reference', _ref: seanceRef},
      kind: q.kind,
      prompt: q.prompt,
      evidence: toHqEvidence(q.evidence),
      options: q.options,
      required: q.required,
      source: q.source,
      spawnsTasks: q.spawnsTasks,
    }

    if (existing?.answer) {
      doc.answer = existing.answer
      if (existing.answeredBy) doc.answeredBy = existing.answeredBy
      if (existing.answeredAt) doc.answeredAt = existing.answeredAt
    }

    await client.createOrReplace(doc)
  }

  // Idempotent cleanup: drop unanswered questions no longer in this run.
  const existingIds = await client.fetch<string[]>(
    `*[_type == "question" && seance._ref == $published && !defined(answer)]._id`,
    {published: seanceRef},
  )
  for (const id of existingIds) {
    const published = id.replace(/^drafts\./, '')
    if (keptIds.has(published) || keptIds.has(id)) continue
    await client.delete(id)
  }

  await progress(90)

  const openRequired = await countOpenRequiredQuestions(client, seanceRef)
  const deadline = new Date(Date.now() + INTERROGATION_SLA_MS).toISOString()

  ctx.log('[interrogate] wrote questions', {
    count: questions.length,
    openRequired,
    deadline,
    model: usage.model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  })

  await progress(100)

  const ops: FieldOp[] = [
    {
      type: 'field.set',
      target: {scope: 'workflow', field: 'interrogationDeadline'},
      value: {type: 'literal', value: deadline},
    },
    {
      type: 'field.set',
      target: {scope: 'workflow', field: 'openRequiredQuestions'},
      value: {type: 'literal', value: openRequired},
    },
  ]

  return {ops}
}
