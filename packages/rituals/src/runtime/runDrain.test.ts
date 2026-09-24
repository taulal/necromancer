import {describe, expect, test} from 'vitest'
import {runDrainLoop, type DrainLoopDeps, type DrainPassResult, type DrainMode} from './runDrain'

function passResult(instanceId: string, drained: number): DrainPassResult {
  return {
    instanceId,
    stage: 'exhuming',
    drained,
    lost: 0,
    tickChanged: false,
  }
}

describe('runDrainLoop', () => {
  test('drains an effect queued mid-drain in the same run', async () => {
    // Pass 1: exhume pending. Completing it queues autopsy → still pending.
    // Pass 2: autopsy drained. Pass 3 query: empty → stop.
    let queries = 0
    let drainCalls = 0
    const deps: DrainLoopDeps = {
      pendingIds: async () => {
        queries += 1
        if (queries <= 2) return ['inst-1']
        return []
      },
      pass: async () => {
        drainCalls += 1
        return [passResult('inst-1', 1)]
      },
      tickAll: async () => {
        throw new Error('tickAll should not run in pending mode')
      },
    }

    const outcome = await runDrainLoop('pending', deps)

    expect(drainCalls).toBe(2)
    expect(outcome.passes).toBe(2)
    expect(outcome.pendingAfter).toBe(0)
    expect(outcome.budgetExhausted).toBe(false)
    expect(outcome.results.reduce((n, r) => n + r.drained, 0)).toBe(2)
  })

  test('stops when budget expires and reports pendingAfter', async () => {
    let t = 0
    const deps: DrainLoopDeps = {
      now: () => t,
      budgetMs: 100,
      pendingIds: async () => ['inst-1'],
      pass: async () => {
        t += 60
        return [passResult('inst-1', 1)]
      },
      tickAll: async () => [],
    }

    const outcome = await runDrainLoop('pending' satisfies DrainMode, deps)

    expect(outcome.budgetExhausted).toBe(true)
    expect(outcome.pendingAfter).toBe(1)
    expect(outcome.passes).toBeGreaterThanOrEqual(1)
  })

  test('schedule mode runs tickAll once then loops pending', async () => {
    let tickCalls = 0
    let queries = 0
    const deps: DrainLoopDeps = {
      pendingIds: async () => {
        queries += 1
        // After tickAll, one pending effect appears, then clears.
        if (queries === 1) return ['inst-1']
        return []
      },
      pass: async () => [passResult('inst-1', 1)],
      tickAll: async () => {
        tickCalls += 1
        return [passResult('inst-1', 0)]
      },
    }

    const outcome = await runDrainLoop('schedule', deps)

    expect(tickCalls).toBe(1)
    expect(outcome.passes).toBe(2) // tickAll + one pending pass
    expect(outcome.pendingAfter).toBe(0)
  })
})
