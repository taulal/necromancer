/**
 * Accepted anatomy + exhumed pages + answers → target documents, page mapping and
 * redirects. Pure and deterministic: the same inputs give the same ids, so re-running
 * reanimate replaces the release contents instead of duplicating them.
 */
import {BONES_MATCH_NAMES} from '@necro/bones'
import type {ProposedField, ProposedType} from '@necro/autopsy'
import {answerDecision} from '@necro/interrogate/tasks'
import {atomsFromHtml, blocksFromHtml, type Atom, type ImageSource} from './dissect'
import {block, key, type PtBlock} from './portableText'

export type PlanPage = {
  _id: string
  url?: string
  path?: string
  title?: string
  httpStatus?: number
  html?: string
  images?: Array<{src?: string; alt?: string}>
  detectedEntities?: {phones?: string[]; emails?: string[]; addresses?: string[]; prices?: string[]}
}

export type PlanQuestion = {
  kind?: string
  answer?: string
  evidence?: Array<{url?: string}>
}

export type PlanInput = {
  seance: {url?: string; brand?: {colors?: string[]; fonts?: string[]; logo?: string}}
  pages: PlanPage[]
  /** Accepted proposal types; `evidence[].pageId` are exhumedPage ids. */
  types: ProposedType[]
  questions?: PlanQuestion[]
}

export type TargetDoc = {_id: string; _type: string; [field: string]: unknown}

export type PageTarget = {
  exhumedPageId: string
  docId: string
  type: string
  path: string
}

export type LedgerEntry = {
  from: string
  to: string
  status: 'mapped' | 'dropped' | 'unmapped'
  reason?: string
}

export type ReanimatePlan = {
  docs: TargetDoc[]
  pageTargets: PageTarget[]
  ledger: LedgerEntry[]
  /** Proposal types deployed alongside Bones (collections + their objects). */
  extraTypes: ProposedType[]
  collections: Array<{type: string; route: string}>
  siteTitle?: string
}

const RESERVED = new Set<string>([
  ...BONES_MATCH_NAMES,
  'page',
  'siteSettings',
  'redirect',
  'testimonialDoc',
])

/** "/about/" and "/about" are the same page; the Vessel ignores trailing slashes too. */
export function normPath(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return p.length > 1 ? p.replace(/\/+$/, '') || '/' : '/'
}

export function pathOf(page: Pick<PlanPage, 'path' | 'url'>): string {
  if (page.path) return normPath(page.path)
  try {
    return normPath(new URL(page.url ?? '').pathname || '/')
  } catch {
    return '/'
  }
}

function pathFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    return normPath(new URL(url).pathname || '/')
  } catch {
    return url.startsWith('/') ? normPath(url) : undefined
  }
}

function saturation(hex: string): number {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) return 0
  const h = m[1]!.length === 3 ? m[1]!.replace(/./g, (c) => c + c) : m[1]!
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max === 0 ? 0 : (max - min) / max
}

/** Prefer real brand colours over the white/grey/black every theme ships with. */
export function pickBrandColors(colors: string[]): {primary?: string; secondary?: string} {
  const ranked = [...new Set(colors.map((c) => c.trim()).filter(Boolean))]
    .map((c, i) => ({c, s: saturation(c), i}))
    .sort((a, b) => Number(b.s > 0.25) - Number(a.s > 0.25) || a.i - b.i)
  return {primary: ranked[0]?.c, secondary: ranked[1]?.c}
}

/** Drop CSS keywords ("inherit") and keep real family stacks. */
export function pickBrandFonts(fonts: string[]): {heading?: string; body?: string} {
  const real = fonts
    .map((f) => f.trim())
    .filter((f) => f && !/^(inherit|initial|unset|revert|normal)$/i.test(f))
    .filter((f) => !/mono|courier|consolas|menlo/i.test(f)) // code fonts aren't the brand
  return {heading: real[0], body: real[1] ?? real[0]}
}

function trimSlashes(path: string): string {
  return path.replace(/^\/+|\/+$/g, '')
}

export function kebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

function idSafe(s: string): string {
  return (
    s
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || 'x'
  )
}

/** "Awards | Caz's Kitchen" → site name "Caz's Kitchen" when most titles share it. */
export function siteNameFromTitles(titles: string[]): string | undefined {
  const counts = new Map<string, number>()
  for (const t of titles) {
    const parts = t.split(/\s+[|–—-]\s+/)
    if (parts.length < 2) continue
    for (const candidate of [parts[parts.length - 1]!, parts[0]!]) {
      const c = candidate.trim()
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1)
    }
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  return best && best[1] >= Math.max(2, Math.ceil(titles.length / 2)) ? best[0] : undefined
}

function cleanTitle(title: string | undefined, siteName: string | undefined): string {
  let t = (title ?? '').trim()
  if (siteName) {
    t = t
      .split(/\s+[|–—-]\s+/)
      .filter((p) => p.trim() !== siteName)
      .join(' – ')
      .trim()
  }
  return t || siteName || 'Untitled'
}

function mostCommon(values: string[]): string | undefined {
  const tally = new Map<string, number>()
  for (const v of values.map((x) => x.trim()).filter(Boolean)) tally.set(v, (tally.get(v) ?? 0) + 1)
  return [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
}

/** Images on more than half the pages are chrome (logos, badges), not content. */
function chromeImages(pages: PlanPage[]): Set<string> {
  const tally = new Map<string, number>()
  for (const p of pages) {
    for (const src of new Set((p.images ?? []).map((i) => i.src).filter((s): s is string => !!s))) {
      tally.set(src, (tally.get(src) ?? 0) + 1)
    }
  }
  const threshold = Math.max(2, Math.ceil(pages.length / 2))
  return new Set([...tally.entries()].filter(([, n]) => n >= threshold).map(([src]) => src))
}

function image(src: string, alt?: string): ImageSource {
  return alt ? {_type: 'image', _sourceUrl: src, alt} : {_type: 'image', _sourceUrl: src}
}

function paragraphs(atoms: Atom[]): string[] {
  return atoms
    .filter((a): a is Extract<Atom, {t: 'para'}> => a.t === 'para')
    .map((a) =>
      a.inlines
        .map((i) => i.text)
        .join('')
        .trim(),
    )
    .filter((t) => t.length > 20)
}

function ptFromParagraphs(seed: string, paras: string[]): PtBlock[] {
  return paras.slice(0, 20).map((p, i) => block(`${seed}:${i}`, 'normal', [{text: p}]))
}

function parsePrice(raw: string | undefined): number | undefined {
  const n = Number((raw ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/**
 * Fill a collection doc's fields from its page by field name + type. Deterministic;
 * fields it can't place are left empty for the ritual (or a human) to fill.
 */
function fillField(
  field: ProposedField,
  ctx: {
    seed: string
    title: string
    slug: string
    atoms: Atom[]
    images: ImageSource[]
    page: PlanPage
  },
): unknown {
  const n = field.name.toLowerCase()
  const paras = paragraphs(ctx.atoms)
  const summary = paras.slice(0, 2).join(' ').slice(0, 500)
  const ent = ctx.page.detectedEntities ?? {}

  switch (field.type) {
    case 'slug':
      return {_type: 'slug', current: ctx.slug}
    case 'string':
    case 'text':
      if (/^(title|name|heading|label)$/.test(n)) return ctx.title
      if (/price|cost/.test(n)) return ent.prices?.[0]
      if (/phone|tel/.test(n)) return ent.phones?.[0]
      if (/email/.test(n)) return ent.emails?.[0]
      if (/address|location/.test(n)) return ent.addresses?.[0]
      if (/desc|summary|excerpt|intro|body|content|detail|about|text/.test(n)) {
        return field.type === 'string' ? summary.slice(0, 160) || undefined : summary || undefined
      }
      return undefined
    case 'number':
      if (/price|cost|amount/.test(n)) return parsePrice(ent.prices?.[0])
      return undefined
    case 'url':
      return /url|link|website/.test(n) ? ctx.page.url : undefined
    case 'image':
      return ctx.images[0]
    case 'portableText':
      return paras.length ? ptFromParagraphs(ctx.seed, paras) : undefined
    case 'array':
      if (field.of?.includes('image')) {
        return ctx.images.slice(0, 12).map((img) => ({...img, _key: key(ctx.seed, img._sourceUrl)}))
      }
      if (field.of?.includes('block'))
        return paras.length ? ptFromParagraphs(ctx.seed, paras) : undefined
      return undefined
    default:
      return undefined
  }
}

/** keep-or-kill answers → per-path decisions (drop → home, merge → survivor). */
function pathDecisions(questions: PlanQuestion[]): Map<string, {to: string; reason: string}> {
  const out = new Map<string, {to: string; reason: string}>()
  for (const q of questions) {
    const decision = answerDecision({kind: q.kind}, q.answer)
    if (decision !== 'drop' && decision !== 'merge') continue
    const paths = [
      ...new Set((q.evidence ?? []).map((e) => pathFromUrl(e.url)).filter((p): p is string => !!p)),
    ]
    if (!paths.length) continue
    if (decision === 'drop') {
      for (const p of paths) if (p !== '/') out.set(p, {to: '/', reason: `Dropped: “${q.answer}”`})
    } else {
      const survivor = [...paths].sort((a, b) => a.length - b.length || a.localeCompare(b))[0]!
      for (const p of paths) {
        if (p !== survivor)
          out.set(p, {to: survivor, reason: `Merged into ${survivor}: “${q.answer}”`})
      }
    }
  }
  return out
}

export function planReanimation(input: PlanInput): ReanimatePlan {
  const kept = input.types.filter((t) => t.decision !== 'drop' && t.decision !== 'merge')
  const mergedInto = new Map(
    input.types
      .filter((t) => t.decision === 'merge' && t.mergeInto)
      .map((t) => [t.name, t.mergeInto!]),
  )
  const extraTypes = kept.filter((t) => !RESERVED.has(t.name) && !t.bonesMatch)
  const collectionTypes = extraTypes.filter((t) => t.kind === 'document')

  // Which pages evidence each collection (merged types hand their pages to the survivor).
  const pagesForType = new Map<string, Set<string>>()
  for (const t of input.types) {
    const owner = mergedInto.get(t.name) ?? t.name
    if (!collectionTypes.some((c) => c.name === owner)) continue
    const set = pagesForType.get(owner) ?? new Set<string>()
    for (const e of t.evidence ?? []) set.add(e.pageId.replace(/^drafts\./, ''))
    pagesForType.set(owner, set)
  }

  const live = input.pages.filter((p) => (p.httpStatus ?? 200) < 400)
  const siteName = siteNameFromTitles(live.map((p) => p.title ?? '').filter(Boolean))
  const skipImages = chromeImages(live)
  const decisions = pathDecisions(input.questions ?? [])

  const docs: TargetDoc[] = []
  const pageTargets: PageTarget[] = []
  const ledger: LedgerEntry[] = []
  const byPath = new Map<string, PageTarget>()

  // Home first, then shallow → deep, so query-string variants fold into one doc.
  const ordered = [...input.pages].sort(
    (a, b) =>
      pathOf(a).split('/').length - pathOf(b).split('/').length ||
      pathOf(a).localeCompare(pathOf(b)),
  )

  for (const page of ordered) {
    const path = pathOf(page)
    const id = page._id.replace(/^drafts\./, '')

    if ((page.httpStatus ?? 200) >= 400) {
      if (!ledger.some((l) => l.from === path)) {
        ledger.push({from: path, to: '/', status: 'dropped', reason: `HTTP ${page.httpStatus}`})
      }
      continue
    }

    const existing = byPath.get(path)
    if (existing) {
      pageTargets.push({...existing, exhumedPageId: id})
      continue
    }

    const decided = decisions.get(path)
    if (decided) {
      // Query-string variants share a path: one ledger entry (and one redirect) per path.
      if (!ledger.some((l) => l.from === path)) {
        ledger.push({from: path, to: decided.to, status: 'dropped', reason: decided.reason})
      }
      continue
    }

    const pageUrl = page.url ?? path
    const title = cleanTitle(page.title, siteName)
    const collection = collectionTypes
      .filter((t) => pagesForType.get(t.name)?.has(id) && trimSlashes(path).includes('/'))
      .sort((a, b) => b.confidence - a.confidence)[0]

    let target: PageTarget
    if (collection && page.html) {
      const slug = idSafe(trimSlashes(path).split('/').pop() ?? title)
      const route = kebab(collection.name)
      const docId = `${collection.name}-${slug}`
      const atoms = atomsFromHtml(page.html, pageUrl, skipImages)
      const images = atoms
        .filter((a): a is Extract<Atom, {t: 'image'}> => a.t === 'image')
        .map((a) => image(a.src, a.alt))
      const doc: TargetDoc = {_id: docId, _type: collection.name}
      for (const field of collection.fields) {
        const value = fillField(field, {seed: docId, title, slug, atoms, images, page})
        if (value !== undefined && value !== '') doc[field.name] = value
      }
      if (!collection.fields.some((f) => f.type === 'slug'))
        doc.slug = {_type: 'slug', current: slug}
      docs.push(doc)
      target = {exhumedPageId: id, docId, type: collection.name, path: `/${route}/${slug}`}
    } else {
      const slug = trimSlashes(path) || 'home'
      const docId = `page-${idSafe(slug)}`
      const body = page.html ? blocksFromHtml(page.html, pageUrl, {seed: docId, skipImages}) : []
      // Contact pages get the Bones contact block (it reads siteSettings, never copies it).
      if (/(^|\/)contact/i.test(slug)) {
        body.push({
          _type: 'contactBlock',
          _key: key(docId, 'contact'),
          heading: title,
          showForm: false,
        })
      }
      docs.push({
        _id: docId,
        _type: 'page',
        title,
        slug: {_type: 'slug', current: slug},
        body,
      })
      target = {exhumedPageId: id, docId, type: 'page', path: slug === 'home' ? '/' : `/${slug}`}
    }

    byPath.set(path, target)
    pageTargets.push(target)
    ledger.push({from: path, to: target.path, status: 'mapped'})
  }

  // Links on the new site point at old paths; 301s cover every path that moved.
  for (const entry of ledger) {
    if (entry.from === entry.to) continue
    docs.push({
      _id: `redirect-${key(entry.from)}`,
      _type: 'redirect',
      from: entry.from,
      to: entry.to,
      statusCode: 301,
    })
  }

  const allEnt = (k: 'phones' | 'emails' | 'addresses') =>
    live.flatMap((p) => p.detectedEntities?.[k] ?? [])
  const brand = input.seance.brand ?? {}
  const settings: TargetDoc = {_id: 'siteSettings', _type: 'siteSettings'}
  if (siteName) settings.siteTitle = siteName
  const brandDoc: Record<string, unknown> = {}
  const colors = pickBrandColors(brand.colors ?? [])
  const fonts = pickBrandFonts(brand.fonts ?? [])
  if (colors.primary) brandDoc.primaryColor = colors.primary
  if (colors.secondary) brandDoc.secondaryColor = colors.secondary
  if (fonts.heading) brandDoc.fontHeading = fonts.heading
  if (fonts.body) brandDoc.fontBody = fonts.body
  if (brand.logo) brandDoc.logo = image(brand.logo, siteName)
  if (Object.keys(brandDoc).length) settings.brand = brandDoc
  const phone = mostCommon(allEnt('phones'))
  const email = mostCommon(allEnt('emails'))
  const address = mostCommon(allEnt('addresses'))
  if (phone) settings.phone = phone
  if (email) settings.email = email
  if (address) settings.address = address
  docs.unshift(settings)

  return {
    docs,
    pageTargets,
    ledger,
    extraTypes,
    collections: collectionTypes.map((t) => ({type: t.name, route: kebab(t.name)})),
    siteTitle: siteName,
  }
}
