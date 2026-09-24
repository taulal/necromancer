/**
 * One drain + tick pass over workflow instances (BRIEF.md §4, review F1/F2/F3).
 *
 * Modes:
 * - `pending` (default / App kick): drain only instances with unclaimed pending effects
 * - `schedule`: sweep stale claims, drain pending, then tick ALL tagged instances (SLA)
 */
import {sweepStaleClaims} from '@sanity/workflow-engine'
import {getWorkflowClient, tag} from './client'
import {getEngine} from './engine'

export type DrainMode = 'pending' | 'schedule'

export interface DrainPassResult {
  instanceId: string
  stage: string
  drained: number
  lost: number
  tickChanged: boolean
  swept?: number
  error?: string
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

export async function runDrain(mode: DrainMode): Promise<DrainPassResult[]> {
  return mode === 'schedule' ? runDrainAndTickAll() : runDrainPass()
}

export function summariseDrain(results: DrainPassResult[]) {
  return {
    instances: results.length,
    drained: results.reduce((n, r) => n + r.drained, 0),
    lost: results.reduce((n, r) => n + r.lost, 0),
    errors: results.filter((r) => r.error).length,
    results,
  }
}
