/**
 * necro.autopsy / necro.autopsy-rerun — condense → propose → validate → write schemaProposal.
 */
import {runAutopsy, type SchemaProposal} from '@necro/autopsy'
import {withArrayKeys} from '@necro/hq-schema/arrayKey'
import type {EffectHandler} from '@sanity/workflow-engine'
import type {SanityClient} from '@sanity/client'
import {asDocumentId} from './refId'
import {createProgressThrottle} from './progressThrottle'

function publishedAndDraft(id: string): string[] {
  const published = id.replace(/^drafts\./, '')
  return [published, `drafts.${published}`]
}

function asSanity(client: unknown): SanityClient {
  return client as SanityClient
}

function toHqTypes(types: SchemaProposal['types']) {
  return withArrayKeys(
    types.map((t) => ({
      name: t.name,
      title: t.title,
      kind: t.kind,
      bonesMatch: t.bonesMatch,
      fields: withArrayKeys(
        t.fields.map((f) => ({
          name: f.name,
          type: f.type,
          of: f.of,
          to: f.to,
          required: f.required ?? false,
          validation: f.validation,
          description: f.description,
          evidenceCount: f.evidenceCount,
        })),
        'proposedField',
      ),
      rationale: t.rationale,
      evidence: withArrayKeys(
        t.evidence.map((e) => ({
          page: {_type: 'reference' as const, _ref: e.pageId.replace(/^drafts\./, '')},
          excerpt: e.excerpt,
        })),
        'typeEvidence',
      ),
      confidence: t.confidence,
      decision: t.decision,
      mergeInto: t.mergeInto,
    })),
    'proposedType',
  )
}

export const autopsyHandler: EffectHandler = async (params, ctx) => {
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

  const pages = await client.fetch<
    Array<{
      _id: string
      path?: string
      url?: string
      title?: string
      httpStatus?: number
      contentHash?: string
      headings?: string[]
      sections?: Array<{kind?: string; html?: string; text?: string}>
      images?: Array<{src?: string}>
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
      _id, path, url, title, httpStatus, contentHash, headings, sections, images, links, detectedEntities
    }`,
    {ids},
  )

  if (pages.length === 0) {
    throw new Error(`No exhumedPage docs for séance ${seanceId}`)
  }

  await progress(20)

  const latest = await client.fetch<{
    version?: number
    types?: SchemaProposal['types']
  } | null>(
    `*[_type == "schemaProposal" && seance._ref in $ids] | order(version desc)[0]{
      version, types
    }`,
    {ids},
  )

  const nextVersion = (latest?.version ?? 0) + 1
  const priorProposal: SchemaProposal | undefined = latest?.types
    ? {
        seanceId: seance._id.replace(/^drafts\./, ''),
        version: latest.version ?? 1,
        types: latest.types,
      }
    : undefined

  const result = await runAutopsy({
    seanceId: seance._id.replace(/^drafts\./, ''),
    pages,
    version: nextVersion,
    priorProposal,
  })

  await progress(85)

  const seanceRef = seance._id.replace(/^drafts\./, '')
  const {usage, proposal} = result
  await client.create({
    _type: 'schemaProposal',
    seance: {_type: 'reference', _ref: seanceRef},
    version: proposal.version,
    types: toHqTypes(proposal.types),
    model: usage.model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    repairRounds: usage.repairRounds,
  } as {[key: string]: unknown; _type: string})

  await progress(100)

  ctx.log('[autopsy] wrote schemaProposal', {
    version: proposal.version,
    typeCount: proposal.types.length,
    model: usage.model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    repairRounds: usage.repairRounds,
  })
}
