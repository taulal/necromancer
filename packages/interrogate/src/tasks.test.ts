import {describe, expect, test} from 'vitest'
import {pagesLabel, tasksForAnswer, type QuestionForTasks} from './tasks'

// Option strings below are verbatim from the hewahihaumaru cap-50 run (25 Sep).
const ev = (...paths: string[]) => paths.map((p) => ({url: `https://hewahihaumaru.org.nz${p}`}))

describe('tasksForAnswer', () => {
  test('no answer or spawnsTasks false → nothing', () => {
    expect(tasksForAnswer({kind: 'contradiction'}, undefined)).toEqual([])
    expect(tasksForAnswer({kind: 'contradiction', spawnsTasks: false}, 'x')).toEqual([])
  })

  test('contradiction: chosen value is applied everywhere (auto)', () => {
    const q: QuestionForTasks = {kind: 'contradiction', evidence: ev('/a', '/b', '/a')}
    const [t] = tasksForAnswer(q, '(03) 260 1566')
    expect(t).toMatchObject({mode: 'auto', title: 'Use “(03) 260 1566” everywhere', pageCount: 2})
  })

  test('"None of these — I will clarify" → human', () => {
    const [t] = tasksForAnswer({kind: 'contradiction'}, 'None of these — I will clarify')
    expect(t).toMatchObject({mode: 'human', title: 'Clarify with the client'})
  })

  test('authenticity', () => {
    expect(tasksForAnswer({kind: 'authenticity'}, 'Authentic – real champion bio')).toEqual([])
    expect(tasksForAnswer({kind: 'authenticity'}, 'Keep — it is intentional')).toEqual([])
    expect(
      tasksForAnswer({kind: 'authenticity'}, 'Placeholder – needs real content')[0],
    ).toMatchObject({mode: 'auto', title: 'Rewrite placeholder copy'})
    expect(
      tasksForAnswer({kind: 'authenticity'}, 'Rewrite only the worst offenders')[0]?.mode,
    ).toBe('auto')
  })

  test('keep-or-kill', () => {
    const q = {kind: 'keep-or-kill', evidence: ev('/member-login/')}
    expect(tasksForAnswer(q, 'Keep as-is')).toEqual([])
    expect(tasksForAnswer(q, 'Kill this page')[0]?.title).toBe('Drop page, 301 to its survivor')
    expect(
      tasksForAnswer(q, 'Remove all variants – consolidate to single editing interface')[0]?.title,
    ).toBe('Merge into one page, 301 the rest')
    expect(tasksForAnswer(q, 'Make truly private – require login')[0]).toMatchObject({
      mode: 'human',
      title: 'Follow up: Make truly private – require login',
    })
  })

  test('missing-info uses the page count from the prompt', () => {
    const q = {
      kind: 'missing-info',
      prompt: '49 page(s) have no meta description (e.g. /a, /b, /c). Should we generate…?',
      evidence: ev('/a', '/b', '/c'),
    }
    expect(tasksForAnswer(q, 'No — leave them empty')).toEqual([])
    expect(tasksForAnswer(q, 'Yes — generate meta descriptions')[0]).toMatchObject({
      mode: 'auto',
      title: 'Write meta descriptions',
      pageCount: 49,
    })
    expect(tasksForAnswer(q, 'Only for key pages')[0]?.title).toBe(
      'Write meta descriptions (for key pages)',
    )
    const alt = {...q, prompt: '157 image(s) on 50 page(s) lack alt text. Generate alt text?'}
    expect(tasksForAnswer(alt, 'Only hero images')[0]).toMatchObject({
      title: 'Generate alt text (hero images)',
      pageCount: 50,
    })
  })
})

describe('pagesLabel', () => {
  test('one page shows its path, many show a count', () => {
    expect(pagesLabel({pages: ['https://x.nz/contact'], pageCount: 1})).toBe('/contact')
    expect(pagesLabel({pages: [], pageCount: 49})).toBe('49 pages')
  })
})
