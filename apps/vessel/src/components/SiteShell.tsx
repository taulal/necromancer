import type {CSSProperties, ReactNode} from 'react'
import {imageUrl, type RenderContext, type SiteSettings} from '@necro/bones/render'
import type {NavItem} from '../lib/site'

/** The corpse keeps its face: brand colours and fonts become CSS variables. */
function brandVars(settings: SiteSettings): CSSProperties {
  const b = settings.brand ?? {}
  const vars: Record<string, string> = {}
  if (b.primaryColor) vars['--brand-primary'] = b.primaryColor
  if (b.secondaryColor) vars['--brand-secondary'] = b.secondaryColor
  if (b.fontHeading) vars['--font-heading'] = b.fontHeading
  if (b.fontBody) vars['--font-body'] = b.fontBody
  return vars as CSSProperties
}

export function SiteShell({
  ctx,
  settings,
  nav,
  releaseId,
  children,
}: {
  ctx: RenderContext
  settings: SiteSettings
  nav: NavItem[]
  releaseId?: string
  children: ReactNode
}) {
  const logo = imageUrl(ctx, settings.brand?.logo, 320)
  const title = settings.siteTitle ?? 'Resurrected site'
  return (
    <div className="site" style={brandVars(settings)}>
      {releaseId ? (
        <p className="site-preview" role="status">
          Previewing release <code>{releaseId}</code>. Nothing here is live until it rises.
        </p>
      ) : null}
      <header className="site-header">
        <a className="site-brand" href={ctx.href('/')}>
          {logo ? <img src={logo} alt={title} /> : <span>{title}</span>}
        </a>
        <nav aria-label="Main">
          <ul>
            {nav.map((item) => (
              <li key={item.path}>
                <a href={ctx.href(item.path)}>{item.title}</a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="site-main">{children}</main>
      <footer className="site-footer">
        <div>
          <strong>{title}</strong>
          {settings.address ? <p>{settings.address}</p> : null}
          <p>
            {settings.phone ? (
              <a href={`tel:${settings.phone.replace(/[^+\d]/g, '')}`}>{settings.phone}</a>
            ) : null}
            {settings.phone && settings.email ? ' · ' : null}
            {settings.email ? <a href={`mailto:${settings.email}`}>{settings.email}</a> : null}
          </p>
        </div>
        <p className="site-credit">Resurrected with Necromancer on Sanity.</p>
      </footer>
    </div>
  )
}
