import {describe, expect, it} from 'vitest'
import {actorLabel, historyEntrySummary} from './AuditTrail'
import {isExhumeInFlight, pathForWorkflowStage, visitedScreenPaths} from './stageRoutes'

describe('stageRoutes', () => {
  it('maps engine stages onto séance screens', () => {
    expect(pathForWorkflowStage('exhuming')).toBe('exhumation')
    expect(pathForWorkflowStage('reanimating')).toBe('ritual')
    expect(pathForWorkflowStage('risen')).toBe('rise')
    expect(pathForWorkflowStage('entombed')).toBeUndefined()
  })

  it('collects visited screen paths from history', () => {
    const visited = visitedScreenPaths([
      {stage: 'exhuming'},
      {fromStage: 'exhuming', toStage: 'autopsy'},
      {stage: 'autopsy'},
    ])
    expect([...visited].sort()).toEqual(['autopsy', 'exhumation'])
  })
})

describe('audit trail labels', () => {
  it('renders person and agent actors the same way', () => {
    expect(actorLabel({kind: 'person', id: 'pTaylor'})).toBe('pTaylor')
    expect(actorLabel({kind: 'agent', id: 'necro.exhume'})).toBe('necro.exhume')
    expect(actorLabel({kind: 'system', id: '<system>'})).toBe('<system>')
    expect(actorLabel(undefined)).toBe('system')
  })

  it('summarises actionFired entries', () => {
    expect(
      historyEntrySummary({
        _key: '1',
        _type: 'actionFired',
        at: '2026-09-24T12:00:00.000Z',
        stage: 'autopsy',
        activity: 'accept',
        action: 'accept-anatomy',
        actor: {kind: 'person', id: 'pTaylor'},
      }),
    ).toBe('pTaylor fired accept-anatomy · accept')
  })
})

describe('isExhumeInFlight', () => {
  it('exhuming stages read the live field', () => {
    expect(isExhumeInFlight('exhuming', undefined)).toBe(true)
    expect(isExhumeInFlight(undefined, undefined)).toBe(true)
  })
  it("later stages mean exhume finished (cazskitchen showed autopsy's 20%)", () => {
    expect(isExhumeInFlight('autopsy', undefined)).toBe(false)
    expect(isExhumeInFlight('entombed', 'autopsy')).toBe(false)
  })
  it('entombed during exhume keeps the real value', () => {
    expect(isExhumeInFlight('entombed', 'exhuming')).toBe(true)
  })
})
