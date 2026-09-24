/**
 * One drain + tick pass over workflow instances (BRIEF.md §4).
 * Called by Vessel `/api/ritual/drain` and by local CLI watchers later.
 */
import {getWorkflowClient, tag} from './client'
import {getEngine} from './engine'

export interface DrainPassResult {
  instanceId: string
  stage: string
  drained: number
  lost: number
  tickChanged: boolean
  error?: string
}

async function pendingInstanceIds(): Promise<string[]> {
  // Inline the tag — typed client fetch + $params fights TypeGen overloads here.
  return getWorkflowClient().fetch<string[]>(
    `*[_type == "sanity.workflow.instance" && tag == ${JSON.stringify(tag)} && count(pendingEffects) > 0]._id`,
  )
}

async function taggedInstanceIds(): Promise<string[]> {
  return getWorkflowClient().fetch<string[]>(
    `*[_type == "sanity.workflow.instance" && tag == ${JSON.stringify(tag)}]._id`,
  )
}

async function drainOne(instanceId: string): Promise<DrainPassResult> {
  const engine = getEngine()
  const result: DrainPassResult = {
    instanceId,
    stage: '?',
    drained: 0,
    lost: 0,
    tickChanged: false,
  }

  try {
    const drained = await engine.drainEffects({instanceId})
    result.drained = drained.drained.length
    result.lost = drained.lost.length
  } catch (err) {
    result.error = (err as Error).message
  }

  try {
    const ticked = await engine.tick({instanceId})
    result.tickChanged = ticked.changed
  } catch (err) {
    result.error = [result.error, `tick:${(err as Error).message}`].filter(Boolean).join(' ')
  }

  try {
    result.stage = (await engine.getInstance({instanceId})).currentStage
  } catch {
    /* instance may have been aborted mid-pass */
  }

  return result
}

export async function runDrainPass(instanceIds?: string[]): Promise<DrainPassResult[]> {
  const ids = instanceIds?.length ? instanceIds : await pendingInstanceIds()
  const results: DrainPassResult[] = []
  for (const id of ids) {
    results.push(await drainOne(id))
  }
  return results
}

/** Drain pending work and tick every instance so SLA triggers can fire. */
export async function runDrainAndTickAll(): Promise<DrainPassResult[]> {
  return runDrainPass(await taggedInstanceIds())
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
