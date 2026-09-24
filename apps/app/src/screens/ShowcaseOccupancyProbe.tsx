import {Suspense, useEffect} from 'react'
import {useQuery} from '@sanity/sdk-react'
import {HQ_DATASET, PROJECT_ID, SHOWCASE_DATASET} from '../lib/config'

/** Same marker reanimate writes — see packages/rituals/src/runtime/showcaseGuard.ts */
const OWNER_ID = 'necromancer.owner'

const CONTENT_COUNT_QUERY = `count(*[
  !(_id in path("_.schemas.**")) &&
  !(_id in path("_.releases.**")) &&
  !(_type match "system.*") &&
  _id != $ownerId
])`

export type ShowcaseOccupancy = {
  occupied: boolean
  ownerSeanceId: string | null
  occupantSlug: string | null
  contentCount: number
}

/**
 * Live-reads showcase occupancy for the Summon replace confirm.
 * One fetching hook per leaf; mount inside Suspense.
 */
export function ShowcaseOccupancyProbe({onChange}: {onChange: (value: ShowcaseOccupancy) => void}) {
  return (
    <Suspense fallback={null}>
      <ContentCountLeaf onChange={onChange} />
    </Suspense>
  )
}

function ContentCountLeaf({onChange}: {onChange: (value: ShowcaseOccupancy) => void}) {
  const {data} = useQuery<number>({
    query: CONTENT_COUNT_QUERY,
    params: {ownerId: OWNER_ID},
    projectId: PROJECT_ID,
    dataset: SHOWCASE_DATASET,
  })
  const contentCount = data ?? 0
  return (
    <Suspense fallback={null}>
      <OwnerLeaf contentCount={contentCount} onChange={onChange} />
    </Suspense>
  )
}

function OwnerLeaf({
  contentCount,
  onChange,
}: {
  contentCount: number
  onChange: (value: ShowcaseOccupancy) => void
}) {
  const {data} = useQuery<{seanceId?: string} | null>({
    query: `*[_id == $id][0]{seanceId}`,
    params: {id: OWNER_ID},
    projectId: PROJECT_ID,
    dataset: SHOWCASE_DATASET,
  })
  const ownerSeanceId = data?.seanceId ?? null
  return (
    <Suspense fallback={null}>
      <SlugLeaf contentCount={contentCount} ownerSeanceId={ownerSeanceId} onChange={onChange} />
    </Suspense>
  )
}

function SlugLeaf({
  contentCount,
  ownerSeanceId,
  onChange,
}: {
  contentCount: number
  ownerSeanceId: string | null
  onChange: (value: ShowcaseOccupancy) => void
}) {
  const {data} = useQuery<{slug?: {current?: string}} | null>({
    query: ownerSeanceId
      ? `*[_id == $id][0]{slug}`
      : `*[_type == "seance" && targetDataset == "showcase" && status == "risen"] | order(_updatedAt desc)[0]{slug}`,
    params: ownerSeanceId ? {id: ownerSeanceId} : {},
    projectId: PROJECT_ID,
    dataset: HQ_DATASET,
  })
  const occupantSlug = data?.slug?.current ?? null
  const occupied = contentCount > 0 || Boolean(ownerSeanceId)

  useEffect(() => {
    onChange({occupied, ownerSeanceId, occupantSlug, contentCount})
  }, [occupied, ownerSeanceId, occupantSlug, contentCount, onChange])

  return null
}
