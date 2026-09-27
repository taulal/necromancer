import {describe, expect, test} from 'vitest'
import {
  deriveStageStatus,
  effectRun,
  formatDuration,
  stepLabel,
  stepsFor,
  UNCLAIMED_MS,
} from './stageStatus'

const now = Date.parse('2026-09-27T13:30:00Z')
const ago = (ms: number) => new Date(now - ms).toISOString()

describe('stepLabel', () => {
  test('picks the step that starts at the last reported checkpoint', () => {
    expect(stepLabel('necro.reanimate', 0)).toBe('Starting')
    expect(stepLabel('necro.reanimate', 30)).toBe('Uploading images')
    expect(stepLabel('necro.reanimate', 55)).toBe('Uploading images')
    expect(stepLabel('necro.reanimate', 72)).toBe('Writing every document into the release')
    expect(stepLabel('necro.autopsy-rerun', 20)).toBe('Claude is dissecting the anatomy')
    expect(stepLabel('necro.unknown', 50)).toBe('Working')
  })
})

describe('deriveStageStatus', () => {
  test('interrogation with required questions left needs you, with a link', () => {
    const s = deriveStageStatus({
      stage: 'interrogation',
      fields: [{name: 'openRequiredQuestions', value: 2}],
      questions: {total: 15, requiredLeft: 2, left: 15},
      stageEnteredAt: ago(60_000),
      now,
    })
    expect(s.tone).toBe('needs-you')
    expect(s.headline).toBe('2 required questions to answer')
    expect(s.detail).toContain('13 optional ones can wait')
    expect(s.action?.to).toBe('interrogation')
    expect(s.stageMs).toBe(60_000)
  })

  test('falls back to the openRequiredQuestions field without question rows', () => {
    const s = deriveStageStatus({
      stage: 'interrogation',
      fields: [{name: 'openRequiredQuestions', value: 1}],
      now,
    })
    expect(s.headline).toBe('1 required question to answer')
  })

  test('a claimed effect is working, labelled by its checkpoint', () => {
    const s = deriveStageStatus({
      stage: 'reanimating',
      pendingEffects: [{name: 'necro.reanimate', claim: {claimedAt: ago(45_000)}}],
      fields: [{name: 'exhumeProgress', value: 42}],
      now,
    })
    expect(s).toMatchObject({
      tone: 'working',
      title: 'Reanimating',
      headline: 'Uploading images',
      percent: 42,
      elapsedMs: 45_000,
    })
    expect(s.hint).toBeUndefined()
  })

  test('an unclaimed effect is queued, with a hint once it has sat too long', () => {
    const fresh = deriveStageStatus({
      stage: 'reanimating',
      pendingEffects: [{name: 'necro.reanimate', queuedAt: ago(5_000)}],
      now,
    })
    expect(fresh.tone).toBe('queued')
    expect(fresh.hint).toBeUndefined()
    const stale = deriveStageStatus({
      stage: 'reanimating',
      pendingEffects: [{name: 'necro.reanimate', queuedAt: ago(UNCLAIMED_MS + 1)}],
      now,
    })
    expect(stale.hint).toMatch(/Not picked up yet/)
  })

  test('ritual summarises casting, then what needs blessing', () => {
    const base = {pages: 8, blessed: 2, humanOpen: 0, failed: 0}
    expect(
      deriveStageStatus({stage: 'ritual', ritual: {...base, casting: 3, reviewing: 3}, now}),
    ).toMatchObject({tone: 'working', headline: 'Casting on 3 pages'})
    expect(
      deriveStageStatus({
        stage: 'ritual',
        ritual: {...base, casting: 0, reviewing: 6, humanOpen: 1, failed: 1},
        now,
      }),
    ).toMatchObject({
      tone: 'needs-you',
      headline: '6 pages to bless · 1 task need you',
      detail: '2/8 blessed · 1 failed cast to recast',
    })
  })

  test('entombed says where it failed and why', () => {
    const s = deriveStageStatus({
      stage: 'entombed',
      fields: [{name: 'entombedFromStage', value: 'reanimating'}],
      error: {effect: 'necro.reanimate', message: 'Schema deploy 403'},
      now,
    })
    expect(s).toMatchObject({
      tone: 'failed',
      headline: 'Failed during reanimating',
      detail: 'Schema deploy 403',
    })
  })

  test('autopsy waits on the human until the anatomy is accepted', () => {
    expect(deriveStageStatus({stage: 'autopsy', now}).tone).toBe('needs-you')
    expect(
      deriveStageStatus({stage: 'autopsy', fields: [{name: 'anatomyAccepted', value: true}], now})
        .tone,
    ).toBe('waiting')
  })
})

test('formatDuration', () => {
  expect(formatDuration(9_400)).toBe('9s')
  expect(formatDuration(184_000)).toBe('3m 04s')
  expect(formatDuration(3 * 3600_000 + 60_000)).toBe('3h 01m')
})

test('effectRun prefers the pending entry over history', () => {
  const history = [{name: 'necro.reanimate', status: 'failed'}]
  expect(effectRun('necro.reanimate', [{name: 'necro.reanimate'}], history)).toBe('queued')
  expect(
    effectRun('necro.reanimate', [{name: 'necro.reanimate', claim: {claimedAt: ago(1)}}], history),
  ).toBe('running')
  expect(effectRun('necro.reanimate', [], history)).toBe('failed')
  expect(effectRun('necro.plan-ritual', [], history)).toBe('waiting')
})

test('stepsFor drops the generic rows', () => {
  expect(stepsFor('necro.reanimate').map((s) => s.label)).not.toContain('Starting')
  expect(stepsFor('necro.reanimate')[0]).toEqual({at: 5, label: 'Preparing the showcase dataset'})
})
