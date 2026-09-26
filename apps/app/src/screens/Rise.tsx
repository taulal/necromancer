import {Suspense, useMemo, useState, type CSSProperties} from 'react'
import {useParams} from 'react-router'
import {useQuery} from '@sanity/sdk-react'
import {useDocumentWorkflows, useWorkflowSession} from '@sanity/workflow-sdk'
import {Box, Card, Flex, Grid, Heading, Spinner, Stack, Text} from '@sanity/ui'
import {useNecroEngine} from '../lib/useNecroEngine'
import {seanceGdrUri} from '../lib/seanceGdr'
import {PROJECT_ID, SHOWCASE_DATASET, VESSEL_URL} from '../lib/config'
import {eyebrowStyle, panelStyle, primaryButton} from './Ritual'
import {idFromRef, ledgerCoverage, ledgerLabel, type LedgerRow} from './ritual/ritual'

/** Rise — NEC-UI5 / docs/prototype/Rise.dc.html + batch-4. */
export function Rise() {
  const {seanceId} = useParams()
  if (!seanceId) return null
  return (
    <Suspense fallback={<Centered />}>
      <RiseStage seanceId={seanceId} />
    </Suspense>
  )
}

function Centered() {
  return (
    <Flex justify="center" padding={6}>
      <Spinner muted />
    </Flex>
  )
}

function RiseStage({seanceId}: {seanceId: string}) {
  const engine = useNecroEngine()
  const list = useDocumentWorkflows({engine, document: seanceGdrUri(seanceId)})
  const instanceId = list.instances?.[0]?._id
  if (!instanceId) {
    return (
      <Card padding={5} radius={2} style={panelStyle}>
        <Text muted>No resurrection instance yet.</Text>
      </Card>
    )
  }
  return <RiseSession seanceId={seanceId} instanceId={instanceId} />
}

function RiseSession({seanceId, instanceId}: {seanceId: string; instanceId: string}) {
  const engine = useNecroEngine()
  const session = useWorkflowSession({engine, instanceId})
  const instance = session.evaluation?.instance
  const stage = instance?.currentStage
  const riseFailed = instance?.fields?.find((f) => f.name === 'riseFailed')?.value === true
  const childIds = useMemo(
    () =>
      ((instance as {subworkflows?: Array<{ref?: {id?: string}}>} | undefined)?.subworkflows ?? [])
        .map((s) => idFromRef(s.ref?.id))
        .filter((id): id is string => !!id),
    [instance],
  )
  const [pending, setPending] = useState(false)

  const fire = async (action: 'rise' | 'retry-rise') => {
    setPending(true)
    try {
      await session.fireAction({activity: 'publish', action})
    } finally {
      setPending(false)
    }
  }

  return (
    <Suspense fallback={<Centered />}>
      <RiseBoard
        seanceId={seanceId}
        childIds={childIds}
        stage={stage}
        riseFailed={riseFailed}
        pending={pending}
        onRise={() => void fire(riseFailed ? 'retry-rise' : 'rise')}
      />
    </Suspense>
  )
}

function RiseBoard({
  seanceId,
  childIds,
  stage,
  riseFailed,
  pending,
  onRise,
}: {
  seanceId: string
  childIds: string[]
  stage?: string
  riseFailed: boolean
  pending: boolean
  onRise: () => void
}) {
  const {data} = useQuery<{
    seance: {
      url?: string
      slug?: {current?: string}
      releaseId?: string
      targetSchemaId?: string
      status?: string
      vesselUrl?: string
      platform?: string
    } | null
    ledger: LedgerRow[]
    required: number
    requiredAnswered: number
    blessed: number
    failedTasks: number
  }>({
    query: `{
      "seance": *[_id == $seanceId][0]{url, slug, releaseId, targetSchemaId, status, vesselUrl, platform},
      "ledger": *[_type == "redirectLedgerEntry" && seance._ref == $seanceId] | order(from asc){_id, from, to, status, reason},
      "required": count(*[_type == "question" && seance._ref == $seanceId && required == true]),
      "requiredAnswered": count(*[_type == "question" && seance._ref == $seanceId && required == true && defined(answer)]),
      "blessed": count(*[_type == "sanity.workflow.instance" && _id in $childIds && currentStage == "blessed"]),
      "failedTasks": count(*[_type == "task" && seance._ref == $seanceId && status == "failed"])
    }`,
    params: {seanceId, childIds},
  })

  const seance = data?.seance
  const releaseId = seance?.releaseId
  const risen = stage === 'risen' || seance?.status === 'risen'
  const ledger = data?.ledger ?? []
  const coverage = ledgerCoverage(ledger)
  const gates = [
    {
      ok: (data?.required ?? 0) === (data?.requiredAnswered ?? 0),
      label: `${data?.requiredAnswered ?? 0} of ${data?.required ?? 0} required questions answered`,
    },
    {
      ok: childIds.length > 0 && (data?.blessed ?? 0) === childIds.length,
      label: `${data?.blessed ?? 0} of ${childIds.length} pages blessed`,
    },
    {
      ok: Boolean(seance?.targetSchemaId) && (data?.failedTasks ?? 0) === 0,
      label: seance?.targetSchemaId
        ? data?.failedTasks
          ? `${data.failedTasks} cast${data.failedTasks === 1 ? '' : 's'} failed`
          : 'Schema deployed, Agent Actions ran clean'
        : 'Schema not deployed yet',
    },
    {
      ok: coverage.total > 0 && coverage.accounted === coverage.total,
      label: `${coverage.accounted} / ${coverage.total} URLs accounted for`,
    },
  ]
  const liveUrl = seance?.vesselUrl ?? `${VESSEL_URL}/${SHOWCASE_DATASET}`
  const previewUrl =
    releaseId && !risen ? `${VESSEL_URL}/${SHOWCASE_DATASET}?perspective=${releaseId}` : liveUrl

  return (
    <Stack space={4}>
      <Card padding={[4, 4, 5]} radius={2} style={panelStyle}>
        <Stack space={4}>
          <Flex align="flex-end" justify="space-between" gap={4} wrap="wrap">
            <Stack space={3} style={{maxWidth: 560}}>
              <Heading size={3} className="necro-serif" style={{fontWeight: 400}}>
                Rise
              </Heading>
              <Text muted style={{lineHeight: 1.5}}>
                The old site on the left, the Vessel rendering the release on the right. Same face,
                new bones.
              </Text>
            </Stack>
          </Flex>
          <Compare
            oldUrl={seance?.url}
            newUrl={previewUrl}
            platform={seance?.platform}
            risen={risen}
          />
        </Stack>
      </Card>

      <Grid columns={[1, 1, 12]} gap={4}>
        <Card padding={4} radius={2} style={{...panelStyle, gridColumn: 'span 7'}}>
          <Stack space={3}>
            <Flex justify="space-between" align="center" wrap="wrap" gap={2}>
              <span style={eyebrowStyle}>Redirect ledger</span>
              <span
                className="necro-mono"
                style={{
                  fontSize: 12,
                  color: coverage.pct === 100 ? '#8FD95A' : 'var(--necro-ember-soft)',
                }}
              >
                {coverage.accounted} / {coverage.total} URLs accounted for
              </span>
            </Flex>
            {ledger.length ? (
              <Box style={{overflowX: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 13}}>
                  <thead>
                    <tr style={{color: 'var(--necro-faint)', textAlign: 'left'}}>
                      <th style={{padding: '6px 4px', fontWeight: 500}}>old path</th>
                      <th aria-hidden />
                      <th style={{padding: '6px 4px', fontWeight: 500}}>new path</th>
                      <th style={{padding: '6px 4px', fontWeight: 500}}>status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((row) => (
                      <tr
                        key={row._id}
                        style={{borderTop: '1px solid var(--necro-line)'}}
                        title={row.reason}
                      >
                        <td
                          className="necro-mono"
                          style={{padding: '8px 4px', overflowWrap: 'anywhere'}}
                        >
                          {row.from}
                        </td>
                        <td style={{padding: '8px 4px', color: 'var(--necro-faint)'}}>→</td>
                        <td
                          className="necro-mono"
                          style={{padding: '8px 4px', overflowWrap: 'anywhere'}}
                        >
                          {row.to}
                        </td>
                        <td
                          style={{
                            padding: '8px 4px',
                            color:
                              row.status === 'dropped'
                                ? 'var(--necro-ember-soft)'
                                : row.from === row.to
                                  ? '#8FD95A'
                                  : 'var(--necro-alive-soft)',
                          }}
                        >
                          {ledgerLabel(row)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            ) : (
              <Text size={1} muted>
                The ledger is written when the site is reanimated.
              </Text>
            )}
          </Stack>
        </Card>

        <Card padding={4} radius={2} style={{...panelStyle, gridColumn: 'span 5'}}>
          <Stack space={4}>
            <Stack space={2}>
              <span style={eyebrowStyle}>
                Release “Resurrection · {seance?.slug?.current ?? 'this site'}”
              </span>
              {releaseId ? (
                <ReleaseStats releaseId={releaseId} />
              ) : (
                <Text size={1} muted>
                  No release yet.
                </Text>
              )}
            </Stack>
            <Stack space={2} as="ul" style={{listStyle: 'none', margin: 0, padding: 0}}>
              {gates.map((g) => (
                <Flex as="li" key={g.label} align="center" gap={2}>
                  <span
                    aria-hidden
                    style={{color: g.ok ? '#8FD95A' : 'var(--necro-ember)', width: 14}}
                  >
                    {g.ok ? '✓' : '•'}
                  </span>
                  <span
                    style={{fontSize: 13, color: g.ok ? 'var(--necro-bone)' : 'var(--necro-dust)'}}
                  >
                    {g.label}
                    <span className="sr-only">{g.ok ? ' (met)' : ' (not met)'}</span>
                  </span>
                </Flex>
              ))}
            </Stack>

            {risen ? (
              <Stack space={3}>
                <Flex align="center" gap={3}>
                  <span
                    className="necro-flicker"
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      background: 'var(--necro-alive)',
                    }}
                    aria-hidden
                  />
                  <span className="necro-serif" style={{fontSize: 28}}>
                    It lives.
                  </span>
                </Flex>
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="necro-mono"
                  style={{fontSize: 13}}
                >
                  {liveUrl.replace(/^https?:\/\//, '')} ↗
                </a>
              </Stack>
            ) : (
              <Stack space={2}>
                <button
                  type="button"
                  style={{...primaryButton(stage !== 'rising' || pending), width: '100%'}}
                  disabled={stage !== 'rising' || pending}
                  onClick={onRise}
                >
                  {pending ? 'Rising…' : riseFailed ? 'Retry Rise' : 'Rise'}
                </button>
                <Text
                  size={1}
                  style={{color: riseFailed ? 'var(--necro-ember)' : 'var(--necro-faint)'}}
                >
                  {riseFailed
                    ? 'The last rise failed. Nothing was published; try again.'
                    : stage === 'rising'
                      ? 'Publishes the release. The old URLs start redirecting.'
                      : 'Rise opens once every page is blessed.'}
                </Text>
              </Stack>
            )}
          </Stack>
        </Card>
      </Grid>
    </Stack>
  )
}

function ReleaseStats({releaseId}: {releaseId: string}) {
  const {data} = useQuery<{docs: number; assets: number}>({
    query: `{
      "docs": count(*[_id in path($prefix)]),
      "assets": count(*[_type == "sanity.imageAsset"])
    }`,
    params: {prefix: `versions.${releaseId}.**`},
    projectId: PROJECT_ID,
    dataset: SHOWCASE_DATASET,
    perspective: 'raw',
  })
  return (
    <Text size={1} muted>
      {data?.docs ?? 0} documents · {data?.assets ?? 0} assets · schema deployed to{' '}
      {SHOWCASE_DATASET}
    </Text>
  )
}

/** Before/after: old site vs the Vessel, revealed by a range slider. */
function Compare({
  oldUrl,
  newUrl,
  platform,
  risen,
}: {
  oldUrl?: string
  newUrl: string
  platform?: string
  risen: boolean
}) {
  const [pos, setPos] = useState(50)
  return (
    <Stack space={3}>
      <Flex align="center" gap={3}>
        <label htmlFor="rise-compare" style={{fontSize: 13, color: 'var(--necro-dust)'}}>
          Compare
        </label>
        <input
          id="rise-compare"
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.currentTarget.value))}
          style={{flexGrow: 1, maxWidth: 320, accentColor: 'var(--necro-alive)'}}
        />
      </Flex>
      <Box
        style={{
          position: 'relative',
          height: 520,
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid var(--necro-line)',
          background: '#fff',
        }}
      >
        {oldUrl ? (
          <iframe
            title="The old site"
            src={oldUrl}
            style={{position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0}}
          />
        ) : null}
        <iframe
          title="The Vessel rendering the release"
          src={newUrl}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            border: 0,
            clipPath: `inset(0 0 0 ${pos}%)`,
            background: '#fff',
          }}
        />
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${pos}%`,
            width: 2,
            background: 'var(--necro-alive)',
          }}
        />
        <span style={tag('left')}>Old site{platform ? ` · ${platform}` : ''}</span>
        <span style={tag('right')}>Vessel · {risen ? 'published' : 'release perspective'}</span>
      </Box>
      <Text size={1} style={{color: 'var(--necro-faint)'}}>
        If the old site refuses to be framed, it shows blank on the left.{' '}
        {oldUrl ? (
          <a href={oldUrl} target="_blank" rel="noreferrer">
            Open it ↗
          </a>
        ) : null}{' '}
        ·{' '}
        <a href={newUrl} target="_blank" rel="noreferrer">
          Open the Vessel ↗
        </a>
      </Text>
    </Stack>
  )
}

function tag(side: 'left' | 'right'): CSSProperties {
  return {
    position: 'absolute',
    bottom: 12,
    [side]: 12,
    padding: '4px 10px',
    borderRadius: 4,
    background: 'rgba(14, 13, 12, 0.85)',
    color: 'var(--necro-bone)',
    fontSize: 12,
  }
}
