/**
 * One drain + tick pass over workflow instances (BRIEF.md §4, review F1/F2/F3).
 *
 * Modes:
 * - `pending` (default / App kick): drain only instances with unclaimed pending effects
 * - `schedule`: sweep stale claims, drain pending, then tick ALL tagged instances (SLA)
 *
 * After each pass, re-query pending work and drain again until the queue is empty
 * or the time budget (~12 min) runs out. Callers that hold the drain lock should
 * release it, then {@link kickDrainBackground} if `budgetExhausted` so the chain
 * continues without waiting for the hourly schedule.
 */
import {sweepStaleClaims} from '@sanity/workflow-engine'
import {getWorkflowClient, tag} from './client'
import {getEngine} from './engine'

export type DrainMode = 'pending' | 'schedule'

/** Under the 14-min lock lease and 15-min Netlify background limit. */
export const DRAIN_TIME_BUDGET_MS = 12 * 60 * 1000

export interface DrainPassResult {
  instanceId: string
  stage: string
  drained: number
  lost: number
  tickChanged: boolean
  swept?: number
  error?: string
}

export interface DrainRunOutcome {
  results: DrainPassResult[]
  passes: number
  pendingAfter: number
  budgetExhausted: boolean
  elapsedMs: number
}

/** Instances with at least one unclaimed pending effect (0.35: claim absence = available). */
export async function pendingInstanceIds(): Promise<string[]> {
  return getWorkflowClient().fetch<string[]>(
    `*[_type == "sanity.workflow.instance" && tag == ${JSON.stringify(tag)} && count(pendingEffects[!defined(claim)]) > 0]._id`,
  )
}

async function taggedInstanceIds(): Promise<string[]> {
  return getWorkflowClient().fetch<string[]>(
    `*[_type == "sanity.workflow.instance" && tag == ${JSON.stringify(tag)}]._id`,
  )
}

async function drainOne(
  instanceId: string,
  opts: {tick: boolean; sweep: boolean},
): Promise<DrainPassResult> {
  const engine = getEngine()
  const client = getWorkflowClient()
  const result: DrainPassResult = {
    instanceId,
    stage: '?',
    drained: 0,
    lost: 0,
    tickChanged: false,
  }

  if (opts.sweep) {
    try {
      const swept = await sweepStaleClaims({
        client,
        tag,
        instanceId,
        executionContext: {kind: 'server', id: 'vessel-drain'},
      })
      result.swept = swept.released.length
    } catch (err) {
      result.error = `sweep:${(err as Error).message}`
    }
  }

  try {
    const drained = await engine.drainEffects({instanceId})
    result.drained = drained.drained.length
    result.lost = drained.lost.length
  } catch (err) {
    result.error = [result.error, (err as Error).message].filter(Boolean).join(' ')
  }

  if (opts.tick) {
    try {
      const ticked = await engine.tick({instanceId})
      result.tickChanged = ticked.changed
    } catch (err) {
      result.error = [result.error, `tick:${(err as Error).message}`].filter(Boolean).join(' ')
    }
  }

  try {
    result.stage = (await engine.getInstance({instanceId})).currentStage
  } catch {
    /* instance may have been aborted mid-pass */
  }

  return result
}

/**
 * Drain pending work only (no tick-all). Used by document kicks and App kicks.
 */
export async function runDrainPass(instanceIds?: string[]): Promise<DrainPassResult[]> {
  const ids = instanceIds?.length ? instanceIds : await pendingInstanceIds()
  const results: DrainPassResult[] = []
  for (const id of ids) {
    results.push(await drainOne(id, {tick: false, sweep: false}))
  }
  return results
}

/**
 * Schedule pass: sweep + drain pending + tick every tagged instance (SLA / $now).
 */
export async function runDrainAndTickAll(): Promise<DrainPassResult[]> {
  const all = await taggedInstanceIds()
  const results: DrainPassResult[] = []

  for (const id of all) {
    results.push(await drainOne(id, {tick: true, sweep: true}))
  }
  return results
}

export type DrainLoopDeps = {
  pendingIds: () => Promise<string[]>
  pass: (ids?: string[]) => Promise<DrainPassResult[]>
  tickAll: () => Promise<DrainPassResult[]>
  now?: () => number
  budgetMs?: number
}

/**
 * Core drain loop (injectable for unit tests).
 * Schedule mode does one tick-all first, then loops on pending like `pending` mode.
 */
export async function runDrainLoop(mode: DrainMode, deps: DrainLoopDeps): Promise<DrainRunOutcome> {
  const now = deps.now ?? Date.now
  const budgetMs = deps.budgetMs ?? DRAIN_TIME_BUDGET_MS
  const started = now()
  const results: DrainPassResult[] = []
  let passes = 0

  if (mode === 'schedule') {
    results.push(...(await deps.tickAll()))
    passes += 1
  }

  while (true) {
    const ids = await deps.pendingIds()
    if (ids.length === 0) {
      return {
        results,
        passes,
        pendingAfter: 0,
        budgetExhausted: false,
        elapsedMs: now() - started,
      }
    }
    if (now() - started >= budgetMs) {
      return {
        results,
        passes,
        pendingAfter: ids.length,
        budgetExhausted: true,
        elapsedMs: now() - started,
      }
    }
    results.push(...(await deps.pass(ids)))
    passes += 1
  }
}

export async function runDrain(mode: DrainMode): Promise<DrainRunOutcome> {
  return runDrainLoop(mode, {
    pendingIds: pendingInstanceIds,
    pass: runDrainPass,
    tickAll: runDrainAndTickAll,
  })
}

export function summariseDrain(outcome: DrainRunOutcome | DrainPassResult[]) {
  const results = Array.isArray(outcome) ? outcome : outcome.results
  const base = {
    instances: results.length,
    drained: results.reduce((n, r) => n + r.drained, 0),
    lost: results.reduce((n, r) => n + r.lost, 0),
    errors: results.filter((r) => r.error).length,
    results,
  }
  if (Array.isArray(outcome)) return base
  return {
    ...base,
    passes: outcome.passes,
    pendingAfter: outcome.pendingAfter,
    budgetExhausted: outcome.budgetExhausted,
    elapsedMs: outcome.elapsedMs,
  }
}

/** Netlify background drain URL (default Functions path). */
export function backgroundDrainUrl(): string | null {
  const site = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? process.env.VESSEL_URL
  if (!site) return null
  return `${site.replace(/\/$/, '')}/.netlify/functions/drain-background`
}

/**
 * Fire another background drain after the lock is released (budget exhausted
 * with work still pending). Returns false if URL/secret missing or invoke failed.
 */
export async function kickDrainBackground(mode: DrainMode, holder: string): Promise<boolean> {
  const bg = backgroundDrainUrl()
  const secret = process.env.DRAIN_SECRET?.trim()
  if (!bg || !secret) return false
  try {
    const res = await fetch(bg, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({mode, holder: `${holder}-continue`}),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      console.error('[drain] continue invoke returned', res.status)
      return false
    }
    return true
  } catch (err) {
    console.error('[drain] continue invoke failed', err)
    return false
  }
}
