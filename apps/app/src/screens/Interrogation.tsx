import {Suspense, useEffect, useMemo, useRef, useState, type CSSProperties} from 'react'
import {Link, useParams} from 'react-router'
import {editDocument, useApplyDocumentActions, useCurrentUser, useQuery} from '@sanity/sdk-react'
import {useDocumentWorkflows, useWorkflowSession} from '@sanity/workflow-sdk'
import {Box, Card, Flex, Grid, Heading, Spinner, Stack, Text, TextInput} from '@sanity/ui'
import {pagesLabel, tasksForAnswer, type TaskPreview} from '@necro/interrogate/tasks'
import {useNecroEngine} from '../lib/useNecroEngine'
import {seanceGdrUri} from '../lib/seanceGdr'
import {
  counts,
  evidencePath,
  isAnswered,
  KIND_LABEL,
  nextQuestionId,
  orderQuestions,
  shortLabel,
  type QuestionRow,
} from './interrogation/questions'

const QUESTION_PROJECTION = `{
  _id, kind, prompt, required, source, options, answer, answerNote, answeredBy, spawnsTasks,
  evidence[]{_key, quote, url, "path": page->path}
}`

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

/** Interrogation — NEC-UI3 / docs/prototype/Interrogate.dc.html + batch-4. */
export function Interrogation() {
  const {seanceId} = useParams()
  if (!seanceId) return null
  return (
    <Suspense fallback={<Centered />}>
      <InterrogationStage seanceId={seanceId} />
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

/** Resolves the workflow stage so answers lock once interrogation is over. */
function InterrogationStage({seanceId}: {seanceId: string}) {
  const engine = useNecroEngine()
  const list = useDocumentWorkflows({engine, document: seanceGdrUri(seanceId)})
  const instanceId = list.instances?.[0]?._id
  if (!instanceId) return <InterrogationBody seanceId={seanceId} />
  return <InterrogationSession seanceId={seanceId} instanceId={instanceId} />
}

function InterrogationSession({seanceId, instanceId}: {seanceId: string; instanceId: string}) {
  const engine = useNecroEngine()
  const session = useWorkflowSession({engine, instanceId})
  const instance = session.evaluation?.instance
  // Queued or claimed: 0.35 keeps in-flight effects on pendingEffects[].
  const questioning = !!instance?.pendingEffects?.some((e) => e.name === 'necro.interrogate')
  const stage = instance?.currentStage
  const gateValue = instance?.fields?.find((f) => f.name === 'openRequiredQuestions')?.value
  const [gateError, setGateError] = useState<string | null>(null)

  // Belt to the question-gate Function's braces: the workflow only leaves interrogation
  // when openRequiredQuestions hits 0, so keep it in step with the answers on screen.
  const syncGate = useMemo(() => {
    let inFlight: number | null = null
    return (requiredLeft: number) => {
      if (stage !== 'interrogation' || questioning) return
      if (gateValue === requiredLeft || inFlight === requiredLeft) return
      inFlight = requiredLeft
      engine
        .editField({
          instanceId,
          target: {scope: 'workflow', field: 'openRequiredQuestions'},
          mode: 'set',
          value: requiredLeft,
        })
        .then(() => setGateError(null))
        .catch((err: unknown) => setGateError(err instanceof Error ? err.message : String(err)))
        .finally(() => {
          inFlight = null
        })
    }
  }, [engine, instanceId, stage, questioning, gateValue])

  return (
    <InterrogationBody
      seanceId={seanceId}
      locked={!!stage && stage !== 'interrogation'}
      questioning={questioning}
      onRequiredLeft={syncGate}
      gateError={gateError}
    />
  )
}

function InterrogationBody({
  seanceId,
  locked = false,
  questioning = false,
  onRequiredLeft,
  gateError,
}: {
  seanceId: string
  locked?: boolean
  questioning?: boolean
  onRequiredLeft?: (requiredLeft: number) => void
  gateError?: string | null
}) {
  const {data} = useQuery<QuestionRow[]>({
    query: `*[_type == "question" && seance._ref == $seanceId] | order(_createdAt asc) ${QUESTION_PROJECTION}`,
    params: {seanceId},
  })
  const questions = useMemo(() => orderQuestions(data ?? []), [data])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const firstOpen = questions.find((q) => q.required && !isAnswered(q)) ?? questions[0]
  const selected = questions.find((q) => q._id === selectedId) ?? firstOpen ?? null

  useEffect(() => {
    if (!selectedId && firstOpen) setSelectedId(firstOpen._id)
  }, [selectedId, firstOpen])

  const requiredLeft = questions.length ? counts(questions).requiredLeft : null
  useEffect(() => {
    if (requiredLeft != null) onRequiredLeft?.(requiredLeft)
  }, [requiredLeft, onRequiredLeft])

  if (!questions.length) {
    return (
      <Card padding={5} radius={2} style={panelStyle}>
        <Stack space={3}>
          <Heading size={2} className="necro-serif" style={{fontWeight: 400}}>
            Interrogation
          </Heading>
          {questioning ? (
            <>
              <Text muted>Questioning the dead…</Text>
              <Box
                className="necro-soil"
                style={{height: 6, borderRadius: 3, maxWidth: 320}}
                aria-hidden
              />
            </>
          ) : (
            <Text muted>No questions yet. Accept the anatomy and the interrogation begins.</Text>
          )}
          <Text size={1} style={{color: 'var(--necro-faint)'}}>
            Nothing needs you. The dead are patient.
          </Text>
        </Stack>
      </Card>
    )
  }

  const tally = counts(questions)
  const position = selected ? questions.findIndex((q) => q._id === selected._id) + 1 : 0
  const goNext = () => setSelectedId(nextQuestionId(questions, selected?._id ?? null))

  return (
    <Grid columns={[1, 1, 12]} gap={4}>
      <Box style={{gridColumn: 'span 3'}}>
        <QuestionList
          questions={questions}
          selectedId={selected?._id ?? null}
          tally={tally}
          onPick={setSelectedId}
        />
      </Box>

      <Box style={{gridColumn: 'span 6'}}>
        {selected ? (
          <QuestionCard
            key={selected._id}
            q={selected}
            position={position}
            total={tally.total}
            locked={locked}
            onNext={goNext}
          />
        ) : null}
      </Box>

      <Box style={{gridColumn: 'span 3'}}>
        <RitualSoFar questions={questions} requiredLeft={tally.requiredLeft} />
        {gateError ? (
          <Text size={1} style={{color: 'var(--necro-ember)', marginTop: 12}}>
            Couldn’t update the question gate: {gateError}
          </Text>
        ) : null}
      </Box>
    </Grid>
  )
}

function QuestionList({
  questions,
  selectedId,
  tally,
  onPick,
}: {
  questions: QuestionRow[]
  selectedId: string | null
  tally: ReturnType<typeof counts>
  onPick: (id: string) => void
}) {
  return (
    <Card padding={3} radius={2} style={panelStyle}>
      <nav aria-label="Questions">
        <Stack space={1}>
          <Box paddingX={2} paddingBottom={2}>
            <span style={eyebrowStyle}>
              {tally.answered} of {tally.total} answered · {tally.requiredLeft} required left
            </span>
          </Box>
          {questions.map((q) => {
            const current = q._id === selectedId
            const done = isAnswered(q)
            return (
              <button
                key={q._id}
                type="button"
                onClick={() => onPick(q._id)}
                aria-current={current ? 'true' : undefined}
                style={{
                  minHeight: 44,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  border: 0,
                  borderRadius: 6,
                  background: current ? '#1D1B19' : 'transparent',
                  color: 'var(--necro-bone)',
                  fontFamily: 'var(--necro-font-sans)',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                {done ? (
                  <CheckIcon label="answered" />
                ) : (
                  <span
                    style={{width: 14, display: 'flex', justifyContent: 'center', flexShrink: 0}}
                  >
                    <span
                      aria-label={q.required ? 'required, open' : 'open'}
                      role="img"
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        boxSizing: 'border-box',
                        border: `1px solid ${q.required ? 'var(--necro-ember)' : 'var(--necro-line-strong)'}`,
                      }}
                    />
                  </span>
                )}
                <span
                  style={{
                    fontSize: 13,
                    lineHeight: 1.35,
                    flexGrow: 1,
                    color: current ? 'var(--necro-bone)' : done ? 'var(--necro-faint)' : '#D6CFC1',
                  }}
                >
                  {shortLabel(q.prompt)}
                </span>
              </button>
            )
          })}
        </Stack>
      </nav>
    </Card>
  )
}

/** Note edits are saved after the typing settles, not per keystroke. */
const NOTE_DEBOUNCE_MS = 600

/**
 * Renders from the list row (already live-queried), so switching questions never
 * suspends. Answer and note are held locally so clicks land instantly; writes go out
 * as one draft edit per answer.
 */
function QuestionCard({
  q: row,
  position,
  total,
  locked,
  onNext,
}: {
  q: QuestionRow
  position: number
  total: number
  locked: boolean
  onNext: () => void
}) {
  const id = row._id
  const user = useCurrentUser()
  const apply = useApplyDocumentActions()
  const handle = useMemo(() => ({documentId: id, documentType: 'question'}), [id])

  const [answer, setAnswer] = useState(row.answer)
  const [note, setNote] = useState(row.answerNote ?? '')
  const noteTimer = useRef<number | undefined>(undefined)
  const pendingNote = useRef<string | null>(null)

  // Follow the server once our own writes have landed (or someone else answered).
  useEffect(() => setAnswer(row.answer), [row.answer])
  useEffect(() => {
    if (pendingNote.current == null) setNote(row.answerNote ?? '')
  }, [row.answerNote])

  const flushNote = () => {
    window.clearTimeout(noteTimer.current)
    const value = pendingNote.current
    if (value == null) return
    pendingNote.current = null
    void apply(editDocument(handle, {set: {answerNote: value}}))
  }
  useEffect(() => flushNote, []) // save an unsent note when switching questions

  const q = {...row, answer, answerNote: note}
  const answered = isAnswered(q)
  const spawned = tasksForAnswer(q, q.answer)

  const choose = (option: string) => {
    if (locked || option === answer) return
    setAnswer(option)
    void apply(
      editDocument(handle, {
        set: {
          answer: option,
          answeredAt: new Date().toISOString(),
          ...(user?.id ? {answeredBy: user.id} : {}),
        },
      }),
    )
  }

  const changeNote = (value: string) => {
    setNote(value)
    pendingNote.current = value
    window.clearTimeout(noteTimer.current)
    noteTimer.current = window.setTimeout(flushNote, NOTE_DEBOUNCE_MS)
  }

  return (
    <Card padding={[4, 4, 5]} radius={2} style={{...panelStyle, minHeight: 560}}>
      <Stack space={5}>
        <Flex align="center" gap={3} wrap="wrap">
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '4px 10px',
              borderRadius: 4,
              background: 'var(--necro-ember-well)',
              color: 'var(--necro-ember-soft)',
            }}
          >
            {KIND_LABEL[q.kind ?? ''] ?? q.kind ?? 'Question'}
          </span>
          {q.source === 'knowledgeBase' ? (
            <span
              style={{
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 4,
                border: '1px solid var(--necro-line-strong)',
                color: '#D6CFC1',
              }}
            >
              found by Knowledge Base
            </span>
          ) : null}
          {q.required ? (
            <span style={{fontSize: 12, color: 'var(--necro-dust)'}}>required to continue</span>
          ) : null}
          <span style={{flexGrow: 1}} />
          <span className="necro-mono" style={{fontSize: 13, color: 'var(--necro-faint)'}}>
            {position} / {total}
          </span>
        </Flex>

        <h1
          className="necro-serif"
          style={{
            margin: 0,
            fontSize: 'clamp(24px, 2.6vw, 36px)',
            fontWeight: 400,
            lineHeight: 1.2,
            overflowWrap: 'anywhere',
          }}
        >
          {q.prompt}
        </h1>

        {q.evidence?.length ? (
          <Stack space={3}>
            {q.evidence.map((e, i) => (
              <Flex
                key={e._key ?? i}
                gap={3}
                style={{
                  padding: '14px 16px',
                  borderRadius: 8,
                  background: 'var(--necro-well)',
                  border: '1px solid var(--necro-line)',
                }}
              >
                <span
                  style={{width: 2, flexShrink: 0, background: 'var(--necro-line-strong)'}}
                  aria-hidden
                />
                <Stack space={2} style={{minWidth: 0}}>
                  {e.url ? (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      className="necro-mono"
                      style={{
                        fontSize: 12,
                        color: '#8FD95A',
                        textDecoration: 'none',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {evidencePath(e)} ↗
                    </a>
                  ) : (
                    <span
                      className="necro-mono"
                      style={{fontSize: 12, color: 'var(--necro-faint)'}}
                    >
                      {evidencePath(e)}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 15,
                      lineHeight: 1.5,
                      color: '#D6CFC1',
                      whiteSpace: 'pre-line',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    “{e.quote}”
                  </span>
                </Stack>
              </Flex>
            ))}
          </Stack>
        ) : null}

        <div
          role="radiogroup"
          aria-label="Answer"
          style={{display: 'flex', flexWrap: 'wrap', gap: 10}}
        >
          {(q.options ?? []).map((option) => {
            const chosen = option === q.answer
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={chosen}
                disabled={locked}
                onClick={() => choose(option)}
                style={{
                  minHeight: 44,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: `1px solid ${chosen ? 'var(--necro-alive)' : 'var(--necro-line-strong)'}`,
                  background: chosen ? 'var(--necro-alive-well)' : 'transparent',
                  color: chosen ? 'var(--necro-bone)' : '#D6CFC1',
                  fontFamily: 'var(--necro-font-sans)',
                  fontSize: 14,
                  textAlign: 'left',
                  cursor: locked ? 'default' : 'pointer',
                  opacity: locked && !chosen ? 0.6 : 1,
                }}
              >
                {option}
              </button>
            )
          })}
        </div>

        <Stack space={2}>
          <label htmlFor={`note-${id}`} style={{fontSize: 13, color: 'var(--necro-dust)'}}>
            Anything else it should know?
          </label>
          <TextInput
            id={`note-${id}`}
            placeholder="Optional note"
            value={note}
            disabled={locked}
            onChange={(e) => changeNote(e.currentTarget.value)}
            onBlur={flushNote}
          />
        </Stack>

        <Flex align="center" gap={3} wrap="wrap">
          <Box flex={1} style={{minWidth: 200}}>
            {spawned.length ? (
              <span style={{fontSize: 13, color: 'var(--necro-dust)'}}>
                This answer creates:{' '}
                <span style={{color: 'var(--necro-bone)'}}>
                  {spawned.map((t) => `${t.title} (${t.mode})`).join(' · ')}
                </span>
              </span>
            ) : locked ? (
              <span style={{fontSize: 13, color: 'var(--necro-faint)'}}>
                Interrogation is over. Answers are read-only.
              </span>
            ) : null}
          </Box>
          <button type="button" onClick={onNext} style={ghostButton}>
            Skip
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!answered}
            style={{
              ...primaryButton,
              opacity: answered ? 1 : 0.5,
              cursor: answered ? 'pointer' : 'default',
            }}
          >
            Answer and next
          </button>
        </Flex>
      </Stack>
    </Card>
  )
}

function RitualSoFar({questions, requiredLeft}: {questions: QuestionRow[]; requiredLeft: number}) {
  const tasks: TaskPreview[] = questions.flatMap((q) =>
    isAnswered(q) ? tasksForAnswer(q, q.answer) : [],
  )
  return (
    <Card padding={4} radius={2} style={{...panelStyle, background: '#141312'}}>
      <Stack space={3}>
        <span style={eyebrowStyle}>Ritual so far</span>
        <p style={{margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--necro-dust)'}}>
          Tasks your answers have created. Auto tasks run themselves after reanimation.
        </p>
        {tasks.map((t, i) => (
          <Stack
            key={`${t.title}-${i}`}
            space={2}
            style={{
              padding: 12,
              borderRadius: 8,
              border: '1px solid var(--necro-line)',
              background: '#171614',
            }}
          >
            <Flex align="center" gap={2}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: t.mode === 'auto' ? 'var(--necro-alive)' : 'var(--necro-ember-soft)',
                }}
              >
                {t.mode}
              </span>
              <span style={{flexGrow: 1}} />
              <span className="necro-mono" style={{fontSize: 11, color: 'var(--necro-faint)'}}>
                {pagesLabel(t)}
              </span>
            </Flex>
            <span style={{fontSize: 14, overflowWrap: 'anywhere'}}>{t.title}</span>
          </Stack>
        ))}
        {requiredLeft === 0 ? (
          <Text size={1} style={{color: 'var(--necro-alive)'}}>
            Every required question is answered.
          </Text>
        ) : null}
        <Link to="../ritual" relative="path" style={{fontSize: 13, textDecoration: 'none'}}>
          Skip ahead to the ritual →
        </Link>
      </Stack>
    </Card>
  )
}

function CheckIcon({label}: {label: string}) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#8FD95A"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={label}
      style={{flexShrink: 0}}
    >
      <path d="M5 12l5 5 9-10" />
    </svg>
  )
}

const ghostButton: CSSProperties = {
  height: 44,
  padding: '0 16px',
  border: '1px solid var(--necro-line)',
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--necro-dust)',
  fontFamily: 'var(--necro-font-sans)',
  fontSize: 14,
  cursor: 'pointer',
}

const primaryButton: CSSProperties = {
  height: 44,
  padding: '0 20px',
  border: 0,
  borderRadius: 8,
  background: 'var(--necro-alive)',
  color: 'var(--necro-ground)',
  fontFamily: 'var(--necro-font-sans)',
  fontSize: 14,
  fontWeight: 600,
}
