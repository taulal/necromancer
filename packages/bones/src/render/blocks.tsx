/**
 * Bones block renderers. Deliberately plain markup with `bones-*` class names; all
 * visual identity comes from CSS variables set from siteSettings.brand by the host,
 * so each resurrected site keeps its own face.
 */
import type {ReactNode} from 'react'
import {imageSize, imageUrl, linkHref, type ImageValue, type RenderContext} from './context'
import {PortableText, type PtBlock} from './PortableText'

export type SiteSettings = {
  siteTitle?: string
  phone?: string
  email?: string
  address?: string
  openingHours?: string
  brand?: {
    primaryColor?: string
    secondaryColor?: string
    fontHeading?: string
    fontBody?: string
    logo?: ImageValue
  }
}

type LinkValue = {label?: string; href?: string; internal?: {slug?: string}} | null | undefined
type Block = {_key?: string; _type: string; [field: string]: unknown}

export function Figure({
  ctx,
  image,
  alt,
  width = 1200,
  caption,
}: {
  ctx: RenderContext
  image: ImageValue
  alt?: string
  width?: number
  caption?: string
}) {
  const src = imageUrl(ctx, image, width)
  if (!src) return null
  const size = imageSize(image)
  return (
    <figure className="bones-figure">
      <img
        src={src}
        alt={alt ?? image?.alt ?? ''}
        loading="lazy"
        {...(size ? {width: size.width, height: size.height} : {})}
      />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  )
}

function Cta({ctx, link, primary}: {ctx: RenderContext; link: LinkValue; primary?: boolean}) {
  const href = link?.internal?.slug ? ctx.href(`/${link.internal.slug}`) : linkHref(ctx, link?.href)
  if (!href || !link?.label) return null
  return (
    <a className={primary ? 'bones-button' : 'bones-button bones-button--ghost'} href={href}>
      {link.label}
    </a>
  )
}

const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
const arr = <T,>(v: unknown) => (Array.isArray(v) ? (v as T[]) : [])

function renderBlock(ctx: RenderContext, block: Block, settings: SiteSettings): ReactNode {
  switch (block._type) {
    case 'hero':
      return (
        <section className="bones-hero">
          <div className="bones-hero__text">
            <h1>{str(block.heading)}</h1>
            {str(block.subheading) ? <p className="bones-lede">{str(block.subheading)}</p> : null}
            <div className="bones-actions">
              <Cta ctx={ctx} link={block.primaryCta as LinkValue} primary />
              <Cta ctx={ctx} link={block.secondaryCta as LinkValue} />
            </div>
          </div>
          <Figure ctx={ctx} image={block.image as ImageValue} width={1400} />
        </section>
      )
    case 'richText':
      return (
        <section className="bones-rich">
          <PortableText ctx={ctx} value={block.body as PtBlock[]} />
        </section>
      )
    case 'mediaText':
      return (
        <section
          className={`bones-media bones-media--${str(block.imageSide) === 'left' ? 'left' : 'right'}`}
        >
          <div className="bones-media__text">
            {str(block.heading) ? <h2>{str(block.heading)}</h2> : null}
            <PortableText ctx={ctx} value={block.body as PtBlock[]} />
          </div>
          <Figure ctx={ctx} image={block.image as ImageValue} width={900} />
        </section>
      )
    case 'cardGrid':
      return (
        <section className="bones-cards">
          {str(block.heading) ? <h2>{str(block.heading)}</h2> : null}
          {str(block.intro) ? <p className="bones-lede">{str(block.intro)}</p> : null}
          <div className="bones-grid">
            {arr<{
              _key?: string
              title?: string
              body?: string
              image?: ImageValue
              link?: LinkValue
            }>(block.cards).map((card, i) => (
              <article className="bones-card" key={card._key ?? i}>
                <Figure ctx={ctx} image={card.image} width={600} />
                {card.title ? <h3>{card.title}</h3> : null}
                {card.body ? <p>{card.body}</p> : null}
                <Cta ctx={ctx} link={card.link} />
              </article>
            ))}
          </div>
        </section>
      )
    case 'gallery':
      return (
        <section className="bones-gallery">
          {str(block.heading) ? <h2>{str(block.heading)}</h2> : null}
          <div className="bones-grid bones-grid--tight">
            {arr<{_key?: string; image?: ImageValue; alt?: string; caption?: string}>(
              block.images,
            ).map((item, i) => (
              <Figure
                key={item._key ?? i}
                ctx={ctx}
                image={item.image}
                alt={item.alt}
                caption={item.caption}
                width={700}
              />
            ))}
          </div>
        </section>
      )
    case 'testimonial':
      return (
        <section className="bones-quotes">
          {arr<{_key?: string; quote?: string; name?: string; detail?: string}>(block.items).map(
            (item, i) =>
              item.quote ? (
                <blockquote className="bones-quote" key={item._key ?? i}>
                  <p>“{item.quote}”</p>
                  {item.name ? (
                    <footer>
                      {item.name}
                      {item.detail ? `, ${item.detail}` : ''}
                    </footer>
                  ) : null}
                </blockquote>
              ) : null,
          )}
        </section>
      )
    case 'faq':
      return (
        <section className="bones-faq">
          {str(block.heading) ? <h2>{str(block.heading)}</h2> : null}
          {arr<{_key?: string; question?: string; answer?: PtBlock[]}>(block.items).map(
            (item, i) => (
              <details key={item._key ?? i}>
                <summary>{item.question}</summary>
                <PortableText ctx={ctx} value={item.answer} />
              </details>
            ),
          )}
        </section>
      )
    case 'cta':
      return (
        <section className="bones-cta">
          {str(block.heading) ? <h2>{str(block.heading)}</h2> : null}
          {str(block.body) ? <p>{str(block.body)}</p> : null}
          <Cta ctx={ctx} link={block.button as LinkValue} primary />
        </section>
      )
    case 'contactBlock':
      return (
        <section className="bones-contact">
          {str(block.heading) ? <h2>{str(block.heading)}</h2> : null}
          {str(block.intro) ? <p>{str(block.intro)}</p> : null}
          <dl>
            {settings.phone ? (
              <>
                <dt>Phone</dt>
                <dd>
                  <a href={`tel:${settings.phone.replace(/[^+\d]/g, '')}`}>{settings.phone}</a>
                </dd>
              </>
            ) : null}
            {settings.email ? (
              <>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${settings.email}`}>{settings.email}</a>
                </dd>
              </>
            ) : null}
            {settings.address ? (
              <>
                <dt>Address</dt>
                <dd>{settings.address}</dd>
              </>
            ) : null}
            {settings.openingHours ? (
              <>
                <dt>Hours</dt>
                <dd>{settings.openingHours}</dd>
              </>
            ) : null}
          </dl>
        </section>
      )
    case 'logoStrip':
      return (
        <section className="bones-logos">
          {str(block.heading) ? <h2>{str(block.heading)}</h2> : null}
          <div className="bones-logos__row">
            {arr<{_key?: string; image?: ImageValue; alt?: string}>(block.logos).map((l, i) => (
              <Figure key={l._key ?? i} ctx={ctx} image={l.image} alt={l.alt} width={240} />
            ))}
          </div>
        </section>
      )
    case 'stats':
      return (
        <section className="bones-stats">
          {arr<{_key?: string; value?: string; label?: string}>(block.items).map((s, i) => (
            <div key={s._key ?? i}>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </section>
      )
    case 'embed': {
      const url = str(block.url)
      if (!url) return null
      return (
        <section className="bones-embed">
          <iframe src={url} title={str(block.title) ?? 'Embedded content'} loading="lazy" />
        </section>
      )
    }
    default:
      return null
  }
}

/** A page's `body[]` of Bones blocks. Unknown block types render nothing. */
export function BonesBody({
  ctx,
  body,
  settings = {},
}: {
  ctx: RenderContext
  body?: Block[] | null
  settings?: SiteSettings
}) {
  return (
    <>
      {(body ?? []).map((block, i) => (
        <div key={block._key ?? i}>{renderBlock(ctx, block, settings)}</div>
      ))}
    </>
  )
}
