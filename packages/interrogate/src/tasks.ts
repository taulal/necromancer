/**
 * Answer → ritual task preview (NEC-UI3 "This answer creates: …").
 * Pure and browser-safe (exported as `@necro/interrogate/tasks`) so the App preview
 * and NEC-13 plan-ritual derive tasks from the same rules. Options are free text
 * from Claude, so matching is keyword-based; anything unmatched becomes a human task.
 */
import type {QuestionKind} from './types'

export type TaskMode = 'auto' | 'human'

export type TaskPreview = {
  mode: TaskMode
  title: string
  /** Old-site URLs the task touches (from the question evidence). */
  pages: string[]
  /** Pages affected when the prompt names more than the evidence sample. */
  pageCount: number
}

export type QuestionForTasks = {
  kind?: QuestionKind | string
  prompt?: string
  spawnsTasks?: boolean
  evidence?: Array<{url?: string | null}> | null
}

const CLARIFY = /none of these|clarify|check with|i['’]ll check|ask the client|not sure/i
const KEEP = /\b(keep|authentic|real|intentional)\b/i
const SKIP = /^(no\b|skip|leave)/i
const REWRITE = /rewrite|placeholder|boilerplate|remove|fake/i
const MERGE = /consolidat|merge/i
const DROP = /remove|kill|drop|delete/i

function evidencePages(q: QuestionForTasks): string[] {
  const urls = (q.evidence ?? []).map((e) => e?.url?.trim()).filter((u): u is string => !!u)
  return [...new Set(urls)]
}

/** "49 page(s) have no meta…" / "157 image(s) on 50 page(s)…" → 49 / 50. */
function promptPageCount(prompt: string | undefined): number | undefined {
  const m = prompt?.match(/(\d+)\s+page/i)
  return m ? Number(m[1]) : undefined
}

function only(base: string, answer: string): string {
  const rest = answer.replace(/^only\s*/i, '').trim()
  return /^only\b/i.test(answer) && rest ? `${base} (${rest})` : base
}

export function tasksForAnswer(
  q: QuestionForTasks,
  answer: string | null | undefined,
): TaskPreview[] {
  const a = answer?.trim()
  if (!a || q.spawnsTasks === false) return []

  const pages = evidencePages(q)
  const task = (mode: TaskMode, title: string, pageCount = pages.length): TaskPreview[] => [
    {mode, title, pages, pageCount: Math.max(pageCount, pages.length)},
  ]

  if (CLARIFY.test(a)) return task('human', 'Clarify with the client')

  switch (q.kind) {
    case 'contradiction':
      return task('auto', `Use “${a}” everywhere`)
    case 'authenticity':
      if (REWRITE.test(a)) return task('auto', only('Rewrite placeholder copy', a))
      if (KEEP.test(a)) return []
      break
    case 'keep-or-kill':
      if (MERGE.test(a)) return task('auto', 'Merge into one page, 301 the rest')
      if (DROP.test(a)) return task('auto', 'Drop page, 301 to its survivor')
      if (KEEP.test(a)) return []
      break
    case 'missing-info': {
      if (SKIP.test(a)) return []
      const count = promptPageCount(q.prompt)
      if (/\balt\b/i.test(`${a} ${q.prompt ?? ''}`)) {
        return task('auto', only('Generate alt text', a), count)
      }
      if (/meta|seo|description/i.test(`${a} ${q.prompt ?? ''}`)) {
        return task('auto', only('Write meta descriptions', a), count)
      }
      break
    }
    case 'mapping':
      return task('auto', `Map to ${a}`)
  }

  return task('human', `Follow up: ${a}`)
}

/** "/contact" for one page, "4 pages" otherwise. */
export function pagesLabel(t: Pick<TaskPreview, 'pages' | 'pageCount'>): string {
  if (t.pageCount === 1 && t.pages[0]) {
    try {
      const u = new URL(t.pages[0])
      return u.pathname || '/'
    } catch {
      return t.pages[0]
    }
  }
  return `${t.pageCount} page${t.pageCount === 1 ? '' : 's'}`
}
