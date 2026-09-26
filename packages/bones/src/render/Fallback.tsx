/**
 * Schema-driven renderer for inferred types Bones doesn't know (product, service…).
 * Reads the deployed manifest and renders by field type: string → heading/text,
 * image → figure, image[] → gallery, portable text → prose, price-ish number → price,
 * url → link. This is how the Vessel shows the schema instead of hiding it.
 */
import type {ReactNode} from 'react'
import {Figure} from './blocks'
import type {ImageValue, RenderContext} from './context'
import {PortableText, plainText, type PtBlock} from './PortableText'

export type ManifestField = {name: string; type: string; title?: string; of?: Array<{type: string}>}
export type ManifestType = {name: string; type: string; title?: string; fields?: ManifestField[]}
type Doc = {_id: string; _type: string; [field: string]: unknown}

const TITLE_FIELD = /^(title|name|heading|label)$/i

function isPortableText(field: ManifestField): boolean {
  return field.type === 'array' && !!field.of?.some((m) => m.type === 'block')
}

function isImageArray(field: ManifestField): boolean {
  return field.type === 'array' && !!field.of?.some((m) => m.type === 'image')
}

function titleOf(doc: Doc, type?: ManifestType): string {
  const field = type?.fields?.find((f) => f.type === 'string' && TITLE_FIELD.test(f.name))
  const v = field ? doc[field.name] : (doc.title ?? doc.name)
  return typeof v === 'string' && v ? v : doc._id
}

function label(field: ManifestField): string {
  return field.title && field.title !== field.name
    ? field.title
    : field.name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())
}

function formatPrice(n: number): string {
  return n.toLocaleString('en-GB', {minimumFractionDigits: 2, maximumFractionDigits: 2})
}

/** One field, rendered by its schema type. */
function FieldView({
  ctx,
  field,
  value,
}: {
  ctx: RenderContext
  field: ManifestField
  value: unknown
}): ReactNode {
  if (value == null || value === '') return null
  if (isPortableText(field)) return <PortableText ctx={ctx} value={value as PtBlock[]} />
  if (isImageArray(field)) {
    return (
      <div className="bones-grid bones-grid--tight">
        {(value as Array<ImageValue & {_key?: string}>).map((img, i) => (
          <Figure key={img?._key ?? i} ctx={ctx} image={img} width={700} />
        ))}
      </div>
    )
  }
  switch (field.type) {
    case 'image':
      return <Figure ctx={ctx} image={value as ImageValue} width={1200} />
    case 'text':
      return <p className="bones-lede">{String(value)}</p>
    case 'number':
      return /price|cost|amount/i.test(field.name) ? (
        <p className="bones-price">{formatPrice(Number(value))}</p>
      ) : (
        <p>
          {label(field)}: {String(value)}
        </p>
      )
    case 'url':
      return (
        <p>
          <a href={String(value)} rel="noreferrer" target="_blank">
            {label(field)}
          </a>
        </p>
      )
    case 'boolean':
      return (
        <p>
          {label(field)}: {value ? 'Yes' : 'No'}
        </p>
      )
    case 'string':
      return /price|cost/i.test(field.name) ? (
        <p className="bones-price">{String(value)}</p>
      ) : (
        <p>{String(value)}</p>
      )
    default:
      return null
  }
}

/** Detail view of a collection doc. */
export function FallbackDoc({ctx, doc, type}: {ctx: RenderContext; doc: Doc; type?: ManifestType}) {
  const fields = (type?.fields ?? []).filter((f) => f.type !== 'slug' && f.type !== 'reference')
  const titleField = fields.find((f) => f.type === 'string' && TITLE_FIELD.test(f.name))
  const hero = fields.find((f) => f.type === 'image')
  return (
    <article className="bones-doc">
      <div className="bones-doc__head">
        <p className="bones-eyebrow">{type?.title ?? doc._type}</p>
        <h1>{titleOf(doc, type)}</h1>
      </div>
      {hero ? <FieldView ctx={ctx} field={hero} value={doc[hero.name]} /> : null}
      {fields
        .filter((f) => f !== titleField && f !== hero)
        .map((f) => (
          <div key={f.name} className={`bones-field bones-field--${f.type}`}>
            <FieldView ctx={ctx} field={f} value={doc[f.name]} />
          </div>
        ))}
    </article>
  )
}

/** Card for collection index pages. */
export function FallbackCard({
  ctx,
  doc,
  type,
  href,
}: {
  ctx: RenderContext
  doc: Doc
  type?: ManifestType
  href: string
}) {
  const fields = type?.fields ?? []
  const imgField = fields.find((f) => f.type === 'image') ?? fields.find(isImageArray)
  const rawImg = imgField ? doc[imgField.name] : undefined
  const image = (Array.isArray(rawImg) ? rawImg[0] : rawImg) as ImageValue
  const summaryField = fields.find((f) => f.type === 'text') ?? fields.find(isPortableText)
  const rawSummary = summaryField ? doc[summaryField.name] : undefined
  const summary = typeof rawSummary === 'string' ? rawSummary : plainText(rawSummary as PtBlock[])
  const priceField = fields.find((f) => /price|cost/i.test(f.name))
  const price = priceField ? doc[priceField.name] : undefined
  return (
    <article className="bones-card">
      <a href={href} className="bones-card__link">
        <Figure ctx={ctx} image={image} width={600} />
        <h3>{titleOf(doc, type)}</h3>
      </a>
      {price != null && price !== '' ? (
        <p className="bones-price">
          {typeof price === 'number' ? formatPrice(price) : String(price)}
        </p>
      ) : null}
      {summary ? <p>{summary.length > 160 ? `${summary.slice(0, 159)}…` : summary}</p> : null}
    </article>
  )
}
