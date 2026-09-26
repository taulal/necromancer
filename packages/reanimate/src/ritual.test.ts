import {describe, expect, test} from 'vitest'
import {planRitualTasks, type RitualPage} from './ritual'

const page = (id: string, path: string, extra: Partial<RitualPage> = {}): RitualPage => ({
  _id: id,
  url: `https://caz.test${path}`,
  path,
  meta: {description: ''},
  images: [],
  target: {docId: `page-${id}`, type: 'page', path, status: 'mapped'},
  ...extra,
})

const pages = [
  page('home', '/', {images: [{src: 'a.jpg'}], detectedEntities: {phones: ['0151 555 0100']}}),
  page('about', '/about/', {meta: {description: 'Already has one'}}),
  page('contact', '/contact/', {detectedEntities: {phones: ['0151 555 0199']}}),
  page('gone', '/old/', {target: {path: '/', status: 'dropped'}}),
]

describe('planRitualTasks', () => {
  test('meta answer covers every mapped page missing a description, not just the samples', () => {
    const tasks = planRitualTasks({
      seanceId: 's1',
      pages,
      questions: [
        {
          _id: 'q1',
          kind: 'missing-info',
          prompt: '3 page(s) have no meta description…',
          answer: 'Yes — generate meta descriptions',
          evidence: [{url: 'https://caz.test/'}],
        },
      ],
    })
    expect(tasks.map((t) => t.page).sort()).toEqual(['page-contact', 'page-home'])
    expect(tasks[0]).toMatchObject({
      mode: 'auto',
      action: 'generate-meta',
      status: 'todo',
      agentAction: {kind: 'generate', targetPaths: ['seoTitle', 'seoDescription']},
    })
  })

  test('contact fix patches pages that still show a wrong value', () => {
    const [t, ...rest] = planRitualTasks({
      seanceId: 's1',
      pages,
      questions: [
        {
          _id: 'q2',
          kind: 'contradiction',
          prompt: 'Different phone numbers…',
          answer: '0151 555 0100',
          options: ['0151 555 0100', '0151 555 0199', 'None of these — I will clarify'],
        },
      ],
    })
    expect(rest).toHaveLength(0)
    expect(t).toMatchObject({
      page: 'page-contact',
      action: 'fix-contact',
      agentAction: {kind: 'patch'},
    })
    expect(JSON.parse(t!.agentAction!.instruction)).toEqual({
      replace: ['0151 555 0199'],
      with: '0151 555 0100',
    })
  })

  test('drops are already handled by reanimate; clarify is a human task; unanswered is nothing', () => {
    const tasks = planRitualTasks({
      seanceId: 's1',
      pages,
      questions: [
        {
          _id: 'q3',
          kind: 'keep-or-kill',
          answer: 'Kill this page',
          evidence: [{url: 'https://caz.test/about/'}],
        },
        {
          _id: 'q4',
          kind: 'authenticity',
          answer: 'None of these — I will clarify',
          evidence: [{url: 'https://caz.test/'}],
        },
        {_id: 'q5', kind: 'authenticity', evidence: [{url: 'https://caz.test/'}]},
      ],
    })
    expect(tasks.find((t) => t.fromQuestion === 'q3')).toMatchObject({status: 'done', mode: 'auto'})
    expect(tasks.find((t) => t.fromQuestion === 'q4')).toMatchObject({
      mode: 'human',
      action: 'custom',
      status: 'todo',
    })
    expect(tasks.some((t) => t.fromQuestion === 'q5')).toBe(false)
  })

  test('ids are deterministic so re-planning replaces instead of duplicating', () => {
    const q = [
      {_id: 'q1', kind: 'missing-info', answer: 'Yes — generate alt text', prompt: 'lack alt text'},
    ]
    expect(planRitualTasks({seanceId: 's1', pages, questions: q}).map((t) => t._id)).toEqual(
      planRitualTasks({seanceId: 's1', pages, questions: q}).map((t) => t._id),
    )
  })
})
