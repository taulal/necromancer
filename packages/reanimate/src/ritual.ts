/**
 * necro.plan-ritual planning: answers + findings → task docs (one per target doc).
 * Uses the same `tasksForAnswer` rules the Interrogation screen previews, then
 * widens site-wide findings (meta, alt, contact fixes) to every affected page.
 */
import {tasksForAnswer, type TaskAction, type TaskMode} from '@necro/interrogate/tasks'
import {key} from './portableText'
import {normPath} from './plan'

export type RitualPage = {
  _id: string
  url?: string
  path?: string
  meta?: {description?: string}
  images?: Array<{src?: string; alt?: string}>
  detectedEntities?: {phones?: string[]; emails?: string[]; addresses?: string[]}
  target?: {docId?: string; type?: string; path?: string; status?: string}
}

export type RitualQuestion = {
  _id: string
  kind?: string
  prompt?: string
  answer?: string
  answerNote?: string
  options?: string[]
  spawnsTasks?: boolean
  evidence?: Array<{url?: string}>
}

export type AgentActionKind = 'generate' | 'transform' | 'patch' | 'prompt'

export type PlannedTask = {
  _id: string
  exhumedPageId: string
  /** Target doc id in the release (task.page). */
  page: string
  pageType: string
  pagePath: string
  mode: TaskMode
  action: TaskAction
  title: string
  why: string
  agentAction?: {kind: AgentActionKind; instruction: string; targetPaths: string[]}
  status: 'todo' | 'done'
  result?: string
  fromQuestion: string
}

export const INSTRUCTIONS: Record<
  string,
  {kind: AgentActionKind; instruction: string; targetPaths: string[]}
> = {
  'generate-meta': {
    kind: 'generate',
    instruction:
      'Write an SEO title (at most 60 characters) and a meta description (at most 155 characters) for this page from its own content. Plain and specific: name what the page offers and where. No clickbait, no invented facts.',
    targetPaths: ['seoTitle', 'seoDescription'],
  },
  'generate-alt': {
    kind: 'generate',
    instruction:
      'Write concise alt text (under 125 characters) for each image, describing what it shows using the surrounding section text and the image file name. Do not start with "Image of".',
    targetPaths: ['body[].image.alt', 'body[].images[].alt'],
  },
  'rewrite-placeholder': {
    kind: 'transform',
    instruction:
      'Rewrite only placeholder or theme boilerplate copy (for example "Coming soon", "Lorem ipsum", "Welcome to our website") in the site\'s own voice, using facts that appear elsewhere on this page. Leave real content exactly as it is.',
    targetPaths: ['body'],
  },
}

function pathOfUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    return normPath(new URL(url).pathname)
  } catch {
    return undefined
  }
}

function short(text: string | undefined, max = 90): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

export function planRitualTasks(input: {
  seanceId: string
  pages: RitualPage[]
  questions: RitualQuestion[]
}): PlannedTask[] {
  const mapped = input.pages.filter((p) => p.target?.status === 'mapped' && p.target.docId)
  // One target doc can come from several exhumed pages (query-string variants).
  const byDoc = new Map<string, RitualPage>()
  for (const p of mapped) if (!byDoc.has(p.target!.docId!)) byDoc.set(p.target!.docId!, p)
  const byPath = new Map<string, RitualPage>()
  for (const p of mapped) {
    const path = p.path ? normPath(p.path) : pathOfUrl(p.url)
    if (path && !byPath.has(path)) byPath.set(path, p)
  }

  const tasks = new Map<string, PlannedTask>()
  const add = (
    q: RitualQuestion,
    page: RitualPage,
    t: Omit<
      PlannedTask,
      '_id' | 'exhumedPageId' | 'page' | 'pageType' | 'pagePath' | 'fromQuestion'
    >,
  ) => {
    const docId = page.target!.docId!
    const _id = `task.${input.seanceId}.${key(t.action, docId, q._id)}`
    if (tasks.has(_id)) return
    tasks.set(_id, {
      _id,
      exhumedPageId: page._id.replace(/^drafts\./, ''),
      page: docId,
      pageType: page.target!.type ?? 'page',
      pagePath: page.target!.path ?? '/',
      fromQuestion: q._id.replace(/^drafts\./, ''),
      ...t,
    })
  }

  for (const q of input.questions) {
    if (!q.answer?.trim()) continue
    const why = `${short(q.prompt, 70)} → “${short(q.answer, 60)}”${q.answerNote ? ` (${short(q.answerNote, 60)})` : ''}`
    for (const preview of tasksForAnswer(q, q.answer)) {
      const evidencePages = preview.pages
        .map((u) => byPath.get(pathOfUrl(u) ?? ''))
        .filter((p): p is RitualPage => !!p)

      let targets: RitualPage[]
      if (preview.action === 'generate-meta') {
        targets = [...byDoc.values()].filter(
          (p) => p.target?.type === 'page' && !p.meta?.description?.trim(),
        )
      } else if (preview.action === 'generate-alt') {
        targets = [...byDoc.values()].filter((p) =>
          (p.images ?? []).some((i) => i.src && !i.alt?.trim()),
        )
      } else if (preview.action === 'fix-contact') {
        const chosen = q.answer.trim()
        const wrong = (q.options ?? []).filter((o) => o !== chosen && !/none of these/i.test(o))
        targets = [...byDoc.values()].filter((p) => {
          const e = p.detectedEntities ?? {}
          const values = [...(e.phones ?? []), ...(e.emails ?? []), ...(e.addresses ?? [])]
          return values.some((v) => wrong.includes(v.trim()))
        })
        if (!targets.length) targets = evidencePages
      } else {
        targets = evidencePages.length ? evidencePages : []
      }

      // "Only for key pages" style answers narrow the widened set to the evidence.
      if (/^only\b/i.test(q.answer.trim()) && evidencePages.length) targets = evidencePages

      for (const page of targets) {
        const handledAtReanimate = preview.action === 'custom' && preview.mode === 'auto'
        let agentAction = INSTRUCTIONS[preview.action]
        if (preview.action === 'fix-contact') {
          const chosen = q.answer.trim()
          const wrong = (q.options ?? []).filter((o) => o !== chosen && !/none of these/i.test(o))
          agentAction = {
            kind: 'patch',
            instruction: JSON.stringify({replace: wrong, with: chosen}),
            targetPaths: [],
          }
        }
        add(q, page, {
          mode: preview.mode,
          action: preview.action,
          title: preview.title,
          why,
          ...(agentAction && preview.mode === 'auto' ? {agentAction} : {}),
          status: handledAtReanimate ? 'done' : 'todo',
          ...(handledAtReanimate ? {result: 'Redirect written when the site was reanimated.'} : {}),
        })
      }
    }
  }

  return [...tasks.values()]
}
