import {describe, expect, it} from 'vitest'
import {
  agentLabel,
  groupByChild,
  idFromRef,
  ledgerCoverage,
  ledgerLabel,
  ritualCounts,
  type TaskRow,
} from './ritual'

const task = (id: string, extra: Partial<TaskRow>): TaskRow => ({
  _id: id,
  mode: 'auto',
  status: 'todo',
  ...extra,
})

describe('idFromRef', () => {
  it('reads GDRs, doc.ref values and plain ids', () => {
    expect(idFromRef('dataset:v9dl2xdi:hq:abc')).toBe('abc')
    expect(idFromRef({id: 'p1', type: 'exhumedPage'})).toBe('p1')
    expect(idFromRef('drafts.p2')).toBe('p2')
    expect(idFromRef(undefined)).toBeUndefined()
  })
})

describe('ritualCounts + groupByChild', () => {
  const tasks = [
    task('a', {exhumedPage: {_ref: 'p-home'}, pagePath: '/', status: 'done'}),
    task('b', {exhumedPage: {_ref: 'p-home'}, pagePath: '/', mode: 'human'}),
    task('c', {exhumedPage: {_ref: 'p-about'}, pagePath: '/about', status: 'failed'}),
  ]
  const children = [
    {_id: 'c1', currentStage: 'reviewing', pageId: 'p-about'},
    {_id: 'c2', currentStage: 'blessed', pageId: 'p-home'},
    {_id: 'c3', currentStage: 'reviewing', pageId: 'p-quiet'},
  ]

  it('counts tasks and blessed pages', () => {
    expect(ritualCounts(tasks, children)).toEqual({
      total: 3,
      done: 1,
      autoLeft: 1,
      humanLeft: 1,
      failed: 1,
      blessed: 1,
      pages: 3,
    })
  })

  it('groups tasks by child, home first, human tasks first; pages without tasks are quiet', () => {
    const {groups, quiet} = groupByChild(tasks, children, () => '?')
    expect(groups.map((g) => g.path)).toEqual(['/', '/about'])
    expect(groups[0]!.tasks[0]!._id).toBe('b')
    expect(quiet.map((c) => c._id)).toEqual(['c3'])
  })
})

describe('labels', () => {
  it('agent label names the action and fields', () => {
    expect(
      agentLabel(
        task('x', {agentAction: {kind: 'generate', targetPaths: ['seoTitle', 'seoDescription']}}),
      ),
    ).toBe('generate · seoTitle, seoDescription')
    expect(agentLabel(task('y', {mode: 'human'}))).toBe('you')
  })
  it('ledger coverage and labels', () => {
    const rows = [
      {_id: '1', from: '/', to: '/', status: 'mapped'},
      {_id: '2', from: '/old', to: '/', status: 'dropped'},
      {_id: '3', from: '/x', to: '/x', status: 'unmapped'},
    ]
    expect(ledgerCoverage(rows)).toEqual({accounted: 2, total: 3, pct: 67})
    expect(rows.map(ledgerLabel)).toEqual(['kept', 'dropped · 301', 'unmapped'])
  })
})
