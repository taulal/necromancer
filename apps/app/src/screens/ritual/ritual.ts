/**
 * Pure helpers for the Ritual (NEC-UI4) and Rise (NEC-UI5) screens.
 */

export type TaskRow = {
  _id: string
  title?: string
  why?: string
  mode?: 'auto' | 'human'
  action?: string
  status?: 'todo' | 'casting' | 'done' | 'failed' | 'skipped'
  result?: string
  page?: string
  pagePath?: string
  pageType?: string
  exhumedPage?: {_ref?: string}
  agentAction?: {kind?: string; targetPaths?: string[]}
  castMs?: number
}

export type ChildRow = {
  _id: string
  currentStage?: string
  /** exhumedPage id bound to the child (page field). */
  pageId?: string
  castFailed?: boolean
}

export type LedgerRow = {_id: string; from?: string; to?: string; status?: string; reason?: string}

/** GDR "dataset:proj:ds:id" or plain id → id. */
export function idFromRef(value: unknown): string | undefined {
  const raw =
    typeof value === 'string'
      ? value
      : value && typeof value === 'object'
        ? ((value as {id?: unknown; _id?: unknown}).id ?? (value as {_id?: unknown})._id)
        : undefined
  if (typeof raw !== 'string' || !raw) return undefined
  return raw
    .split(':')
    .pop()!
    .replace(/^drafts\./, '')
}

export const isOpen = (t: TaskRow) => t.status !== 'done' && t.status !== 'skipped'

export function ritualCounts(tasks: TaskRow[], children: ChildRow[]) {
  return {
    total: tasks.length,
    done: tasks.filter((t) => t.status === 'done' || t.status === 'skipped').length,
    autoLeft: tasks.filter((t) => t.mode === 'auto' && isOpen(t)).length,
    humanLeft: tasks.filter((t) => t.mode === 'human' && isOpen(t)).length,
    failed: tasks.filter((t) => t.status === 'failed').length,
    blessed: children.filter((c) => c.currentStage === 'blessed').length,
    pages: children.length,
  }
}

export type PageGroup = {child: ChildRow; path: string; tasks: TaskRow[]}

/** One group per page-ritual child; children whose page has no tasks are "quiet". */
export function groupByChild(
  tasks: TaskRow[],
  children: ChildRow[],
  pathFor: (pageId: string | undefined) => string,
): {groups: PageGroup[]; quiet: ChildRow[]} {
  const byPage = new Map<string, TaskRow[]>()
  for (const t of tasks) {
    const pid = t.exhumedPage?._ref
    if (!pid) continue
    byPage.set(pid, [...(byPage.get(pid) ?? []), t])
  }
  const groups: PageGroup[] = []
  const quiet: ChildRow[] = []
  for (const child of children) {
    const list = child.pageId ? byPage.get(child.pageId) : undefined
    if (list?.length) {
      const order = {human: 0, auto: 1}
      groups.push({
        child,
        path: list[0]?.pagePath ?? pathFor(child.pageId),
        tasks: [...list].sort(
          (a, b) => (order[a.mode ?? 'auto'] ?? 1) - (order[b.mode ?? 'auto'] ?? 1),
        ),
      })
    } else quiet.push(child)
  }
  groups.sort((a, b) => (a.path === '/' ? -1 : b.path === '/' ? 1 : a.path.localeCompare(b.path)))
  return {groups, quiet}
}

/** "generate · seoTitle, seoDescription" — which Agent Action touches which fields. */
export function agentLabel(t: TaskRow): string {
  if (t.mode === 'human') return 'you'
  const kind = t.agentAction?.kind
  if (!kind) return t.action === 'custom' ? 'reanimate' : '—'
  const paths = t.agentAction?.targetPaths?.filter(Boolean) ?? []
  return paths.length ? `${kind} · ${paths.join(', ')}` : kind
}

/** Coverage for the Rise ledger: every crawled path mapped or deliberately dropped. */
export function ledgerCoverage(rows: LedgerRow[]) {
  const accounted = rows.filter((r) => r.status === 'mapped' || r.status === 'dropped').length
  return {
    accounted,
    total: rows.length,
    pct: rows.length ? Math.round((accounted / rows.length) * 100) : 0,
  }
}

export function ledgerLabel(row: LedgerRow): string {
  if (row.status === 'dropped') return row.from === row.to ? 'dropped' : 'dropped · 301'
  if (row.status === 'unmapped') return 'unmapped'
  return row.from === row.to ? 'kept' : 'moved · 301'
}
