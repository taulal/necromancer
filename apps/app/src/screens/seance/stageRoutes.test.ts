import {describe, expect, it} from 'vitest'
import {actorLabel, historyEntrySummary} from './AuditTrail'
import {pathForWorkflowStage, visitedScreenPaths} from './stageRoutes'

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
