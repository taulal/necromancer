/**
 * Showcase holds one resurrected site at a time (dataset quota: maxDatasets=2 → hq + showcase).
 * Reanimate refuses when showcase already has content unless the séance set replaceTarget.
 * Never touches `hq`.
 */
import type {SanityClient} from '@sanity/client'

export const SHOWCASE_DATASET = 'showcase'
export const SHOWCASE_OWNER_ID = 'necromancer.owner'

const CONTENT_COUNT_QUERY = `count(*[
  !(_id in path("_.schemas.**")) &&
  !(_id in path("_.releases.**")) &&
  !(_type match "system.*") &&
  _id != $ownerId
])`

export class ShowcaseOccupiedError extends Error {
  constructor(
    message = 'Showcase already holds another séance. Re-run with --replace (CLI) or confirm replace in the App.',
  ) {
    super(message)
    this.name = 'ShowcaseOccupiedError'
  }
}

export type ShowcaseOccupancy = {
  contentCount: number
  ownerSeanceId: string | null
  schemaIds: string[]
}

export function isOccupiedByOther(occupancy: ShowcaseOccupancy, seanceId: string): boolean {
  if (occupancy.contentCount > 0) return true
  if (occupancy.ownerSeanceId && occupancy.ownerSeanceId !== seanceId) return true
  return false
}

export async function readShowcaseOccupancy(
  target: SanityClient,
  projectId: string,
  token: string,
): Promise<ShowcaseOccupancy> {
  const [contentCount, owner] = await Promise.all([
    target.fetch<number>(CONTENT_COUNT_QUERY, {ownerId: SHOWCASE_OWNER_ID}),
    target.fetch<{seanceId?: string} | null>(`*[_id == $id][0]{seanceId}`, {id: SHOWCASE_OWNER_ID}),
  ])

  const schemaIds = await listSchemaIds(projectId, SHOWCASE_DATASET, token)
  return {
    contentCount: contentCount ?? 0,
    ownerSeanceId: owner?.seanceId ?? null,
    schemaIds,
  }
}

async function listSchemaIds(projectId: string, dataset: string, token: string): Promise<string[]> {
  const res = await fetch(
    `https://api.sanity.io/v2025-03-01/projects/${projectId}/datasets/${dataset}/schemas`,
    {headers: {Authorization: `Bearer ${token}`}},
  )
  if (!res.ok) {
    throw new Error(`Failed to list schemas on ${dataset}: ${res.status}`)
  }
  const body = (await res.json()) as Array<{_id?: string}> | {schemas?: Array<{_id?: string}>}
  const list = Array.isArray(body) ? body : (body.schemas ?? [])
  return list.map((s) => s._id).filter((id): id is string => Boolean(id))
}

async function deleteSchema(
  projectId: string,
  dataset: string,
  schemaId: string,
  token: string,
): Promise<void> {
  const res = await fetch(
    `https://api.sanity.io/v2025-03-01/projects/${projectId}/datasets/${dataset}/schemas/${encodeURIComponent(schemaId)}`,
    {method: 'DELETE', headers: {Authorization: `Bearer ${token}`}},
  )
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete schema ${schemaId}: ${res.status}`)
  }
}

/** Wipe showcase documents + deployed schemas. Does not touch hq. */
export async function wipeShowcase(
  target: SanityClient,
  projectId: string,
  token: string,
): Promise<{deletedDocs: number; deletedSchemas: number}> {
  const ids = await target.fetch<string[]>(
    `*[
      !(_id in path("_.schemas.**")) &&
      !(_id in path("_.releases.**")) &&
      !(_type match "system.*")
    ]._id`,
  )
  let deletedDocs = 0
  for (const id of ids) {
    await target.delete(id)
    deletedDocs++
  }

  const schemaIds = await listSchemaIds(projectId, SHOWCASE_DATASET, token)
  for (const schemaId of schemaIds) {
    await deleteSchema(projectId, SHOWCASE_DATASET, schemaId, token)
  }
  return {deletedDocs, deletedSchemas: schemaIds.length}
}

export async function claimShowcaseOwner(
  target: SanityClient,
  seanceId: string,
  slug?: string,
): Promise<void> {
  await target.createOrReplace({
    _id: SHOWCASE_OWNER_ID,
    _type: 'necromancer.owner',
    seanceId,
    slug: slug ?? null,
    claimedAt: new Date().toISOString(),
  })
}

/**
 * Call at the start of necro.reanimate when targetMode=dataset and targetDataset=showcase.
 * Throws ShowcaseOccupiedError unless replaceTarget is set (then wipes first).
 */
export async function prepareShowcaseTarget(opts: {
  hq: SanityClient
  seanceId: string
  replaceTarget?: boolean
  slug?: string
  projectId: string
  token: string
}): Promise<{wiped: boolean}> {
  const target = opts.hq.withConfig({dataset: SHOWCASE_DATASET})
  const occupancy = await readShowcaseOccupancy(target, opts.projectId, opts.token)

  if (isOccupiedByOther(occupancy, opts.seanceId)) {
    if (!opts.replaceTarget) {
      throw new ShowcaseOccupiedError(
        `Showcase is occupied` +
          (occupancy.ownerSeanceId ? ` by séance ${occupancy.ownerSeanceId}` : '') +
          ` (${occupancy.contentCount} docs, ${occupancy.schemaIds.length} schemas). ` +
          `Pass --replace on summon (or set replaceTarget) to wipe showcase first.`,
      )
    }
    await wipeShowcase(target, opts.projectId, opts.token)
    await claimShowcaseOwner(target, opts.seanceId, opts.slug)
    return {wiped: true}
  }

  await claimShowcaseOwner(target, opts.seanceId, opts.slug)
  return {wiped: false}
}
