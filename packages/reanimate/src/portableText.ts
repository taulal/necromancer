/**
 * Minimal Portable Text builders. Keys are deterministic (seeded) so re-running
 * reanimate on the same page produces the same document — idempotent diffs.
 */
import {createHash} from 'node:crypto'

export function key(...seed: Array<string | number>): string {
  return createHash('sha1').update(seed.join('\0')).digest('hex').slice(0, 12)
}

export type Span = {_type: 'span'; _key: string; text: string; marks: string[]}
export type LinkMark = {_type: 'link'; _key: string; href: string}
export type PtBlock = {
  _type: 'block'
  _key: string
  style: 'normal' | 'h2' | 'h3' | 'h4' | 'blockquote'
  listItem?: 'bullet' | 'number'
  level?: number
  children: Span[]
  markDefs: LinkMark[]
}

/** A run of inline text, optionally linked. */
export type Inline = {text: string; href?: string}

export function block(
  seed: string,
  style: PtBlock['style'],
  inlines: Inline[],
  list?: 'bullet' | 'number',
): PtBlock {
  const markDefs: LinkMark[] = []
  const children: Span[] = inlines
    .filter((i) => i.text)
    .map((i, n) => {
      const marks: string[] = []
      if (i.href) {
        const k = key(seed, 'link', n, i.href)
        markDefs.push({_type: 'link', _key: k, href: i.href})
        marks.push(k)
      }
      return {_type: 'span', _key: key(seed, 'span', n), text: i.text, marks}
    })
  const out: PtBlock = {_type: 'block', _key: key(seed), style, children, markDefs}
  if (list) {
    out.listItem = list
    out.level = 1
  }
  return out
}

/** Plain text of a Portable Text array (for search, previews, collection summaries). */
export function toPlainText(blocks: Array<{children?: Array<{text?: string}>}>): string {
  return blocks
    .map((b) => (b.children ?? []).map((c) => c.text ?? '').join(''))
    .filter(Boolean)
    .join('\n\n')
}
