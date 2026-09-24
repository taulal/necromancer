import {Suspense, type ReactNode} from 'react'
import {useParams} from 'react-router'
import {useDocumentProjection, useDocuments, useQuery, type DocumentHandle} from '@sanity/sdk-react'
import {useDocumentWorkflows, useWorkflowSession} from '@sanity/workflow-sdk'
import {Box, Card, Flex, Grid, Heading, Spinner, Stack, Text} from '@sanity/ui'
import {useNecroEngine} from '../lib/useNecroEngine'
import {seanceGdrUri} from '../lib/seanceGdr'

type SeanceExhume = {
  url?: string
  slug?: {current?: string}
  platform?: string
  platformConfidence?: number
  platformHits?: string[]
  brand?: {colors?: string[]; fonts?: string[]; logo?: string}
  chromeBlocks?: string[]
  stats?: {pages?: number; images?: number; words?: number; links?: number}
  exhumeProgress?: number
  pageCap?: number
  status?: string
}

type PageRow = {
  path?: string
  title?: string
  httpStatus?: number
}

type EntityBag = {
  phones?: string[]
  emails?: string[]
  addresses?: string[]
  prices?: string[]
}

const PLATFORM_LABEL: Record<string, string> = {
  wordpress: 'WordPress',
  durable: 'Durable',
  wix: 'Wix',
  squarespace: 'Squarespace',
  webflow: 'Webflow',
  static: 'Static / PHP',
  unknown: 'Unknown',
}

/** Exhumation — docs/prototype/Exhume.dc.html + batch-4 NEC-UI1. */
export function Exhumation() {
  const {seanceId} = useParams()
  if (!seanceId) return null

  return (
    <Suspense
      fallback={
        <Flex justify="center" padding={6}>
          <Spinner muted />
        </Flex>
      }
    >
      <ExhumationBody seanceId={seanceId} />
    </Suspense>
  )
}

function ExhumationBody({seanceId}: {seanceId: string}) {
  const {data: seance} = useDocumentProjection<SeanceExhume>({
    documentId: seanceId,
    documentType: 'seance',
    projection: `{
      url, slug, platform, platformConfidence, platformHits,
      brand, chromeBlocks, stats, exhumeProgress, pageCap, status
    }`,
  })

  return (
    <Grid columns={[1, 1, 12]} gap={5}>
      <Box style={{gridColumn: 'span 7'}}>
        <Suspense
          fallback={
            <Card padding={4} style={panelStyle}>
              <Text muted>Raising the sitemap…</Text>
            </Card>
          }
        >
          <SitemapPanel seanceId={seanceId} seance={seance} />
        </Suspense>
      </Box>
      <Stack space={3} style={{gridColumn: 'span 5'}}>
        <PlatformCard seance={seance} />
        <FaceCard brand={seance?.brand} />
        <Suspense
          fallback={
            <Card padding={4} style={panelStyle}>
              <Text muted>…</Text>
            </Card>
          }
        >
          <EntitiesCard seanceId={seanceId} />
        </Suspense>
        <ChromeCard chromeBlocks={seance?.chromeBlocks} pageCount={seance?.stats?.pages} />
      </Stack>
    </Grid>
  )
}

function SitemapPanel({
  seanceId,
  seance,
}: {
  seanceId: string
  seance: SeanceExhume | null | undefined
}) {
  const {data: handles} = useDocuments({
    documentType: 'exhumedPage',
    filter: 'seance._ref == $seanceId',
    params: {seanceId},
    batchSize: 100,
    orderings: [{field: 'path', direction: 'asc'}],
  })

  const digging = isDigging(seance)

  return (
    <Stack space={4}>
      <Flex align="flex-end" gap={4} wrap="wrap">
        <Stack space={2} style={{flex: 1, minWidth: 200}}>
          <Heading size={3} className="necro-serif" style={{fontWeight: 400}}>
            Exhumation
          </Heading>
          <Text size={1} style={{color: 'var(--necro-dust)'}}>
            {subtitleFor(seance, handles.length)}
          </Text>
        </Stack>
        <Suspense
          fallback={
            <Text className="necro-mono" style={{color: 'var(--necro-alive-soft)', fontSize: 28}}>
              —%
            </Text>
          }
        >
          <ExhumeProgress seanceId={seanceId} seance={seance} pageCount={handles.length}>
            {(pct) => (
              <Text className="necro-mono" style={{color: 'var(--necro-alive-soft)', fontSize: 28}}>
                {pct}%
              </Text>
            )}
          </ExhumeProgress>
        </Suspense>
      </Flex>

      <Suspense fallback={<ProgressBar pct={0} />}>
        <ExhumeProgress seanceId={seanceId} seance={seance} pageCount={handles.length}>
          {(pct) => <ProgressBar pct={pct} />}
        </ExhumeProgress>
      </Suspense>

      <Flex gap={4} wrap="wrap" style={{fontSize: 13, color: 'var(--necro-dust)'}}>
        <span>
          <span className="necro-mono" style={{color: 'var(--necro-bone)'}}>
            {handles.length}
          </span>{' '}
          exhumed
        </span>
        <span>
          <span className="necro-mono" style={{color: 'var(--necro-bone)'}}>
            {seance?.pageCap ?? 50}
          </span>{' '}
          page cap
        </span>
      </Flex>

      <Card
        padding={0}
        radius={2}
        style={{
          ...panelStyle,
          background: 'var(--necro-well)',
          maxHeight: 480,
          overflow: 'auto',
        }}
      >
        <Stack space={0} paddingY={2}>
          {handles.length === 0 ? (
            <Box padding={4}>
              <Text muted size={1}>
                Waiting for the first page to surface…
              </Text>
            </Box>
          ) : (
            handles.map((handle, index) => (
              <Suspense
                key={handle.documentId}
                fallback={
                  <Box paddingX={4} style={{height: 34}}>
                    <Text muted size={1} className="necro-mono">
                      …
                    </Text>
                  </Box>
                }
              >
                <PageRow
                  handle={handle}
                  isNewest={index === handles.length - 1}
                  digging={digging}
                />
              </Suspense>
            ))
          )}
        </Stack>
      </Card>
    </Stack>
  )
}

/** Prefer workflow `exhumeProgress`, then seance field, then pages/cap. */
function ExhumeProgress({
  seanceId,
  seance,
  pageCount,
  children,
}: {
  seanceId: string
  seance: SeanceExhume | null | undefined
  pageCount: number
  children: (pct: number) => ReactNode
}) {
  const engine = useNecroEngine()
  const list = useDocumentWorkflows({engine, document: seanceGdrUri(seanceId)})
  const instanceId = list.instances?.[0]?._id

  if (!instanceId) {
    return <>{children(fallbackPercent(seance, pageCount))}</>
  }

  return (
    <ExhumeProgressSession
      instanceId={instanceId}
      seance={seance}
      pageCount={pageCount}
      children={children}
    />
  )
}

function ExhumeProgressSession({
  instanceId,
  seance,
  pageCount,
  children,
}: {
  instanceId: string
  seance: SeanceExhume | null | undefined
  pageCount: number
  children: (pct: number) => ReactNode
}) {
  const engine = useNecroEngine()
  const session = useWorkflowSession({engine, instanceId})
  const fromWorkflow = readProgressField(session.evaluation?.instance.fields, 'exhumeProgress')
  let pct = fallbackPercent(seance, pageCount)
  if (fromWorkflow != null) {
    pct = clampPct(fromWorkflow > 1 ? fromWorkflow : fromWorkflow * 100)
  }
  return <>{children(pct)}</>
}

function ProgressBar({pct}: {pct: number}) {
  const soil = pct > 0 && pct < 100
  return (
    <Box
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Exhumation progress"
      style={{
        height: 10,
        borderRadius: 5,
        background: '#1d1b19',
        overflow: 'hidden',
      }}
    >
      <Box
        className={soil ? 'necro-soil' : undefined}
        style={{
          height: 10,
          borderRadius: 5,
          width: `${pct}%`,
          background: 'var(--necro-alive)',
          transition: 'width 0.4s ease',
        }}
      />
    </Box>
  )
}

function fallbackPercent(seance: SeanceExhume | null | undefined, pageCount: number): number {
  if (seance?.exhumeProgress != null) {
    const v = seance.exhumeProgress
    return clampPct(v <= 1 ? v * 100 : v)
  }
  const cap = seance?.pageCap ?? 50
  if (pageCount > 0 && cap > 0) return clampPct((pageCount / cap) * 100)
  return 0
}

function readProgressField(
  fields: ReadonlyArray<{name: string; value?: unknown}> | undefined,
  name: string,
): number | null {
  const entry = fields?.find((f) => f.name === name)
  return typeof entry?.value === 'number' ? entry.value : null
}

function clampPct(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function isDigging(seance: SeanceExhume | null | undefined) {
  if (!seance) return true
  if (seance.status === 'entombed' || seance.status === 'risen') return false
  return seance.exhumeProgress == null || seance.exhumeProgress < 1
}

function PageRow({
  handle,
  isNewest,
  digging,
}: {
  handle: DocumentHandle
  isNewest: boolean
  digging: boolean
}) {
  const {data} = useDocumentProjection<PageRow>({
    ...handle,
    projection: `{path, title, httpStatus}`,
  })

  const path = data?.path || '/'
  const depth = Math.min(path.split('/').filter(Boolean).length, 4)
  const statusLabel =
    data?.httpStatus && data.httpStatus >= 400
      ? 'left alone'
      : isNewest && digging
        ? 'digging'
        : 'exhumed'
  const statusColor =
    statusLabel === 'left alone'
      ? 'var(--necro-ember)'
      : statusLabel === 'digging'
        ? 'var(--necro-alive-soft)'
        : '#8fd95a'

  return (
    <Flex align="center" gap={3} paddingX={4} style={{height: 34, minHeight: 34}}>
      <span style={{width: depth * 16, flexShrink: 0}} aria-hidden />
      <Text size={1} className="necro-mono" style={{flex: 1, color: 'var(--necro-bone)'}}>
        {path}
      </Text>
      <Text size={0} muted style={{maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis'}}>
        {data?.title || ''}
      </Text>
      <Flex
        align="center"
        justify="flex-end"
        gap={2}
        style={{width: 96, color: statusColor, fontSize: 12}}
      >
        {statusLabel === 'digging' ? (
          <span
            className="necro-flicker"
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: 'var(--necro-alive)',
              display: 'inline-block',
            }}
            aria-hidden
          />
        ) : null}
        {statusLabel}
      </Flex>
    </Flex>
  )
}

function PlatformCard({seance}: {seance: SeanceExhume | null | undefined}) {
  const label = seance?.platform
    ? (PLATFORM_LABEL[seance.platform] ?? seance.platform)
    : 'Still sniffing…'
  const confidence =
    seance?.platformConfidence != null
      ? `${Math.round(seance.platformConfidence * 100)}% sure`
      : null
  const hits = seance?.platformHits?.filter(Boolean) ?? []

  return (
    <Card padding={4} radius={2} style={panelStyle}>
      <Stack space={3}>
        <Text size={0} weight="semibold" style={eyebrowStyle}>
          Platform
        </Text>
        <Flex align="baseline" gap={3}>
          <Heading size={2} className="necro-serif" style={{fontWeight: 400}}>
            {label}
          </Heading>
          {confidence ? (
            <Text size={1} className="necro-mono" style={{color: 'var(--necro-alive-soft)'}}>
              {confidence}
            </Text>
          ) : null}
        </Flex>
        {hits.length ? (
          <Stack space={2}>
            {hits.map((hit) => (
              <Text key={hit} size={0} className="necro-mono" style={{color: 'var(--necro-dust)'}}>
                {hit}
              </Text>
            ))}
          </Stack>
        ) : (
          <Text size={0} muted>
            Evidence hits appear as the crawl fingerprints the corpse.
          </Text>
        )}
      </Stack>
    </Card>
  )
}

function FaceCard({brand}: {brand: SeanceExhume['brand']}) {
  const colors = brand?.colors?.slice(0, 6) ?? []
  const fonts = brand?.fonts?.slice(0, 3) ?? []

  return (
    <Card padding={4} radius={2} style={panelStyle}>
      <Stack space={3}>
        <Text size={0} weight="semibold" style={eyebrowStyle}>
          Its face, recovered
        </Text>
        {colors.length ? (
          <Flex gap={2} wrap="wrap">
            {colors.map((c) => (
              <Stack key={c} space={2} style={{alignItems: 'center'}}>
                <Box
                  style={{
                    width: 56,
                    height: 40,
                    borderRadius: 6,
                    background: c,
                    border: '1px solid var(--necro-line)',
                  }}
                />
                <Text size={0} className="necro-mono" muted>
                  {c}
                </Text>
              </Stack>
            ))}
          </Flex>
        ) : (
          <Text size={0} muted>
            Colours arrive with the brand pass.
          </Text>
        )}
        <Flex align="center" gap={4}>
          <Box
            style={{
              width: 88,
              height: 44,
              border: '1px dashed var(--necro-line-strong)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              background: 'var(--necro-well)',
            }}
          >
            {brand?.logo ? (
              <img
                src={brand.logo}
                alt="Recovered logo"
                style={{maxWidth: '100%', maxHeight: '100%', objectFit: 'contain'}}
              />
            ) : (
              <Text size={0} muted>
                [logo]
              </Text>
            )}
          </Box>
          <Stack space={2}>
            {fonts.length ? (
              fonts.map((f, i) => (
                <Text key={f} size={0} className="necro-mono" style={{color: 'var(--necro-dust)'}}>
                  {i === 0 ? 'headings' : 'body'}: {f}
                </Text>
              ))
            ) : (
              <Text size={0} muted>
                Fonts still buried.
              </Text>
            )}
          </Stack>
        </Flex>
      </Stack>
    </Card>
  )
}

function EntitiesCard({seanceId}: {seanceId: string}) {
  const {data} = useQuery<EntityBag[]>({
    query: `*[_type == "exhumedPage" && seance._ref == $seanceId].detectedEntities`,
    params: {seanceId},
  })

  const summary = summariseEntities(data ?? [])

  return (
    <Card padding={4} radius={2} style={panelStyle}>
      <Stack space={3}>
        <Text size={0} weight="semibold" style={eyebrowStyle}>
          Things it said about itself
        </Text>
        {summary.every((r) => r.count === 0) ? (
          <Text size={0} muted>
            Entity counts grow as pages land.
          </Text>
        ) : (
          <Stack space={2}>
            {summary.map((row) => (
              <Flex key={row.label} align="center" gap={3}>
                <Text size={1} style={{flex: 1}}>
                  {row.label}
                </Text>
                <Text
                  size={1}
                  className="necro-mono"
                  style={{
                    color: row.contradiction ? 'var(--necro-ember)' : 'var(--necro-dust)',
                  }}
                >
                  {row.contradiction ? `${row.unique} different` : String(row.unique)}
                </Text>
              </Flex>
            ))}
          </Stack>
        )}
      </Stack>
    </Card>
  )
}

function summariseEntities(bags: EntityBag[]) {
  const kinds: Array<{key: keyof EntityBag; label: string}> = [
    {key: 'phones', label: 'Phone numbers'},
    {key: 'emails', label: 'Email addresses'},
    {key: 'addresses', label: 'Street address'},
    {key: 'prices', label: 'Prices'},
  ]
  return kinds.map(({key, label}) => {
    const values = new Set<string>()
    for (const bag of bags) {
      for (const v of bag?.[key] ?? []) {
        if (v) values.add(v.trim())
      }
    }
    const unique = values.size
    return {
      label,
      count: unique,
      unique,
      contradiction: key !== 'prices' && unique > 1,
    }
  })
}

function ChromeCard({chromeBlocks, pageCount}: {chromeBlocks?: string[]; pageCount?: number}) {
  const blocks = chromeBlocks?.filter(Boolean) ?? []
  return (
    <Card padding={4} radius={2} style={panelStyle}>
      <Stack space={3}>
        <Text size={0} weight="semibold" style={eyebrowStyle}>
          Repeated on every page
        </Text>
        {blocks.length ? (
          <Stack space={2}>
            <Text size={1} style={{color: 'var(--necro-dust)', lineHeight: 1.5}}>
              Header and footer patterns appear across the crawl. They&apos;ll become{' '}
              <span className="necro-mono" style={{color: 'var(--necro-bone)'}}>
                siteSettings
              </span>
              , not copy.
            </Text>
            {blocks.slice(0, 3).map((b) => (
              <Text key={b.slice(0, 48)} size={0} className="necro-mono" muted>
                {b.length > 120 ? `${b.slice(0, 117)}…` : b}
              </Text>
            ))}
          </Stack>
        ) : (
          <Text size={1} style={{color: 'var(--necro-dust)', lineHeight: 1.5}}>
            {pageCount && pageCount >= 3
              ? 'Chrome detection runs at the end of the dig. Waiting for the pass…'
              : 'Need a few pages before chrome can surface.'}
          </Text>
        )}
      </Stack>
    </Card>
  )
}

function subtitleFor(seance: SeanceExhume | null | undefined, pageCount: number) {
  if (!seance) return 'Opening the ground…'
  if (pageCount === 0) {
    return 'Robots check first. Digging begins when the drain claims the effect.'
  }
  const cap = seance.pageCap ?? 50
  return `Sitemap growing — ${pageCount} of up to ${cap} pages. Digging five at a time.`
}

const panelStyle = {
  background: 'var(--necro-surface)',
  border: '1px solid var(--necro-line)',
} as const

const eyebrowStyle = {
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: 'var(--necro-faint)',
}
