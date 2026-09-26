/**
 * Exhumed page HTML → ordered content atoms → Bones blocks (deterministic, no LLM).
 *
 * Chrome (header/nav/footer/cookie bars) is stripped; the main content is walked in
 * document order. A new section starts at every h1/h2. Sections become:
 *   first section with an h1 → hero · ≥3 images + little text → gallery ·
 *   FAQ heading + h3 questions → faq · images + text → mediaText · else richText.
 */
import * as cheerio from 'cheerio'
import type {AnyNode, Element} from 'domhandler'
import {block, key, type Inline, type PtBlock} from './portableText'

export type ImageSource = {_type: 'image'; _sourceUrl: string; alt?: string}

export type Atom =
  | {t: 'heading'; level: 1 | 2 | 3 | 4; text: string}
  | {t: 'para'; inlines: Inline[]}
  | {t: 'list'; ordered: boolean; items: Inline[][]}
  | {t: 'quote'; inlines: Inline[]}
  | {t: 'image'; src: string; alt?: string}

export type BonesBlock = {_type: string; _key: string; [field: string]: unknown}

const CHROME = [
  'header',
  'nav',
  'footer',
  'aside',
  'form',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '#main-header',
  '#main-footer',
  '#top-header',
  '#et-top-navigation',
  '.site-header',
  '.site-footer',
  '.menu',
  '.nav',
  '.navbar',
  '.breadcrumb',
  '.woocommerce-breadcrumb',
  '.cookie',
  '#cookie-notice',
  '.screen-reader-text',
  '.skip-link',
].join(', ')

const ROOTS = ['main', '[role="main"]', '#main-content', 'article', '.entry-content', '#content']

const MAX_BLOCKS = 14
const MAX_PT_PER_SECTION = 40

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Same-site absolute links become paths so the Vessel's 301s can re-map them. */
function localiseHref(href: string | undefined, pageUrl: string): string | undefined {
  if (!href || href.startsWith('#') || /^(javascript|mailto|tel):/i.test(href)) {
    return href && /^(mailto|tel):/i.test(href) ? href : undefined
  }
  try {
    const abs = new URL(href, pageUrl)
    const base = new URL(pageUrl)
    if (abs.host === base.host) return `${abs.pathname}${abs.search}`
    return abs.toString()
  } catch {
    return undefined
  }
}

function inlinesOf($: cheerio.CheerioAPI, el: AnyNode, pageUrl: string): Inline[] {
  const out: Inline[] = []
  const walk = (node: AnyNode, href?: string) => {
    if (node.type === 'text') {
      const text = (node as unknown as {data: string}).data.replace(/\s+/g, ' ')
      if (text.trim() || (out.length && text === ' ')) out.push({text, href})
      return
    }
    if (node.type !== 'tag') return
    const tag = (node as Element).tagName.toLowerCase()
    if (tag === 'br') {
      out.push({text: ' '})
      return
    }
    if (tag === 'img' || tag === 'script' || tag === 'style') return
    const nextHref = tag === 'a' ? localiseHref($(node).attr('href'), pageUrl) : href
    for (const child of (node as Element).children) walk(child, nextHref)
  }
  walk(el)
  // Merge adjacent runs with the same link and trim the ends.
  const merged: Inline[] = []
  for (const run of out) {
    const last = merged[merged.length - 1]
    if (last && last.href === run.href) last.text += run.text
    else merged.push({...run})
  }
  if (merged[0]) merged[0].text = merged[0].text.replace(/^\s+/, '')
  const tail = merged[merged.length - 1]
  if (tail) tail.text = tail.text.replace(/\s+$/, '')
  return merged.filter((m) => m.text)
}

function textOf(inlines: Inline[]): string {
  return clean(inlines.map((i) => i.text).join(''))
}

/** Walk the main content of a page in document order. */
export function atomsFromHtml(
  html: string,
  pageUrl: string,
  skipImages: ReadonlySet<string> = new Set(),
): Atom[] {
  const $ = cheerio.load(html)
  $('script, style, noscript, iframe, svg, template, button, select, input, textarea').remove()
  $(CHROME).remove()

  const root =
    ROOTS.map((s) => $(s).first()).find((n) => n.length && clean(n.text()).length > 80) ?? $('body')

  const atoms: Atom[] = []
  const seenText = new Set<string>()
  const seenImg = new Set<string>()

  root.find('h1, h2, h3, h4, p, ul, ol, blockquote, img').each((_, el) => {
    const node = $(el)
    const tag = el.tagName.toLowerCase()
    // Content already captured by an enclosing list / quote / paragraph.
    if (tag !== 'img' && node.parents('ul, ol, blockquote').length) return
    if (tag !== 'img' && tag !== 'p' && node.parents('p').length) return

    if (tag === 'img') {
      const raw = node.attr('src') || node.attr('data-src') || node.attr('data-lazy-src')
      if (!raw || raw.startsWith('data:')) return
      let src: string
      try {
        src = new URL(raw, pageUrl).toString()
      } catch {
        return
      }
      const w = Number(node.attr('width'))
      if (Number.isFinite(w) && w > 0 && w < 64) return // icons, spacers
      if (seenImg.has(src) || skipImages.has(src)) return
      seenImg.add(src)
      atoms.push({t: 'image', src, alt: clean(node.attr('alt') ?? '') || undefined})
      return
    }

    if (/^h[1-4]$/.test(tag)) {
      const text = clean(node.text())
      if (!text || text.length > 200) return
      atoms.push({t: 'heading', level: Number(tag[1]) as 1 | 2 | 3 | 4, text})
      return
    }

    if (tag === 'ul' || tag === 'ol') {
      const items = node
        .children('li')
        .map((__, li) => [inlinesOf($, li, pageUrl)])
        .get() as Inline[][]
      const kept = items.filter((i) => textOf(i).length > 0)
      if (kept.length) atoms.push({t: 'list', ordered: tag === 'ol', items: kept})
      return
    }

    const inlines = inlinesOf($, el, pageUrl)
    const text = textOf(inlines)
    if (text.length < 2 || seenText.has(text)) return
    seenText.add(text)
    atoms.push(tag === 'blockquote' ? {t: 'quote', inlines} : {t: 'para', inlines})
  })

  return atoms
}

type Section = {heading?: string; level?: number; atoms: Atom[]}

function sectionise(atoms: Atom[]): Section[] {
  const sections: Section[] = [{atoms: []}]
  for (const atom of atoms) {
    if (atom.t === 'heading' && atom.level <= 2) {
      sections.push({heading: atom.text, level: atom.level, atoms: []})
    } else {
      sections[sections.length - 1]!.atoms.push(atom)
    }
  }
  return sections.filter((s) => s.heading || s.atoms.length)
}

function toPt(seed: string, atoms: Atom[], heading?: string): PtBlock[] {
  const out: PtBlock[] = []
  if (heading) out.push(block(`${seed}:h`, 'h2', [{text: heading}]))
  atoms.forEach((a, i) => {
    const s = `${seed}:${i}`
    if (a.t === 'heading')
      out.push(block(s, a.level <= 2 ? 'h2' : a.level === 3 ? 'h3' : 'h4', [{text: a.text}]))
    else if (a.t === 'para') out.push(block(s, 'normal', a.inlines))
    else if (a.t === 'quote') out.push(block(s, 'blockquote', a.inlines))
    else if (a.t === 'list') {
      a.items.forEach((item, j) =>
        out.push(block(`${s}:${j}`, 'normal', item, a.ordered ? 'number' : 'bullet')),
      )
    }
  })
  return out.slice(0, MAX_PT_PER_SECTION)
}

function image(src: string, alt?: string): ImageSource {
  return alt ? {_type: 'image', _sourceUrl: src, alt} : {_type: 'image', _sourceUrl: src}
}

function textLength(atoms: Atom[]): number {
  return atoms.reduce((n, a) => {
    if (a.t === 'para' || a.t === 'quote') return n + textOf(a.inlines).length
    if (a.t === 'list') return n + a.items.reduce((m, i) => m + textOf(i).length, 0)
    if (a.t === 'heading') return n + a.text.length
    return n
  }, 0)
}

function faqItems(seed: string, atoms: Atom[]) {
  const items: Array<{_key: string; question: string; answer: PtBlock[]}> = []
  let current: {question: string; atoms: Atom[]} | null = null
  const flush = () => {
    if (current && current.atoms.length) {
      items.push({
        _key: key(seed, current.question),
        question: current.question,
        answer: toPt(`${seed}:${current.question}`, current.atoms),
      })
    }
  }
  for (const a of atoms) {
    if (a.t === 'heading' && a.level >= 3) {
      flush()
      current = {question: a.text, atoms: []}
    } else if (current && a.t !== 'image') {
      current.atoms.push(a)
    }
  }
  flush()
  return items
}

/** Page HTML → Bones `body[]`. Images carry `_sourceUrl` until reanimate uploads them. */
export function blocksFromHtml(
  html: string,
  pageUrl: string,
  opts: {seed?: string; skipImages?: ReadonlySet<string>} = {},
): BonesBlock[] {
  const seed = opts.seed ?? pageUrl
  const sections = sectionise(atomsFromHtml(html, pageUrl, opts.skipImages))
  const blocks: BonesBlock[] = []
  let mediaSide: 'left' | 'right' = 'right'

  sections.forEach((section, index) => {
    const s = `${seed}:${index}`
    const imgs = section.atoms.filter((a): a is Extract<Atom, {t: 'image'}> => a.t === 'image')
    const text = section.atoms.filter((a) => a.t !== 'image')
    const h1 = index <= 1 && section.level === 1

    if (h1 && section.heading) {
      const firstPara = text.find((a): a is Extract<Atom, {t: 'para'}> => a.t === 'para')
      const hero: BonesBlock = {
        _type: 'hero',
        _key: key(s, 'hero'),
        heading: section.heading.slice(0, 90),
      }
      if (firstPara) hero.subheading = textOf(firstPara.inlines).slice(0, 240)
      if (imgs[0]) hero.image = image(imgs[0].src, imgs[0].alt)
      blocks.push(hero)
      const rest = text.filter((a) => a !== firstPara)
      if (textLength(rest) > 0) {
        blocks.push({_type: 'richText', _key: key(s, 'rest'), body: toPt(`${s}:rest`, rest)})
      }
      return
    }

    if (section.heading && /faq|frequently asked/i.test(section.heading)) {
      const items = faqItems(s, text)
      if (items.length) {
        blocks.push({_type: 'faq', _key: key(s, 'faq'), heading: section.heading, items})
        return
      }
    }

    if (imgs.length >= 3 && textLength(text) < 200) {
      const g: BonesBlock = {
        _type: 'gallery',
        _key: key(s, 'gallery'),
        images: imgs.slice(0, 24).map((img) => ({
          _key: key(s, img.src),
          image: image(img.src),
          alt: img.alt,
        })),
      }
      if (section.heading) g.heading = section.heading
      blocks.push(g)
      return
    }

    if (imgs[0] && textLength(text) > 0) {
      const m: BonesBlock = {
        _type: 'mediaText',
        _key: key(s, 'media'),
        body: toPt(s, text),
        image: image(imgs[0].src, imgs[0].alt),
        imageSide: mediaSide,
      }
      if (section.heading) m.heading = section.heading
      mediaSide = mediaSide === 'right' ? 'left' : 'right'
      blocks.push(m)
      return
    }

    if (textLength(text) > 0 || section.heading) {
      blocks.push({_type: 'richText', _key: key(s, 'rich'), body: toPt(s, text, section.heading)})
    }
  })

  return blocks.slice(0, MAX_BLOCKS)
}

/** Every `_sourceUrl` in a value tree (for uploading). */
export function collectImageSources(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => collectImageSources(v, out))
  else if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (typeof obj._sourceUrl === 'string') out.add(obj._sourceUrl)
    for (const v of Object.values(obj)) collectImageSources(v, out)
  }
  return out
}

/**
 * Replace `_sourceUrl` placeholders with uploaded asset refs. Images that failed to
 * upload are removed (their parent keeps its other fields).
 */
export function resolveImageSources<T>(value: T, assets: Map<string, string>): T {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      return v.map(walk).filter((x) => x !== undefined)
    }
    if (v && typeof v === 'object') {
      const obj = v as Record<string, unknown>
      if (typeof obj._sourceUrl === 'string') {
        const ref = assets.get(obj._sourceUrl)
        if (!ref) return undefined
        const {_sourceUrl: _drop, ...rest} = obj
        return {...rest, asset: {_type: 'reference', _ref: ref}}
      }
      const out: Record<string, unknown> = {}
      for (const [k, child] of Object.entries(obj)) {
        const next = walk(child)
        if (next !== undefined) out[k] = next
      }
      return out
    }
    return v
  }
  return walk(value) as T
}
