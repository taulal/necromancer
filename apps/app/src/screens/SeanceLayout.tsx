import {Suspense, useState} from 'react'
import {Link, NavLink, Outlet, useParams} from 'react-router'
import {useDocumentProjection} from '@sanity/sdk-react'
import {useDocumentWorkflows, useWorkflowSession} from '@sanity/workflow-sdk'
import {Box, Button, Flex, Heading, Spinner, Stack, Text} from '@sanity/ui'
import {PendingWorkKicker} from '../lib/useDrainKicker'
import {useNecroEngine} from '../lib/useNecroEngine'
import {seanceGdrUri} from '../lib/seanceGdr'
import {AuditTrail} from './seance/AuditTrail'
import {ResurrectionDiagram} from './seance/ResurrectionDiagram'
import {STAGE_SCREENS, visitedScreenPaths} from './seance/stageRoutes'

function SeanceTitle({seanceId}: {seanceId: string}) {
  const {data} = useDocumentProjection<{
    url?: string
    slug?: {current?: string}
    platform?: string
    status?: string
  }>({
    documentId: seanceId,
    documentType: 'seance',
    projection: `{url, slug, platform, status}`,
  })

  let host = data?.slug?.current || seanceId
  try {
    if (data?.url) host = new URL(data.url).hostname.replace(/^www\./, '')
  } catch {
    /* keep */
  }

  return (
    <Stack space={2}>
      <Text size={1}>
        <Link to="/" style={{color: 'var(--necro-dust)', textDecoration: 'none'}}>
          ← Graveyard
        </Link>
      </Text>
      <Heading size={3} className="necro-serif" style={{fontWeight: 400}}>
        {host}
      </Heading>
      <Text size={1} className="necro-mono" muted>
        {data?.url || '—'} · {data?.platform || 'unknown'} · {data?.status || '—'}
      </Text>
    </Stack>
  )
}

function SeanceWorkflowChrome({seanceId}: {seanceId: string}) {
  const engine = useNecroEngine()
  const list = useDocumentWorkflows({engine, document: seanceGdrUri(seanceId)})
  const instanceId = list.instances?.[0]?._id
  if (!instanceId) {
    return (
      <Stack space={4}>
        <Text size={1} muted>
          No resurrection instance yet.
        </Text>
        <StageTabs visited={new Set()} />
        <Outlet />
      </Stack>
    )
  }
  return <SeanceWorkflowSession instanceId={instanceId} />
}

function SeanceWorkflowSession({instanceId}: {instanceId: string}) {
  const engine = useNecroEngine()
  const session = useWorkflowSession({engine, instanceId})
  const [auditOpen, setAuditOpen] = useState(true)
  const evaluation = session.evaluation
  const instance = evaluation?.instance
  const definition = evaluation?.definition
  const currentStage = instance?.currentStage
  const history = instance?.history ?? []
  const visited = visitedScreenPaths(history)

  return (
    <Stack space={4}>
      <Flex align="flex-start" justify="space-between" gap={4} wrap="wrap">
        <Box flex={1} style={{minWidth: 280}}>
          {definition ? (
            <ResurrectionDiagram
              instanceId={instanceId}
              definition={definition}
              currentStage={currentStage}
              history={history}
            />
          ) : (
            <Text size={1} muted>
              {session.ready ? 'Definition unavailable.' : 'Loading ritual diagram…'}
            </Text>
          )}
        </Box>
        <Stack space={2} style={{alignItems: 'flex-end'}}>
          <EntombedRetryControls session={session} />
          <Button
            mode="ghost"
            text={auditOpen ? 'Hide audit trail' : 'Audit trail'}
            onClick={() => setAuditOpen((v) => !v)}
          />
        </Stack>
      </Flex>

      <StageTabs visited={visited} currentStage={currentStage} />

      <Flex gap={4} align="flex-start" wrap="wrap">
        <Box flex={1} style={{minWidth: 0}}>
          <Outlet />
        </Box>
        {auditOpen ? (
          <Box style={{flex: '0 0 280px'}}>
            <AuditTrail history={history} />
          </Box>
        ) : null}
      </Flex>
    </Stack>
  )
}

function StageTabs({visited, currentStage}: {visited: Set<string>; currentStage?: string}) {
  return (
    <Flex as="nav" gap={1} wrap="wrap" style={{borderBottom: '1px solid var(--necro-line)'}}>
      {STAGE_SCREENS.map((s) => {
        const stageLit =
          visited.has(s.path) ||
          (currentStage !== undefined && (s.stages as readonly string[]).includes(currentStage))
        return (
          <NavLink
            key={s.path}
            to={s.path}
            style={({isActive}) => ({
              padding: '10px 14px',
              textDecoration: 'none',
              color: isActive
                ? 'var(--necro-alive)'
                : stageLit
                  ? 'var(--necro-bone)'
                  : 'var(--necro-dust)',
              borderBottom: isActive
                ? '2px solid var(--necro-alive)'
                : stageLit
                  ? '2px solid var(--necro-line-strong)'
                  : '2px solid transparent',
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            })}
          >
            {s.label}
          </NavLink>
        )
      })}
    </Flex>
  )
}

function EntombedRetryControls({session}: {session: ReturnType<typeof useWorkflowSession>}) {
  const [pending, setPending] = useState(false)
  const stage = session.evaluation?.instance.currentStage
  const from = session.evaluation?.instance.fields?.find(
    (f) => f.name === 'entombedFromStage',
  )?.value

  if (stage !== 'entombed') return null

  return (
    <Stack space={2} style={{alignItems: 'flex-end'}}>
      <Text size={1} style={{color: 'var(--necro-ember)'}}>
        Entombed{typeof from === 'string' && from ? ` · failed at ${from}` : ''}
      </Text>
      <Button
        text="Retry"
        tone="caution"
        disabled={pending || !session.ready}
        loading={pending}
        onClick={() => {
          setPending(true)
          void session
            .fireAction({activity: 'retry', action: 'retry-from-entomb'})
            .finally(() => setPending(false))
        }}
      />
    </Stack>
  )
}

/** Séance shell — BRIEF.md §8.2; stage screens render in the outlet. */
export function SeanceLayout() {
  const {seanceId} = useParams()
  if (!seanceId) return null

  return (
    <Box style={{minHeight: '100vh', background: 'var(--necro-ground)'}} padding={5}>
      <Suspense fallback={null}>
        <PendingWorkKicker />
      </Suspense>
      <Stack space={4}>
        <Suspense
          fallback={
            <Flex justify="center" padding={4}>
              <Spinner muted />
            </Flex>
          }
        >
          <SeanceTitle seanceId={seanceId} />
        </Suspense>
        <Suspense
          fallback={
            <Flex justify="center" padding={6}>
              <Spinner muted />
            </Flex>
          }
        >
          <SeanceWorkflowChrome seanceId={seanceId} />
        </Suspense>
      </Stack>
    </Box>
  )
}
