import {Suspense, useMemo, useState, type CSSProperties, type ReactNode} from 'react'
import {Link, useParams} from 'react-router'
import {useCurrentUser, useDocumentProjection, useEditDocument, useQuery} from '@sanity/sdk-react'
import {useDocumentWorkflows, useWorkflowSession} from '@sanity/workflow-sdk'
import {Box, Card, Flex, Grid, Heading, Spinner, Stack, Text} from '@sanity/ui'
import {useNecroEngine} from '../lib/useNecroEngine'
import {seanceGdrUri} from '../lib/seanceGdr'
import {PROJECT_ID, SHOWCASE_DATASET, VESSEL_URL} from '../lib/config'
import {
  agentLabel,
  groupByChild,
  idFromRef,
  isOpen,
  ritualCounts,
  type ChildRow,
  type PageGroup,
  type TaskRow,
} from './ritual/ritual'

const panelStyle: CSSProperties = {
  background: 'var(--necro-surface)',
  border: '1px solid var(--necro-line)',
}

const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--necro-faint)',
}

const TASK_PROJECTION = `{
  _id, title, why, mode, action, status, result, page, pagePath, pageType, exhumedPage, agentAction, castMs
}`

const PRE_RITUAL = new Set(['summoned', 'exhuming', 'autopsy', 'interrogation'])

type Effect = {name?: string; status?: string}

/** Ritual — NEC-UI4 / docs/prototype/Ritual.dc.html + batch-4. */
export function Ritual() {
  const {seanceId} = useParams()
  if (!seanceId) return null
  return (
    <Suspense fallback={<Centered />}>
      <RitualStage seanceId={seanceId} />
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

function Quiet({title, children}: {title: string; children: ReactNode}) {
  return (
    <Card padding={5} radius={2} style={panelStyle}>
      <Stack space={3}>
        <Heading size={2} className="necro-serif" style={{fontWeight: 400}}>
          {title}
        </Heading>
        {children}
      </Stack>
    </Card>
  )
}

function RitualStage({seanceId}: {seanceId: string}) {
  const engine = useNecroEngine()
  const list = useDocumentWorkflows({engine, document: seanceGdrUri(seanceId)})
  const instanceId = list.instances?.[0]?._id
  if (!instanceId) {
    return (
      <Quiet title="The ritual">
        <Text muted>No resurrection instance yet.</Text>
      </Quiet>
    )
  }
  return <RitualSession seanceId={seanceId} instanceId={instanceId} />
}

function RitualSession({seanceId, instanceId}: {seanceId: string; instanceId: string}) {
  const engine = useNecroEngine()
  const session = useWorkflowSession({engine, instanceId})
  const instance = session.evaluation?.instance
  const stage = instance?.currentStage
  const effects = (instance?.effects ?? []) as Effect[]
  const childIds = useMemo(
    () =>
      ((instance as {subworkflows?: Array<{ref?: {id?: string}}>} | undefined)?.subworkflows ?? [])
        .map((s) => idFromRef(s.ref?.id))
        .filter((id): id is string => !!id),
    [instance],
  )

  if (!stage || PRE_RITUAL.has(stage)) {
    return (
      <Quiet title="The ritual">
        <Text muted>The ritual begins once the site is reanimated into its release.</Text>
        <Text size={1} style={{color: 'var(--necro-faint)'}}>
          Nothing needs you. The dead are patient.
        </Text>
      </Quiet>
    )
  }

  if (stage === 'reanimating') {
    const status = (name: string) => effects.find((e) => e.name === name)?.status ?? 'waiting'
    return (
      <Quiet title="Reanimating">
        <Text muted>
          Deploying the anatomy, raising every page into the release, uploading its images, writing
          the redirects.
        </Text>
        <Box
          className="necro-soil"
          style={{height: 6, borderRadius: 3, maxWidth: 360}}
          aria-hidden
        />
        <Stack space={2}>
          <Text size={1} className="necro-mono" muted>
            necro.reanimate · {status('necro.reanimate')}
          </Text>
          <Text size={1} className="necro-mono" muted>
            necro.plan-ritual · {status('necro.plan-ritual')}
          </Text>
        </Stack>
      </Quiet>
    )
  }

  return (
    <Suspense fallback={<Centered />}>
      <RitualBoard seanceId={seanceId} childIds={childIds} parentStage={stage} />
    </Suspense>
  )
}

function RitualBoard({
  seanceId,
  childIds,
  parentStage,
}: {
  seanceId: string
  childIds: string[]
  parentStage: string
}) {
  const engine = useNecroEngine()
  const {data} = useQuery<{
    tasks: TaskRow[]
    children: Array<{_id: string; currentStage?: string; page?: unknown; castFailed?: unknown}>
    pages: Array<{_id: string; path?: string}>
    releaseId?: string
  }>({
    query: `{
      "tasks": *[_type == "task" && seance._ref == $seanceId] | order(_createdAt asc) ${TASK_PROJECTION},
      "children": *[_type == "sanity.workflow.instance" && _id in $childIds]{
        _id, currentStage,
        "page": fields[name == "page"][0].value,
        "castFailed": fields[name == "castFailed"][0].value
      },
      "pages": *[_type == "exhumedPage" && seance._ref == $seanceId]{_id, "path": coalesce(target.path, path)},
      "releaseId": *[_id == $seanceId][0].releaseId
    }`,
    params: {seanceId, childIds},
  })

  const tasks = data?.tasks ?? []
  const children: ChildRow[] = (data?.children ?? []).map((c) => ({
    _id: c._id,
    currentStage: c.currentStage,
    pageId: idFromRef(c.page),
    castFailed: c.castFailed === true,
  }))
  const pathById = new Map((data?.pages ?? []).map((p) => [p._id, p.path ?? '/']))
  const {groups, quiet} = groupByChild(tasks, children, (id) =>
    id ? (pathById.get(id) ?? id) : '?',
  )
  const counts = ritualCounts(tasks, children)
  const humanOpen = tasks.filter((t) => t.mode === 'human' && isOpen(t))
  const [focusId, setFocusId] = useState<string | null>(null)
  const focused = humanOpen.find((t) => t._id === focusId) ?? humanOpen[0] ?? null

  const recastable = groups.filter(
    (g) =>
      g.child.currentStage === 'reviewing' && g.tasks.some((t) => t.mode === 'auto' && isOpen(t)),
  )
  const quietReviewing = quiet.filter((c) => c.currentStage === 'reviewing')
  const [busy, setBusy] = useState<string | null>(null)

  const fireMany = async (label: string, ids: string[], action: 'approve' | 'recast') => {
    setBusy(label)
    try {
      for (const instanceId of ids) {
        await engine.fireAction({instanceId, activity: 'review', action})
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <Grid columns={[1, 1, 12]} gap={4}>
      <Stack space={4} style={{gridColumn: 'span 8'}}>
        <Card padding={[4, 4, 5]} radius={2} style={panelStyle}>
          <Stack space={4}>
            <Flex align="flex-start" justify="space-between" gap={4} wrap="wrap">
              <Stack space={3} style={{maxWidth: 560}}>
                <Heading size={3} className="necro-serif" style={{fontWeight: 400}}>
                  The ritual
                </Heading>
                <Text muted style={{lineHeight: 1.5}}>
                  Content is in the release, not live. One small workflow per page: cast the
                  automatic tasks, then bless the page.
                </Text>
              </Stack>
              <button
                type="button"
                style={primaryButton(recastable.length === 0 || busy != null)}
                disabled={recastable.length === 0 || busy != null}
                onClick={() =>
                  void fireMany(
                    'cast',
                    recastable.map((g) => g.child._id),
                    'recast',
                  )
                }
              >
                {busy === 'cast' ? 'Casting…' : `Cast all auto (${counts.autoLeft})`}
              </button>
            </Flex>

            <Flex gap={3} wrap="wrap">
              <Stat value={counts.total} label="tasks" />
              <Stat value={counts.done} label="done" />
              <Stat value={counts.autoLeft} label="auto, waiting" />
              <Stat value={counts.humanLeft} label="need you" />
              <Stat value={`${counts.blessed}/${counts.pages}`} label="pages blessed" />
            </Flex>

            {counts.failed ? (
              <Text size={1} style={{color: 'var(--necro-ember)'}}>
                {counts.failed} cast{counts.failed === 1 ? '' : 's'} failed. Recast the page to try
                again; the error is on the task.
              </Text>
            ) : null}
          </Stack>
        </Card>

        {groups.map((g) => (
          <PageGroupCard
            key={g.child._id}
            group={g}
            onFocus={setFocusId}
            onAction={(action) => fireMany(`${action}:${g.child._id}`, [g.child._id], action)}
            busy={busy}
          />
        ))}

        {quiet.length ? (
          <Card padding={4} radius={2} style={panelStyle}>
            <Flex align="center" justify="space-between" gap={3} wrap="wrap">
              <Text size={1} muted>
                {quiet.length} page{quiet.length === 1 ? '' : 's'} with nothing to cast ·{' '}
                {quiet.filter((c) => c.currentStage === 'blessed').length} blessed
              </Text>
              <button
                type="button"
                style={ghostButton(quietReviewing.length === 0 || busy != null)}
                disabled={quietReviewing.length === 0 || busy != null}
                onClick={() =>
                  void fireMany(
                    'bless-quiet',
                    quietReviewing.map((c) => c._id),
                    'approve',
                  )
                }
              >
                {busy === 'bless-quiet'
                  ? 'Blessing…'
                  : `Bless quiet pages (${quietReviewing.length})`}
              </button>
            </Flex>
          </Card>
        ) : null}

        {!groups.length && !quiet.length ? (
          <Card padding={4} radius={2} style={panelStyle}>
            <Text muted>
              {parentStage === 'ritual'
                ? 'Summoning one ritual per page…'
                : 'Every page has been blessed.'}
            </Text>
          </Card>
        ) : null}
      </Stack>

      <Box style={{gridColumn: 'span 4'}}>
        <HumanPanel task={focused} left={humanOpen.length} releaseId={data?.releaseId} />
      </Box>
    </Grid>
  )
}

function Stat({value, label}: {value: number | string; label: string}) {
  return (
    <Stack
      space={2}
      style={{
        padding: '10px 14px',
        borderRadius: 8,
        border: '1px solid var(--necro-line)',
        background: 'var(--necro-well)',
        minWidth: 96,
      }}
    >
      <span className="necro-mono" style={{fontSize: 18, color: 'var(--necro-bone)'}}>
        {value}
      </span>
      <span style={{fontSize: 12, color: 'var(--necro-faint)'}}>{label}</span>
    </Stack>
  )
}

const STAGES = ['casting', 'reviewing', 'blessed'] as const

function PageGroupCard({
  group,
  onFocus,
  onAction,
  busy,
}: {
  group: PageGroup
  onFocus: (taskId: string) => void
  onAction: (action: 'approve' | 'recast') => Promise<void>
  busy: string | null
}) {
  const stage = group.child.currentStage ?? 'casting'
  const humanOpen = group.tasks.filter((t) => t.mode === 'human' && isOpen(t)).length
  const reviewing = stage === 'reviewing'

  return (
    <Card padding={4} radius={2} style={panelStyle}>
      <Stack space={3}>
        <Flex align="center" gap={3} wrap="wrap">
          <span className="necro-mono" style={{fontSize: 14, color: 'var(--necro-bone)'}}>
            {group.path}
          </span>
          <Flex align="center" gap={2} aria-label={`Stage: ${stage}`}>
            {STAGES.map((s, i) => (
              <Flex key={s} align="center" gap={2}>
                {i > 0 ? (
                  <span style={{width: 16, height: 1, background: 'var(--necro-line-strong)'}} />
                ) : null}
                <span
                  className={s === stage && s !== 'blessed' ? 'necro-flicker' : undefined}
                  style={{
                    fontSize: 12,
                    padding: '2px 8px',
                    borderRadius: 999,
                    color:
                      s === stage
                        ? s === 'blessed'
                          ? '#8FD95A'
                          : 'var(--necro-bone)'
                        : 'var(--necro-faint)',
                    border: `1px solid ${s === stage ? 'var(--necro-alive)' : 'transparent'}`,
                  }}
                >
                  {s}
                </span>
              </Flex>
            ))}
          </Flex>
          <span style={{flexGrow: 1}} />
          {reviewing ? (
            <Flex gap={2}>
              <button
                type="button"
                style={ghostButton(busy != null)}
                disabled={busy != null}
                onClick={() => void onAction('recast')}
              >
                Recast
              </button>
              <button
                type="button"
                style={primaryButton(humanOpen > 0 || busy != null)}
                disabled={humanOpen > 0 || busy != null}
                title={humanOpen ? 'Resolve the human tasks on this page first' : undefined}
                onClick={() => void onAction('approve')}
              >
                Bless
              </button>
            </Flex>
          ) : null}
        </Flex>

        {group.child.castFailed ? (
          <Text size={1} style={{color: 'var(--necro-ember)'}}>
            A cast failed on this page. Recast to try again.
          </Text>
        ) : null}

        {group.tasks.map((t) => (
          <TaskLine key={t._id} task={t} onFocus={onFocus} />
        ))}
      </Stack>
    </Card>
  )
}

function TaskLine({task, onFocus}: {task: TaskRow; onFocus: (id: string) => void}) {
  const human = task.mode === 'human'
  return (
    <Flex
      align="flex-start"
      gap={3}
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        background: 'var(--necro-well)',
        border: '1px solid var(--necro-line)',
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: human ? 'var(--necro-ember-soft)' : 'var(--necro-alive)',
          minWidth: 44,
          paddingTop: 2,
        }}
      >
        {task.mode}
      </span>
      <Stack space={2} style={{flexGrow: 1, minWidth: 0}}>
        <span style={{fontSize: 14, color: 'var(--necro-bone)'}}>{task.title ?? task.action}</span>
        {task.why ? (
          <span style={{fontSize: 12, color: 'var(--necro-faint)', overflowWrap: 'anywhere'}}>
            {task.why}
          </span>
        ) : null}
        {task.result &&
        (task.status === 'done' || task.status === 'failed' || task.status === 'skipped') ? (
          <span
            style={{
              fontSize: 12,
              color: task.status === 'failed' ? 'var(--necro-ember)' : 'var(--necro-dust)',
              overflowWrap: 'anywhere',
            }}
          >
            {task.result}
          </span>
        ) : null}
      </Stack>
      <span
        className="necro-mono"
        style={{fontSize: 11, color: 'var(--necro-faint)', paddingTop: 3}}
      >
        {agentLabel(task)}
      </span>
      <Box style={{minWidth: 96, textAlign: 'right'}}>
        <TaskStatus task={task} onFocus={onFocus} />
      </Box>
    </Flex>
  )
}

function TaskStatus({task, onFocus}: {task: TaskRow; onFocus: (id: string) => void}) {
  if (task.mode === 'human' && isOpen(task)) {
    return (
      <button type="button" style={ghostButton(false)} onClick={() => onFocus(task._id)}>
        Step through
      </button>
    )
  }
  switch (task.status) {
    case 'casting':
      return (
        <Flex align="center" gap={2} justify="flex-end">
          <span
            className="necro-soil"
            style={{width: 36, height: 6, borderRadius: 3}}
            aria-hidden
          />
          <span style={{fontSize: 12, color: 'var(--necro-bone)'}}>casting</span>
        </Flex>
      )
    case 'done':
      return <span style={{fontSize: 12, color: '#8FD95A'}}>✓ done</span>
    case 'failed':
      return <span style={{fontSize: 12, color: 'var(--necro-ember)'}}>failed</span>
    case 'skipped':
      return <span style={{fontSize: 12, color: 'var(--necro-faint)'}}>skipped</span>
    default:
      return <span style={{fontSize: 12, color: 'var(--necro-faint)'}}>queued</span>
  }
}

function HumanPanel({
  task,
  left,
  releaseId,
}: {
  task: TaskRow | null
  left: number
  releaseId?: string
}) {
  return (
    <Card padding={4} radius={2} style={{...panelStyle, background: '#141312'}}>
      <Stack space={4}>
        <span style={eyebrowStyle}>Needs you · {left} left</span>
        {task ? (
          <Suspense fallback={<Spinner muted />}>
            <HumanTask key={task._id} task={task} releaseId={releaseId} />
          </Suspense>
        ) : (
          <p className="necro-serif" style={{margin: 0, fontSize: 20, lineHeight: 1.4}}>
            Nothing needs you. The dead are patient.
          </p>
        )}
        <Link to="../rise" relative="path" style={{fontSize: 13, textDecoration: 'none'}}>
          Preview the rising →
        </Link>
      </Stack>
    </Card>
  )
}

function HumanTask({task, releaseId}: {task: TaskRow; releaseId?: string}) {
  const user = useCurrentUser()
  const handle = {documentId: task._id, documentType: 'task'}
  const editStatus = useEditDocument<string>({...handle, path: 'status'})
  const editResult = useEditDocument<string>({...handle, path: 'result'})
  const previewHref =
    releaseId && task.pagePath
      ? `${VESSEL_URL}/${SHOWCASE_DATASET}${task.pagePath === '/' ? '' : task.pagePath}?perspective=${releaseId}`
      : undefined

  const resolve = (status: 'done' | 'skipped', note: string) => {
    void editStatus(status)
    void editResult(`${note}${user?.name ? ` (${user.name})` : ''}`)
  }

  return (
    <Stack space={4}>
      <h2
        className="necro-serif"
        style={{margin: 0, fontSize: 24, fontWeight: 400, lineHeight: 1.25}}
      >
        {task.title}
      </h2>
      {task.why ? (
        <p style={{margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--necro-dust)'}}>
          {task.why}
        </p>
      ) : null}
      {releaseId && task.page ? <TargetPreview docId={task.page} releaseId={releaseId} /> : null}
      <Flex gap={2} wrap="wrap">
        <button
          type="button"
          style={primaryButton(false)}
          onClick={() => resolve('done', 'Resolved')}
        >
          Done, it’s handled
        </button>
        <button
          type="button"
          style={ghostButton(false)}
          onClick={() => resolve('skipped', 'Skipped')}
        >
          Skip
        </button>
        {previewHref ? (
          <a
            href={previewHref}
            target="_blank"
            rel="noreferrer"
            style={{
              ...ghostButton(false),
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Open preview ↗
          </a>
        ) : null}
      </Flex>
    </Stack>
  )
}

/** The target doc as it sits in the release (showcase, release perspective). */
function TargetPreview({docId, releaseId}: {docId: string; releaseId: string}) {
  const {data} = useQuery<{_type?: string; title?: string; name?: string; blocks?: number} | null>({
    query: `*[_id == $id][0]{_type, title, name, "blocks": count(body)}`,
    params: {id: docId},
    projectId: PROJECT_ID,
    dataset: SHOWCASE_DATASET,
    perspective: [releaseId],
  })
  if (!data) return null
  return (
    <Stack
      space={2}
      style={{
        padding: 12,
        borderRadius: 8,
        border: '1px solid var(--necro-line)',
        background: 'var(--necro-well)',
      }}
    >
      <span className="necro-mono" style={{fontSize: 11, color: 'var(--necro-faint)'}}>
        {data._type} · {SHOWCASE_DATASET} · release {releaseId}
      </span>
      <span style={{fontSize: 14, color: 'var(--necro-bone)'}}>
        {data.title ?? data.name ?? docId}
      </span>
      {typeof data.blocks === 'number' ? (
        <span style={{fontSize: 12, color: 'var(--necro-dust)'}}>{data.blocks} Bones blocks</span>
      ) : null}
    </Stack>
  )
}

function primaryButton(disabled: boolean): CSSProperties {
  return {
    minHeight: 44,
    padding: '0 18px',
    border: 0,
    borderRadius: 8,
    background: 'var(--necro-alive)',
    color: 'var(--necro-ground)',
    fontFamily: 'var(--necro-font-sans)',
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
}

function ghostButton(disabled: boolean): CSSProperties {
  return {
    minHeight: 44,
    padding: '0 14px',
    border: '1px solid var(--necro-line-strong)',
    borderRadius: 8,
    background: 'transparent',
    color: 'var(--necro-dust)',
    fontFamily: 'var(--necro-font-sans)',
    fontSize: 13,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
}

export {primaryButton, ghostButton, panelStyle, eyebrowStyle}
