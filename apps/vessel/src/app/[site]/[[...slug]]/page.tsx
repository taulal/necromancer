/**
 * Renders a resurrected dataset. `site` → target dataset (rip-* | showcase).
 * TODO(NEC-14): fetch page by slug, render Bones blocks, fall back to the
 * schema-driven renderer for inferred types, theme from siteSettings.brand.
 */
export default async function SitePage({params}: {params: Promise<{site: string; slug?: string[]}>}) {
  const {site, slug} = await params
  return (
    <main>
      {site} / {(slug ?? []).join('/') || '(home)'}
    </main>
  )
}
