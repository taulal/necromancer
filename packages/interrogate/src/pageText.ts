/**
 * Page text corpus for evidence substring checks (mirrors autopsy validate).
 */
import type {InterrogatePageInput} from './types'

export function pagePath(page: InterrogatePageInput): string {
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

export function pageUrl(page: InterrogatePageInput): string {
  if (page.url) return page.url
  return pagePath(page)
}

/** Plain text used for excerpt validation and word counts. */
export function pageTextCorpus(page: InterrogatePageInput): string {
  const parts: string[] = []
  if (page.title) parts.push(page.title)
  if (page.headings?.length) parts.push(...page.headings.filter(Boolean))
  if (page.sections) {
    for (const s of page.sections) {
      if (s?.text) parts.push(s.text)
    }
  }
  return parts.join('\n')
}

export function wordCount(page: InterrogatePageInput): number {
  const text = pageTextCorpus(page).replace(/\s+/g, ' ').trim()
  if (!text) return 0
  return text.split(' ').filter(Boolean).length
}

export function findExcerpt(haystack: string, needle: string): string | null {
  if (!needle || !haystack.includes(needle)) return null
  return needle
}

/** Prefer an exact value occurrence; fall back to a short title/path slice. */
export function evidenceExcerpt(page: InterrogatePageInput, preferred?: string): string {
  const corpus = pageTextCorpus(page)
  if (preferred) {
    const hit = findExcerpt(corpus, preferred)
    if (hit) return hit
  }
  if (page.title && corpus.includes(page.title)) return page.title
  const first = corpus.replace(/\s+/g, ' ').trim().slice(0, 80)
  if (first && corpus.includes(first)) return first
  // Last resort: path is not in corpus — use title or a section fragment already in corpus.
  for (const s of page.sections ?? []) {
    const t = (s.text ?? '').trim()
    if (t.length >= 8) {
      const slice = t.slice(0, Math.min(80, t.length))
      if (corpus.includes(slice)) return slice
    }
  }
  return page.title ?? pagePath(page)
}
