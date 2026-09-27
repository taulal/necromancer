/**
 * What is happening on a séance right now, in words: who holds the ball (the worker
 * or a human), which step the running effect is on, and how long it has been.
 * Pure, so the status bar, the Graveyard and the stage screens all agree.
 */
import type {StageScreenPath} from './stageRoutes'

export type PendingEffectLike = {
  name: string
  queuedAt?: string
  claim?: {claimedAt?: string; leaseExpiresAt?: string}
}

export type StatusFacts = {
  stage?: string
  pendingEffects?: readonly PendingEffectLike[]
  fields?: ReadonlyArray<{name: string; value?: unknown}>
  /** `at` of the latest stageEntered history row. */
  stageEnteredAt?: string
  questions?: {total: number; requiredLeft: number; left: number}
  ritual?: {
    pages: number
    casting: number
    reviewing: number
    blessed: number
    humanOpen: number
    failed: number
  }
  /** The last `necro.effectError` for this séance, if any. */
  error?: {effect?: string; message?: string; at?: string}
  now: number
}

export type StatusTone = 'working' | 'queued' | 'needs-you' | 'waiting' | 'done' | 'failed'

export type StageStatus = {
  tone: StatusTone
  /** Stage in words, e.g. "Reanimating". */
  title: string
  /** The one line that says what is going on. */
  headline: string
  detail?: string
  /** 0–100 while an effect with checkpoints is running. */
  percent?: number
  /** ms since the running effect was claimed, or since the queued one was queued. */
  elapsedMs?: number
  /** ms in the current stage. */
  stageMs?: number
  hint?: string
  action?: {label: string; to: StageScreenPath}
}

export const STAGE_TITLE: Record<string, string> = {
  summoned: 'Summoned',
  exhuming: 'Exhuming',
  autopsy: 'Autopsy',
  interrogation: 'Interrogation',
  reanimating: 'Reanimating',
  ritual: 'Ritual',
  rising: 'Rising',
  risen: 'Risen',
  entombed: 'Entombed',
}

/**
 * Step labels keyed by the progress checkpoint each handler reports *before* the step
 * starts (see `progress(n)` calls in packages/rituals/src/runtime/*Handler.ts).
 */
const STEPS: Record<string, ReadonlyArray<readonly [number, string]>> = {
  'necro.exhume': [
    [0, 'Starting the crawl'],
    [1, 'Digging up pages'],
    [100, 'Writing the exhumed pages'],
  ],
  'necro.autopsy': [
    [0, 'Starting'],
    [5, 'Loading the exhumed pages'],
    [20, 'Claude is dissecting the anatomy'],
    [85, 'Writing the schema proposal'],
    [100, 'Finishing up'],
  ],
  'necro.interrogate': [
    [0, 'Starting'],
    [5, 'Loading the pages'],
    [20, 'Reading the accepted anatomy'],
    [35, 'Claude is drafting questions'],
    [70, 'Ranking and writing the questions'],
    [90, 'Finishing up'],
  ],
  'necro.reanimate': [
    [0, 'Starting'],
    [5, 'Preparing the showcase dataset'],
    [15, 'Mapping pages to Bones and deploying the schema'],
    [25, 'Opening the release'],
    [30, 'Uploading images'],
    [72, 'Writing every document into the release'],
    [85, 'Writing the redirect ledger'],
    [100, 'Finishing up'],
  ],
  'necro.plan-ritual': [
    [0, 'Starting'],
    [10, 'Turning answers into ritual tasks'],
    [100, 'Finishing up'],
  ],
  'necro.cast': [
    [0, 'Casting Agent Actions'],
    [100, 'Finishing up'],
  ],
  'necro.rise': [[0, 'Publishing the release']],
  'necro.rise-retry': [[0, 'Publishing the release (retry)']],
}

const EFFECT_LABEL: Record<string, string> = {
  'necro.exhume': 'Exhume',
  'necro.autopsy': 'Autopsy',
  'necro.autopsy-rerun': 'Autopsy re-run',
  'necro.interrogate': 'Interrogation',
  'necro.reanimate': 'Reanimate',
  'necro.plan-ritual': 'Ritual planning',
  'necro.cast': 'Cast',
  'necro.rise': 'Rise',
  'necro.rise-retry': 'Rise retry',
}

/** A claim held this long is past any handler's normal run. */
export const SLOW_MS = 8 * 60 * 1000
/** Unclaimed this long means no drain has picked it up. */
export const UNCLAIMED_MS = 90 * 1000

export function stepLabel(effect: string, percent: number | null | undefined): string {
  const steps = STEPS[effect === 'necro.autopsy-rerun' ? 'necro.autopsy' : effect]
  if (!steps) return 'Working'
  const p = percent ?? 0
  let label = steps[0]![1]
  for (const [at, text] of steps) if (p >= at) label = text
  return label
}

/** Visible steps for a checklist (drops the generic Starting/Finishing rows). */
export function stepsFor(effect: string): Array<{at: number; label: string}> {
  return (STEPS[effect] ?? [])
    .filter(([, label]) => label !== 'Starting' && label !== 'Finishing up')
    .map(([at, label]) => ({at, label}))
}

export type EffectRun = 'waiting' | 'queued' | 'running' | 'done' | 'failed'

/** Where one named effect stands: pending (queued/running) beats the latest history row. */
export function effectRun(
  name: string,
  pending: readonly PendingEffectLike[] | undefined,
  history: ReadonlyArray<{name?: string; status?: string}> | undefined,
): EffectRun {
  const p = pending?.find((e) => e.name === name)
  if (p) return p.claim ? 'running' : 'queued'
  const h = [...(history ?? [])].reverse().find((e) => e.name === name)
  if (h?.status === 'done') return 'done'
  if (h?.status === 'failed') return 'failed'
  return 'waiting'
}

export function effectLabel(effect: string): string {
  return EFFECT_LABEL[effect] ?? effect.replace(/^necro\./, '')
}

function fieldValue(facts: StatusFacts, name: string): unknown {
  return facts.fields?.find((f) => f.name === name)?.value
}

function percentOf(facts: StatusFacts): number | undefined {
  const v = fieldValue(facts, 'exhumeProgress')
  if (typeof v !== 'number') return undefined
  return Math.max(0, Math.min(100, Math.round(v <= 1 && v > 0 ? v * 100 : v)))
}

function since(iso: string | undefined, now: number): number | undefined {
  if (!iso) return undefined
  const t = Date.parse(iso)
  return Number.isFinite(t) ? Math.max(0, now - t) : undefined
}

/** The worker owns the ball: describe the claimed (or queued) effect. */
function effectStatus(facts: StatusFacts, title: string, effect: PendingEffectLike): StageStatus {
  const stageMs = since(facts.stageEnteredAt, facts.now)
  if (!effect.claim) {
    const elapsedMs = since(effect.queuedAt, facts.now)
    return {
      tone: 'queued',
      title,
      headline: `${effectLabel(effect.name)} is queued`,
      detail: 'Waiting for the worker on Netlify to pick it up.',
      elapsedMs,
      stageMs,
      hint:
        elapsedMs != null && elapsedMs > UNCLAIMED_MS
          ? 'Not picked up yet. This tab kicks the worker every 20s; the hourly Sanity Function is the backstop.'
          : undefined,
    }
  }
  const percent = percentOf(facts)
  const elapsedMs = since(effect.claim.claimedAt, facts.now)
  return {
    tone: 'working',
    title,
    headline: stepLabel(effect.name, percent),
    detail: `${effectLabel(effect.name)} is running on the worker.`,
    percent,
    elapsedMs,
    stageMs,
    hint:
      elapsedMs != null && elapsedMs > SLOW_MS
        ? 'Taking longer than usual. If the lease lapses the next drain takes it over.'
        : undefined,
  }
}

export function deriveStageStatus(facts: StatusFacts): StageStatus {
  const stage = facts.stage
  const title = stage ? (STAGE_TITLE[stage] ?? stage) : 'Starting'
  const stageMs = since(facts.stageEnteredAt, facts.now)
  const pending = facts.pendingEffects ?? []
  const running = pending.find((e) => e.claim) ?? pending[0]

  if (!stage) {
    return {tone: 'waiting', title, headline: 'Loading the séance…'}
  }

  if (stage === 'entombed') {
    const from = fieldValue(facts, 'entombedFromStage')
    const fromTitle = typeof from === 'string' ? (STAGE_TITLE[from] ?? from) : undefined
    return {
      tone: 'failed',
      title,
      headline: fromTitle ? `Failed during ${fromTitle.toLowerCase()}` : 'The ritual failed',
      detail: facts.error?.message,
      stageMs,
      hint: 'Retry runs the stage that failed again.',
    }
  }

  if (running) return effectStatus(facts, title, running)

  switch (stage) {
    case 'summoned':
      return {
        tone: 'needs-you',
        title,
        headline: 'Confirm the URL and page cap, then begin the exhumation',
        stageMs,
        action: {label: 'Go to Exhume', to: 'exhumation'},
      }
    case 'exhuming':
      return {tone: 'waiting', title, headline: 'Finishing the exhumation…', stageMs}
    case 'autopsy':
      if (fieldValue(facts, 'anatomyAccepted') === true) {
        return {tone: 'waiting', title, headline: 'Anatomy accepted. Moving on…', stageMs}
      }
      return {
        tone: 'needs-you',
        title,
        headline: 'Review the proposed anatomy, then accept it',
        detail: 'Nothing else moves until the anatomy is accepted.',
        stageMs,
        action: {label: 'Review anatomy', to: 'autopsy'},
      }
    case 'interrogation': {
      const q = facts.questions
      const fieldLeft = fieldValue(facts, 'openRequiredQuestions')
      const requiredLeft = q?.requiredLeft ?? (typeof fieldLeft === 'number' ? fieldLeft : 0)
      if (requiredLeft > 0) {
        const optional = q ? Math.max(0, q.left - requiredLeft) : 0
        return {
          tone: 'needs-you',
          title,
          headline: `${requiredLeft} required question${requiredLeft === 1 ? '' : 's'} to answer`,
          detail:
            'Reanimation starts as soon as every required question has an answer' +
            (optional ? `. ${optional} optional one${optional === 1 ? '' : 's'} can wait.` : '.'),
          stageMs,
          action: {label: 'Answer questions', to: 'interrogation'},
        }
      }
      return {
        tone: 'waiting',
        title,
        headline: 'All required questions answered. Moving on to reanimation…',
        detail:
          typeof fieldLeft === 'number' && fieldLeft > 0
            ? 'The question gate is still counting the answers.'
            : undefined,
        stageMs,
      }
    }
    case 'reanimating':
      return {tone: 'waiting', title, headline: 'Reanimated. Starting the ritual…', stageMs}
    case 'ritual': {
      const r = facts.ritual
      if (!r || r.pages === 0) {
        return {tone: 'waiting', title, headline: 'Summoning one ritual per page…', stageMs}
      }
      if (r.casting > 0) {
        return {
          tone: 'working',
          title,
          headline: `Casting on ${r.casting} page${r.casting === 1 ? '' : 's'}`,
          detail: `${r.blessed}/${r.pages} blessed · ${r.reviewing} ready to review`,
          percent: Math.round(((r.pages - r.casting) / r.pages) * 100),
          stageMs,
          action: {label: 'Watch the ritual', to: 'ritual'},
        }
      }
      if (r.reviewing > 0 || r.humanOpen > 0) {
        const parts = [
          r.reviewing ? `${r.reviewing} page${r.reviewing === 1 ? '' : 's'} to bless` : '',
          r.humanOpen ? `${r.humanOpen} task${r.humanOpen === 1 ? '' : 's'} need you` : '',
        ].filter(Boolean)
        return {
          tone: 'needs-you',
          title,
          headline: parts.join(' · '),
          detail:
            `${r.blessed}/${r.pages} blessed` +
            (r.failed ? ` · ${r.failed} failed cast${r.failed === 1 ? '' : 's'} to recast` : ''),
          stageMs,
          action: {label: 'Open the ritual', to: 'ritual'},
        }
      }
      return {tone: 'waiting', title, headline: 'Every page blessed. Moving to Rise…', stageMs}
    }
    case 'rising':
      if (fieldValue(facts, 'riseFailed') === true) {
        return {
          tone: 'failed',
          title,
          headline: 'Publishing the release failed',
          detail: facts.error?.effect?.startsWith('necro.rise') ? facts.error.message : undefined,
          stageMs,
          action: {label: 'Retry Rise', to: 'rise'},
        }
      }
      return {
        tone: 'needs-you',
        title,
        headline: 'Preview the release, then Rise',
        detail: 'Rise publishes the release; the Vessel serves it live.',
        stageMs,
        action: {label: 'Go to Rise', to: 'rise'},
      }
    case 'risen':
      return {tone: 'done', title, headline: 'Risen. The site is live on the Vessel.'}
    default:
      return {tone: 'waiting', title, headline: 'Working…', stageMs}
  }
}

/** "12s", "3m 04s", "1h 12m". */
export function formatDuration(ms: number | undefined): string {
  if (ms == null) return ''
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`
  const h = Math.floor(m / 60)
  return h < 48 ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${Math.floor(h / 24)}d`
}
