/**
 * Step 1 — deterministic Corpse from exhumedPage docs (docs/batch-3.md NEC-09).
 */
import {detectChrome} from '@necro/exhume'
import type {
  Corpse,
  CorpseFacts,
  CorpsePage,
  CorpseSection,
  ExhumedPageInput,
  ShapeCluster,
  SiteFact,
} from './corpse'

const SECTION_TEXT_CAP = 600
/** ~60k tokens ≈ 240k chars at ~4 chars/token. */
const TOKEN_BUDGET_CHARS = 60_000 * 4

function trimSectionText(text: string): string {
  const normalised = text.replace(/\s+/g, ' ').trim()
  return normalised.length <= SECTION_TEXT_CAP ? normalised : normalised.slice(0, SECTION_TEXT_CAP)
}

function pagePath(page: ExhumedPageInput): string {
  if (page.path) return page.path.startsWith('/') ? page.path : `/${page.path}`
  if (page.url) {
    try {
      return new URL(page.url).pathname || '/'
    } catch {
      return '/'
    }
  }
  return '/'
}

/** First path segment as cluster prefix (`/services/a` → `/services`). */
export function pathPrefixOf(path: string): string {
  const parts = path.replace(/\/+$/, '').split('/').filter(Boolean)
  if (parts.length === 0) return '/'
  if (parts.length === 1) return `/${parts[0]}`
  return `/${parts[0]}`
}

/** Levenshtein distance on kind sequences (signature similarity ±1). */
export function signatureDistance(a: string[], b: string[]): number {
  const m = a.length
  const n = b.length
  if (Math.abs(m - n) > 1) return Math.abs(m - n)
  const dp: number[][] = Array.from({length: m + 1}, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i]![0] = i
  for (let j = 0; j <= n; j++) dp[0]![j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost)
    }
  }
  return dp[m]![n]!
}

function buildSections(page: ExhumedPageInput, chrome: Set<string>): CorpseSection[] {
  const images = page.images?.length ?? 0
  const links = page.links?.length ?? 0
  const raw = page.sections ?? []
  if (raw.length === 0) {
    const headingText = (page.headings ?? []).join(' ').trim()
    if (!headingText) return []
    return [
      {
        kind: 'prose',
        text: trimSectionText(headingText),
        imageCount: images,
        linkCount: links,
      },
    ]
  }

  const sections: CorpseSection[] = []
  for (const section of raw) {
    let text = trimSectionText(section.text ?? '')
    if (!text) continue
    for (const block of chrome) {
      if (text.includes(block)) {
        text = text.replace(block, ' ').replace(/\s+/g, ' ').trim()
      }
    }
    if (!text) continue
    sections.push({
      kind: section.kind || 'prose',
      text,
      imageCount: images,
      linkCount: links,
    })
  }
  return sections
}

function mergeFacts(key: keyof CorpseFacts, pages: ExhumedPageInput[]): SiteFact[] {
  const map = new Map<string, Set<string>>()
  for (const page of pages) {
    const values = page.detectedEntities?.[key] ?? []
    for (const value of values) {
      const trimmed = value.trim()
      if (!trimmed) continue
      const set = map.get(trimmed) ?? new Set<string>()
      set.add(page._id)
      map.set(trimmed, set)
    }
  }
  return [...map.entries()]
    .map(([value, pageIds]) => ({value, pages: [...pageIds].sort()}))
    .sort((a, b) => b.pages.length - a.pages.length || a.value.localeCompare(b.value))
}

/** @public exported for tests */
export function findShapeClusters(pages: CorpsePage[]): ShapeCluster[] {
  return buildClusters(pages)
}

/** Alias for tests / callers */
export const pathPrefix = pathPrefixOf

/** Plain text corpus for excerpt substring checks. */
export function pageTextCorpus(
  page: Pick<CorpsePage, 'title' | 'sections'> | ExhumedPageInput,
): string {
  const parts: string[] = []
  if ('title' in page && page.title) parts.push(page.title)
  if ('headings' in page && Array.isArray(page.headings)) {
    parts.push(...page.headings.filter(Boolean))
  }
  if ('sections' in page && page.sections) {
    for (const s of page.sections) {
      if (s && 'text' in s && s.text) parts.push(s.text)
    }
  }
  return parts.join('\n')
}

/** @public exported for tests */
export function enforceTokenBudget(corpse: Corpse): Corpse {
  return enforceBudget(corpse)
}

function buildClusters(pages: CorpsePage[]): ShapeCluster[] {
  type Member = {page: CorpsePage; signature: string[]; prefix: string}
  const members: Member[] = pages.map((page) => ({
    page,
    signature: page.sections.map((s) => s.kind),
    prefix: pathPrefixOf(page.path),
  }))

  const byPrefix = new Map<string, Member[]>()
  for (const m of members) {
    if (m.prefix === '/' && members.filter((x) => x.prefix === '/').length < 2) continue
    const list = byPrefix.get(m.prefix) ?? []
    list.push(m)
    byPrefix.set(m.prefix, list)
  }

  const clusters: ShapeCluster[] = []
  for (const [prefix, group] of byPrefix) {
    // Spec: clusters of 3+ pages with the same shape become collection types.
    if (group.length < 3) continue
    const used = new Set<string>()
    for (const seed of group) {
      if (used.has(seed.page.pageId)) continue
      const clusterMembers = [seed]
      used.add(seed.page.pageId)
      for (const other of group) {
        if (used.has(other.page.pageId)) continue
        if (signatureDistance(seed.signature, other.signature) <= 1) {
          clusterMembers.push(other)
          used.add(other.page.pageId)
        }
      }
      if (clusterMembers.length < 3) continue
      const shortest = clusterMembers.reduce((a, b) =>
        a.signature.length <= b.signature.length ? a : b,
      )
      clusters.push({
        pathPrefix: prefix,
        signature: shortest.signature,
        pageIds: clusterMembers.map((m) => m.page.pageId).sort(),
      })
    }
  }

  return clusters.sort(
    (a, b) => b.pageIds.length - a.pageIds.length || a.pathPrefix.localeCompare(b.pathPrefix),
  )
}

function estimateChars(corpse: Corpse): number {
  return JSON.stringify(corpse).length
}

/** Truncate longest section texts first; never drop a page entirely. */
function enforceBudget(corpse: Corpse): Corpse {
  let chars = estimateChars(corpse)
  if (chars <= TOKEN_BUDGET_CHARS) return corpse

  const pages = corpse.pages.map((p) => ({
    ...p,
    sections: p.sections.map((s) => ({...s})),
  }))

  while (chars > TOKEN_BUDGET_CHARS) {
    let longest: {pageIdx: number; sectionIdx: number; len: number} | null = null
    for (let pi = 0; pi < pages.length; pi++) {
      const page = pages[pi]!
      for (let si = 0; si < page.sections.length; si++) {
        const len = page.sections[si]!.text.length
        if (len <= 40) continue
        if (!longest || len > longest.len) {
          longest = {pageIdx: pi, sectionIdx: si, len}
        }
      }
    }
    if (!longest) break
    const section = pages[longest.pageIdx]!.sections[longest.sectionIdx]!
    const nextLen = Math.max(40, Math.floor(section.text.length * 0.7))
    section.text = section.text.slice(0, nextLen)
    chars = estimateChars({...corpse, pages})
  }

  return {...corpse, pages}
}

function dedupeByHash(pages: ExhumedPageInput[]): ExhumedPageInput[] {
  const seen = new Map<string, ExhumedPageInput>()
  const out: ExhumedPageInput[] = []
  for (const page of pages) {
    const hash = page.contentHash?.trim()
    if (hash) {
      const existing = seen.get(hash)
      if (existing) {
        const a = pagePath(existing)
        const b = pagePath(page)
        if (b.length < a.length || (b.length === a.length && b < a)) {
          const idx = out.indexOf(existing)
          if (idx >= 0) out[idx] = page
          seen.set(hash, page)
        }
        continue
      }
      seen.set(hash, page)
    }
    out.push(page)
  }
  return out
}

export function condense(pages: ExhumedPageInput[]): Corpse {
  const ok = dedupeByHash(pages).filter((p) => (p.httpStatus ?? 200) < 400)

  const pageTexts = ok.map((p) =>
    (p.sections ?? [])
      .map((s) => s.text ?? '')
      .join('\n')
      .trim(),
  )
  const chromeList = detectChrome(pageTexts)
  const chromeSet = new Set(chromeList)

  const corpsePages: CorpsePage[] = ok.map((page) => ({
    pageId: page._id,
    path: pagePath(page),
    title: page.title,
    httpStatus: page.httpStatus ?? 200,
    sections: buildSections(page, chromeSet),
  }))

  const facts: CorpseFacts = {
    phones: mergeFacts('phones', ok),
    emails: mergeFacts('emails', ok),
    addresses: mergeFacts('addresses', ok),
    prices: mergeFacts('prices', ok),
  }

  const corpse: Corpse = {
    pages: corpsePages,
    chrome: chromeList,
    clusters: buildClusters(corpsePages),
    facts,
  }

  return enforceBudget(corpse)
}
