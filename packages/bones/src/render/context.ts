/**
 * What a renderer needs from its host (the Vessel): where images live and how to
 * turn a site path ("/about") into a Vessel href ("/showcase/about?perspective=…").
 */
export type RenderContext = {
  projectId: string
  dataset: string
  /** Map a site path to a Vessel href. External URLs pass through untouched. */
  href: (path: string) => string
}

export type ImageValue = {asset?: {_ref?: string}; alt?: string} | null | undefined

/** `image-<hash>-<w>x<h>-<ext>` → CDN URL, optionally resized. */
export function imageUrl(
  ctx: RenderContext,
  image: ImageValue,
  width?: number,
): string | undefined {
  const ref = image?.asset?._ref
  const m = ref?.match(/^image-([a-f0-9]+)-(\d+x\d+)-(\w+)$/)
  if (!m) return undefined
  const base = `https://cdn.sanity.io/images/${ctx.projectId}/${ctx.dataset}/${m[1]}-${m[2]}.${m[3]}`
  return width ? `${base}?w=${width}&auto=format&fit=max` : base
}

export function imageSize(image: ImageValue): {width: number; height: number} | undefined {
  const m = image?.asset?._ref?.match(/-(\d+)x(\d+)-\w+$/)
  return m ? {width: Number(m[1]), height: Number(m[2])} : undefined
}

export function linkHref(ctx: RenderContext, href: string | undefined): string | undefined {
  if (!href) return undefined
  if (href.startsWith('/')) return ctx.href(href)
  return href
}
