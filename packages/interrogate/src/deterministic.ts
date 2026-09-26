/**
 * Deterministic interrogation findings (no Claude) — NEC-11 / BRIEF §7.3.
 */
import {createHash} from 'node:crypto'
import {BOILERPLATE_PHRASES} from './boilerplate'
import {evidenceExcerpt, pagePath, pageTextCorpus, pageUrl, wordCount} from './pageText'
import type {DraftQuestion, InterrogatePageInput} from './types'

const THIN_WORD_LIMIT = 60

function fingerprint(parts: string[]): string {
  return createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, 16)
}

type EntityKind = 'phones' | 'emails' | 'addresses' | 'prices'

const ENTITY_LABEL: Record<EntityKind, string> = {
  phones: 'phone number',
  emails: 'email',
  addresses: 'address',
  prices: 'price',
}

/** Home, contact and about pages state the site's own facts. */
const KEY_PAGE = /^\/(?:(?:contact|about)(?:-us)?\/?)?$/i

/** Same fact in different formatting ("(03) 260 1566" / "032601566") must not conflict. */
function normaliseEntity(kind: EntityKind, value: string): string {
  if (kind === 'phones') return value.replace(/\D/g, '')
  return value.toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Same entity kind, conflicting site-level values → contradiction questions.
 * A value is site-level when it appears on ≥2 pages or on a key page; a value
 * found on one deep page (e.g. a directory listing's own contact) is that
 * page's content, not a claim about the site. One question per entity kind.
 */
export function findContradictions(pages: InterrogatePageInput[]): DraftQuestion[] {
  // Prices are excluded: a shop lists many legitimate prices (cazskitchen: 21 "conflicting" prices).
  const kinds: EntityKind[] = ['phones', 'emails', 'addresses']
  const out: DraftQuestion[] = []

  for (const kind of kinds) {
    const byKey = new Map<string, Array<{page: InterrogatePageInput; raw: string}>>()
    for (const page of pages) {
      if ((page.httpStatus ?? 200) >= 400) continue
      for (const raw of page.detectedEntities?.[kind] ?? []) {
        const value = raw.trim()
        const key = normaliseEntity(kind, value)
        if (!key) continue
        const hits = byKey.get(key) ?? []
        if (!hits.some((h) => h.page._id === page._id)) hits.push({page, raw: value})
        byKey.set(key, hits)
      }
    }

    const siteLevel = [...byKey.values()].filter(
      (hits) => hits.length >= 2 || hits.some((h) => KEY_PAGE.test(pagePath(h.page))),
    )
    if (siteLevel.length < 2) continue

    const values = siteLevel
      .map((hits) => ({hits, label: mostCommon(hits.map((h) => h.raw))}))
      .sort((a, b) => b.hits.length - a.hits.length || a.label.localeCompare(b.label))
    const options = values.map((v) => v.label)
    const evidence = values.flatMap(({hits}) =>
      hits.slice(0, 2).map(({page, raw}) => ({
        pageId: page._id.replace(/^drafts\./, ''),
        url: pageUrl(page),
        excerpt: evidenceExcerpt(page, raw),
      })),
    )

    const label = ENTITY_LABEL[kind]
    const listed = options.map((v) => `"${v}"`).join(', ')
    out.push({
      fingerprint: fingerprint(['contradiction', kind, ...options]),
      kind: 'contradiction',
      prompt: `This site lists different ${label}s across pages: ${listed}. Which is correct?`,
      evidence,
      options: [...options, 'None of these — I will clarify'],
      required: true,
      source: 'claude',
      spawnsTasks: true,
      rank: 100,
    })
  }

  return out
}

function mostCommon(values: string[]): string {
  const tally = new Map<string, number>()
  for (const v of values) tally.set(v, (tally.get(v) ?? 0) + 1)
  return [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0]
}

/** Missing meta description or image alt → missing-info (optional). */
export function findMissingMetaAlt(pages: InterrogatePageInput[]): DraftQuestion[] {
  const out: DraftQuestion[] = []
  const missingMeta = pages.filter(
    (p) => (p.httpStatus ?? 200) < 400 && !(p.meta?.description ?? '').trim(),
  )
  if (missingMeta.length > 0) {
    const sample = missingMeta.slice(0, 3)
    out.push({
      fingerprint: fingerprint(['missing-meta', ...missingMeta.map((p) => p._id).sort()]),
      kind: 'missing-info',
      prompt: `${missingMeta.length} page(s) have no meta description (e.g. ${sample
        .map((p) => pagePath(p))
        .join(', ')}). Should we generate SEO descriptions during the ritual?`,
      evidence: sample.map((p) => ({
        pageId: p._id.replace(/^drafts\./, ''),
        url: pageUrl(p),
        excerpt: evidenceExcerpt(p),
      })),
      options: ['Yes — generate meta descriptions', 'No — leave them empty', 'Only for key pages'],
      required: false,
      source: 'claude',
      spawnsTasks: true,
      rank: 55,
    })
  }

  const missingAltPages: InterrogatePageInput[] = []
  let missingAltCount = 0
  for (const page of pages) {
    if ((page.httpStatus ?? 200) >= 400) continue
    const bad = (page.images ?? []).filter((img) => img.src && !(img.alt ?? '').trim())
    if (bad.length === 0) continue
    missingAltCount += bad.length
    missingAltPages.push(page)
  }
  if (missingAltPages.length > 0) {
    const sample = missingAltPages.slice(0, 3)
    out.push({
      fingerprint: fingerprint(['missing-alt', ...missingAltPages.map((p) => p._id).sort()]),
      kind: 'missing-info',
      prompt: `${missingAltCount} image(s) on ${missingAltPages.length} page(s) lack alt text. Generate alt text in the ritual?`,
      evidence: sample.map((p) => ({
        pageId: p._id.replace(/^drafts\./, ''),
        url: pageUrl(p),
        excerpt: evidenceExcerpt(p),
      })),
      options: ['Yes — generate alt text', 'No — skip images without alt', 'Only hero images'],
      required: false,
      source: 'claude',
      spawnsTasks: true,
      rank: 50,
    })
  }

  return out
}

/** httpStatus ≥ 400 → keep-or-kill (optional). */
export function findHttpErrorPages(pages: InterrogatePageInput[]): DraftQuestion[] {
  return pages
    .filter((p) => (p.httpStatus ?? 200) >= 400)
    .map((p) => {
      const status = p.httpStatus ?? 400
      const path = pagePath(p)
      return {
        fingerprint: fingerprint(['http-error', p._id, String(status)]),
        kind: 'keep-or-kill' as const,
        prompt: `${path} returned HTTP ${status}. Keep a stub redirect target, or drop it from the resurrection?`,
        evidence: [
          {
            pageId: p._id.replace(/^drafts\./, ''),
            url: pageUrl(p),
            excerpt: evidenceExcerpt(p, p.title),
          },
        ],
        options: ['Drop this page', 'Keep as a soft 404 / stub', 'Redirect elsewhere (note where)'],
        required: false,
        source: 'claude' as const,
        spawnsTasks: true,
        rank: 80,
      }
    })
}

/**
 * Thin pages (< 60 words) → keep-or-kill (optional). One question per path:
 * query-string variants (/member-login/?logged_out=true) fold into evidence.
 */
export function findThinPages(pages: InterrogatePageInput[]): DraftQuestion[] {
  const byPath = new Map<string, InterrogatePageInput[]>()
  for (const p of pages) {
    if ((p.httpStatus ?? 200) >= 400) continue
    const words = wordCount(p)
    if (words === 0 || words >= THIN_WORD_LIMIT) continue
    const path = pagePath(p)
    byPath.set(path, [...(byPath.get(path) ?? []), p])
  }

  return [...byPath.entries()].map(([path, variants]) => {
    const words = Math.max(...variants.map(wordCount))
    const also = variants.length > 1 ? ` (${variants.length} URL variants)` : ''
    return {
      fingerprint: fingerprint(['thin', path, ...variants.map((p) => p._id).sort()]),
      kind: 'keep-or-kill' as const,
      prompt: `${path} has only ${words} words${also}. Keep it, merge into another page, or kill it?`,
      evidence: variants.slice(0, 3).map((p) => ({
        pageId: p._id.replace(/^drafts\./, ''),
        url: pageUrl(p),
        excerpt: evidenceExcerpt(p),
      })),
      options: ['Keep as-is', 'Merge into another page', 'Kill this page'],
      required: false,
      source: 'claude' as const,
      spawnsTasks: true,
      rank: 40,
    }
  })
}

/** Durable/theme boilerplate phrases → authenticity (required). */
export function findBoilerplate(pages: InterrogatePageInput[]): DraftQuestion[] {
  const hits: Array<{page: InterrogatePageInput; phrase: string; excerpt: string}> = []

  for (const page of pages) {
    if ((page.httpStatus ?? 200) >= 400) continue
    const corpus = pageTextCorpus(page)
    const lower = corpus.toLowerCase()
    for (const phrase of BOILERPLATE_PHRASES) {
      const idx = lower.indexOf(phrase.toLowerCase())
      if (idx < 0) continue
      const excerpt = corpus.slice(idx, idx + phrase.length)
      // Prefer exact casing from page when lengths match.
      const exact = corpus.includes(phrase)
        ? phrase
        : excerpt.length === phrase.length
          ? excerpt
          : phrase
      if (!corpus.includes(exact) && !lower.includes(phrase.toLowerCase())) continue
      // Use a slice that is an exact substring of corpus.
      let proven = exact
      if (!corpus.includes(proven)) {
        proven = corpus.slice(idx, idx + phrase.length)
      }
      if (!corpus.includes(proven)) continue
      hits.push({page, phrase, excerpt: proven})
      break // one hit per page is enough signal
    }
  }

  if (hits.length === 0) return []

  // Group into one site-level authenticity question when many pages share boilerplate.
  const phrases = [...new Set(hits.map((h) => h.phrase))]
  const sample = hits.slice(0, 4)
  return [
    {
      fingerprint: fingerprint([
        'boilerplate',
        ...phrases.sort(),
        ...hits.map((h) => h.page._id).sort(),
      ]),
      kind: 'authenticity',
      prompt: `Placeholder / theme boilerplate detected (${phrases
        .map((p) => `"${p}"`)
        .join(
          ', ',
        )}) on ${hits.length} page(s). Is this authentic copy to keep, or should the ritual rewrite it?`,
      evidence: sample.map(({page, excerpt}) => ({
        pageId: page._id.replace(/^drafts\./, ''),
        url: pageUrl(page),
        excerpt,
      })),
      options: [
        'Rewrite all boilerplate',
        'Keep — it is intentional',
        'Rewrite only the worst offenders',
      ],
      required: true,
      source: 'claude',
      spawnsTasks: true,
      rank: 95,
    },
  ]
}

/** Run all deterministic extractors. */
export function collectDeterministicQuestions(pages: InterrogatePageInput[]): DraftQuestion[] {
  return [
    ...findContradictions(pages),
    ...findBoilerplate(pages),
    ...findHttpErrorPages(pages),
    ...findMissingMetaAlt(pages),
    ...findThinPages(pages),
  ]
}
