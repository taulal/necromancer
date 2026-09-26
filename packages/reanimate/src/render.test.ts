import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {describe, expect, test} from 'vitest'
import {BonesBody, FallbackDoc, type RenderContext} from '@necro/bones/render'
import {blocksFromHtml, collectImageSources, resolveImageSources} from './dissect'

const ctx: RenderContext = {
  projectId: 'v9dl2xdi',
  dataset: 'showcase',
  href: (p) => `/showcase${p}`,
}

const PAGE = `<main>
  <h1>Bespoke cakes</h1><p>Baked daily in Waterloo.</p><img src="/hero.jpg" alt="Cake stand">
  <h2>What we make</h2><p>Brownies and bakes, all in <a href="https://caz.test/shop/">our shop</a>.</p><ul><li>Vegan</li><li>Gluten free</li></ul>
  <h2>FAQ</h2><h3>Do you deliver?</h3><p>Yes, to L22.</p>
</main>`

describe('Bones renderers on reanimated output', () => {
  const raw = blocksFromHtml(PAGE, 'https://caz.test/cakes/')
  const assets = new Map(
    [...collectImageSources(raw)].map((src) => [src, 'image-abc123-1200x800-jpg']),
  )
  const html = renderToStaticMarkup(
    createElement(BonesBody, {ctx, body: resolveImageSources(raw, assets)}),
  )

  test('hero, prose, lists and faq render as semantic HTML', () => {
    expect(html).toContain('<h1>Bespoke cakes</h1>')
    expect(html).toContain('<li><span>Vegan</span></li>')
    expect(html).toContain('<summary>Do you deliver?</summary>')
  })

  test('images come from the CDN with alt and size; site links go through the Vessel', () => {
    expect(html).toContain(
      'https://cdn.sanity.io/images/v9dl2xdi/showcase/abc123-1200x800.jpg?w=1400',
    )
    expect(html).toContain('alt="Cake stand"')
    expect(html).toContain('href="/showcase/shop/"')
  })

  test('fallback renders a collection doc from its manifest', () => {
    const out = renderToStaticMarkup(
      createElement(FallbackDoc, {
        ctx,
        doc: {
          _id: 'product-brownie',
          _type: 'product',
          name: 'Brownie',
          price: 18,
          description: 'Rich and fudgy.',
        },
        type: {
          name: 'product',
          type: 'document',
          title: 'Product',
          fields: [
            {name: 'name', type: 'string'},
            {name: 'price', type: 'number'},
            {name: 'description', type: 'text'},
          ],
        },
      }),
    )
    expect(out).toContain('<h1>Brownie</h1>')
    expect(out).toContain('18.00')
    expect(out).toContain('Rich and fudgy.')
  })
})
