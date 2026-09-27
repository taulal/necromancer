import {useEffect, useState, type CSSProperties} from 'react'
import {NavLink} from 'react-router'
import {useQuery} from '@sanity/sdk-react'
import {Box, Flex, Stack} from '@sanity/ui'
import {idFromRef, isOpen, type TaskRow} from '../ritual/ritual'
import {
  deriveStageStatus,
  formatDuration,
  type PendingEffectLike,
  type StageStatus,
  type StatusTone,
} from './stageStatus'

type InstanceLike = {
  currentStage?: string
  pendingEffects?: readonly PendingEffectLike[]
  fields?: ReadonlyArray<{name: string; value?: unknown}>
  history?: ReadonlyArray<{_type?: string; at?: string}>
  subworkflows?: ReadonlyArray<{ref?: {id?: string}}>
}

const TONE: Record<StatusTone, {color: string; label: string; pulse: boolean}> = {
  working: {color: 'var(--necro-alive)', label: 'Working', pulse: true},
  queued: {color: 'var(--necro-dust)', label: 'Queued', pulse: true},
  'needs-you': {color: 'var(--necro-ember-soft)', label: 'Needs you', pulse: false},
  waiting: {color: 'var(--necro-faint)', label: 'Moving on', pulse: true},
  done: {color: '#8FD95A', label: 'Done', pulse: false},
  failed: {color: 'var(--necro-ember)', label: 'Failed', pulse: false},
}

/** Re-render every second while something is in flight, so elapsed times tick. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [active])
  return now
}

/**
 * The séance's one-line "what's happening now": which stage, what the worker is
 * doing (step, percent, elapsed), or what it is waiting on you for.
 */
export function StageStatusBar({seanceId, instance}: {seanceId: string; instance: InstanceLike}) {
  const childIds = (instance.subworkflows ?? [])
    .map((s) => idFromRef(s.ref?.id))
    .filter((id): id is string => !!id)

  const {data} = useQuery<{
    questions: Array<{required?: boolean; answer?: string}>
    tasks: Pick<TaskRow, 'mode' | 'status'>[]
    children: Array<{currentStage?: string; castFailed?: unknown}>
    error: {effect?: string; message?: string; at?: string} | null
  }>({
    query: `{
      "questions": *[_type == "question" && seance._ref == $seanceId]{required, answer},
      "tasks": *[_type == "task" && seance._ref == $seanceId]{mode, status},
      "children": *[_type == "sanity.workflow.instance" && _id in $childIds]{
        currentStage, "castFailed": fields[name == "castFailed"][0].value
      },
      "error": *[_id == "necro.effectError" && seanceId == $seanceId][0]{effect, message, at}
    }`,
    params: {seanceId, childIds},
  })

  const stageEnteredAt = [...(instance.history ?? [])]
    .reverse()
    .find((h) => h._type === 'stageEntered')?.at

  const questions = data?.questions ?? []
  const children = data?.children ?? []
  const tasks = data?.tasks ?? []
  const facts = {
    stage: instance.currentStage,
    pendingEffects: instance.pendingEffects,
    fields: instance.fields,
    stageEnteredAt,
    questions: questions.length
      ? {
          total: questions.length,
          left: questions.filter((q) => !q.answer?.trim()).length,
          requiredLeft: questions.filter((q) => q.required && !q.answer?.trim()).length,
        }
      : undefined,
    ritual: {
      pages: children.length,
      casting: children.filter((c) => c.currentStage === 'casting').length,
      reviewing: children.filter((c) => c.currentStage === 'reviewing').length,
      blessed: children.filter((c) => c.currentStage === 'blessed').length,
      humanOpen: tasks.filter((t) => t.mode === 'human' && isOpen(t as TaskRow)).length,
      failed: tasks.filter((t) => t.status === 'failed').length,
    },
    error:
      data?.error && (!stageEnteredAt || (data.error.at ?? '') >= stageEnteredAt)
        ? data.error
        : undefined,
  }

  const inFlight = instance.currentStage !== 'risen' && instance.currentStage !== undefined
  const now = useNow(inFlight)
  const status = deriveStageStatus({...facts, now})
  return <StatusCard status={status} />
}

export function StatusCard({status}: {status: StageStatus}) {
  const tone = TONE[status.tone]
  const meta = [
    status.elapsedMs != null
      ? `${status.tone === 'queued' ? 'queued' : 'running'} ${formatDuration(status.elapsedMs)}`
      : '',
    status.stageMs != null ? `in stage ${formatDuration(status.stageMs)}` : '',
  ].filter(Boolean)

  return (
    <Box
      role="status"
      aria-live="polite"
      padding={4}
      style={{
        background: 'var(--necro-surface)',
        border: '1px solid var(--necro-line)',
        borderLeft: `3px solid ${tone.color}`,
        borderRadius: 2,
      }}
    >
      <Flex align="center" gap={4} wrap="wrap">
        <Stack space={3} style={{flex: '1 1 320px', minWidth: 0}}>
          <Flex align="center" gap={2}>
            <span
              aria-hidden
              className={tone.pulse ? 'necro-pulse' : undefined}
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: tone.color,
                flex: '0 0 auto',
              }}
            />
            <span style={{...eyebrow, color: tone.color}}>{tone.label}</span>
            <span style={eyebrow}>· {status.title}</span>
          </Flex>
          <span
            className="necro-serif"
            style={{fontSize: 20, lineHeight: 1.3, color: 'var(--necro-bone)'}}
          >
            {status.headline}
            {status.tone === 'working' && !status.headline.endsWith('…') ? '…' : ''}
          </span>
          {status.detail ? (
            <span style={{fontSize: 13, lineHeight: 1.5, color: 'var(--necro-dust)'}}>
              {status.detail}
            </span>
          ) : null}
          {status.percent != null && status.tone === 'working' ? (
            <Flex align="center" gap={3}>
              <Box
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={status.percent}
                style={{
                  flex: '1 1 auto',
                  maxWidth: 420,
                  height: 6,
                  borderRadius: 3,
                  background: 'var(--necro-well)',
                  overflow: 'hidden',
                }}
              >
                <div
                  className="necro-soil"
                  style={{
                    width: `${Math.max(4, status.percent)}%`,
                    height: '100%',
                    transition: 'width 400ms ease',
                  }}
                />
              </Box>
              <span className="necro-mono" style={{fontSize: 12, color: 'var(--necro-dust)'}}>
                {status.percent}%
              </span>
            </Flex>
          ) : null}
          {meta.length ? (
            <span className="necro-mono" style={{fontSize: 11, color: 'var(--necro-faint)'}}>
              {meta.join(' · ')}
            </span>
          ) : null}
          {status.hint ? (
            <span style={{fontSize: 12, color: 'var(--necro-ember-soft)'}}>{status.hint}</span>
          ) : null}
        </Stack>
        {status.action ? (
          <NavLink to={status.action.to} style={actionStyle(status.tone)}>
            {status.action.label} →
          </NavLink>
        ) : null}
      </Flex>
    </Box>
  )
}

const eyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--necro-faint)',
}

function actionStyle(tone: StatusTone): CSSProperties {
  const loud = tone === 'needs-you' || tone === 'failed'
  return {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 44,
    padding: '0 18px',
    borderRadius: 8,
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 600,
    background: loud ? 'var(--necro-alive)' : 'transparent',
    color: loud ? 'var(--necro-ground)' : 'var(--necro-dust)',
    border: loud ? 0 : '1px solid var(--necro-line-strong)',
  }
}
