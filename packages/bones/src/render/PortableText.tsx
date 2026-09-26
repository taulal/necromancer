/**
 * Minimal Portable Text renderer: styles, bullet/number lists, link annotations.
 * Enough for resurrected prose; no dependency.
 */
import type {ReactNode} from 'react'
import {linkHref, type RenderContext} from './context'

type Span = {_key?: string; _type?: string; text?: string; marks?: string[]}
type MarkDef = {_key: string; _type?: string; href?: string}
export type PtBlock = {
  _key?: string
  _type?: string
  style?: string
  listItem?: 'bullet' | 'number'
  children?: Span[]
  markDefs?: MarkDef[]
}

function renderSpans(ctx: RenderContext, block: PtBlock): ReactNode[] {
  const defs = new Map((block.markDefs ?? []).map((d) => [d._key, d]))
  return (block.children ?? []).map((span, i) => {
    let node: ReactNode = span.text ?? ''
    for (const mark of span.marks ?? []) {
      if (mark === 'strong') node = <strong>{node}</strong>
      else if (mark === 'em') node = <em>{node}</em>
      else {
        const def = defs.get(mark)
        const href = linkHref(ctx, def?.href)
        if (href) {
          const external = /^https?:/i.test(href)
          node = (
            <a href={href} {...(external ? {rel: 'noreferrer', target: '_blank'} : {})}>
              {node}
            </a>
          )
        }
      }
    }
    return <span key={span._key ?? i}>{node}</span>
  })
}

function renderBlock(ctx: RenderContext, block: PtBlock, key: string | number): ReactNode {
  const children = renderSpans(ctx, block)
  switch (block.style) {
    case 'h2':
      return <h2 key={key}>{children}</h2>
    case 'h3':
      return <h3 key={key}>{children}</h3>
    case 'h4':
      return <h4 key={key}>{children}</h4>
    case 'blockquote':
      return <blockquote key={key}>{children}</blockquote>
    default:
      return <p key={key}>{children}</p>
  }
}

export function PortableText({ctx, value}: {ctx: RenderContext; value?: PtBlock[] | null}) {
  if (!value?.length) return null
  const out: ReactNode[] = []
  let list: {type: 'bullet' | 'number'; items: PtBlock[]} | null = null
  const flush = () => {
    if (!list) return
    const items = list.items.map((b, i) => <li key={b._key ?? i}>{renderSpans(ctx, b)}</li>)
    out.push(
      list.type === 'number' ? (
        <ol key={`ol-${out.length}`}>{items}</ol>
      ) : (
        <ul key={`ul-${out.length}`}>{items}</ul>
      ),
    )
    list = null
  }
  value.forEach((block, i) => {
    if (block._type && block._type !== 'block') return
    if (block.listItem) {
      if (!list || list.type !== block.listItem) {
        flush()
        list = {type: block.listItem, items: []}
      }
      list.items.push(block)
      return
    }
    flush()
    out.push(renderBlock(ctx, block, block._key ?? i))
  })
  flush()
  return <div className="bones-prose">{out}</div>
}

export function plainText(value?: PtBlock[] | null): string {
  return (value ?? [])
    .map((b) => (b.children ?? []).map((c) => c.text ?? '').join(''))
    .filter(Boolean)
    .join(' ')
}
