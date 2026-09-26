import {describe, expect, test} from 'vitest'
import {atomsFromHtml, blocksFromHtml, collectImageSources, resolveImageSources} from './dissect'
import {toPlainText} from './portableText'

const PAGE = `<html><body>
<header><nav><a href="/">Home</a><a href="/about/">About</a></nav><img src="/logo.png" width="93"></header>
<main>
  <h1>Bespoke cakes</h1>
  <p>Baked in <a href="https://caz.test/shop/">our shop</a> every morning.</p>
  <img src="/hero.jpg" alt="Cake stand">
  <h2>What we make</h2>
  <p>Brownies, bakes and celebration cakes.</p>
  <ul><li>Vegan</li><li>Gluten free</li></ul>
  <h2>Gallery</h2>
  <img src="/g1.jpg"><img src="/g2.jpg"><img src="/g3.jpg">
  <h2>FAQ</h2>
  <h3>Do you deliver?</h3><p>Yes, to L22 and L23.</p>
  <h3>Can I collect?</h3><p>Click and collect is free.</p>
</main>
<footer>© Caz</footer>
</body></html>`

describe('blocksFromHtml', () => {
  const blocks = blocksFromHtml(PAGE, 'https://caz.test/cakes/')

  test('strips chrome and maps sections to Bones blocks in order', () => {
    expect(blocks.map((b) => b._type)).toEqual(['hero', 'richText', 'gallery', 'faq'])
    const text = JSON.stringify(blocks)
    expect(text).not.toContain('logo.png')
    expect(text).not.toContain('© Caz')
  })

  test('hero takes the h1, first paragraph and first image', () => {
    const hero = blocks[0]!
    expect(hero.heading).toBe('Bespoke cakes')
    expect(hero.subheading).toBe('Baked in our shop every morning.')
    expect(hero.image).toEqual({
      _type: 'image',
      _sourceUrl: 'https://caz.test/hero.jpg',
      alt: 'Cake stand',
    })
  })

  test('rich text keeps headings, paragraphs and lists as Portable Text', () => {
    const body = blocks[1]!.body as Array<{style: string; listItem?: string}>
    expect(body[0]!.style).toBe('h2')
    expect(body.filter((b) => b.listItem === 'bullet')).toHaveLength(2)
    expect(toPlainText(body as never)).toContain('Brownies, bakes and celebration cakes.')
  })

  test('faq pairs h3 questions with their answers', () => {
    const faq = blocks[3]!
    expect((faq.items as Array<{question: string}>).map((i) => i.question)).toEqual([
      'Do you deliver?',
      'Can I collect?',
    ])
  })

  test('deterministic: same input, same keys', () => {
    expect(blocksFromHtml(PAGE, 'https://caz.test/cakes/')).toEqual(blocks)
  })
})

describe('links and images', () => {
  test('same-site links become paths so 301s can re-map them', () => {
    const atoms = atomsFromHtml(PAGE, 'https://caz.test/cakes/')
    const para = atoms.find((a) => a.t === 'para')
    expect(para && para.t === 'para' && para.inlines.find((i) => i.href)?.href).toBe('/shop/')
  })

  test('image placeholders resolve to asset refs; failed uploads are dropped', () => {
    const blocks = blocksFromHtml(PAGE, 'https://caz.test/cakes/')
    const sources = collectImageSources(blocks)
    expect(sources.size).toBe(4)
    const resolved = resolveImageSources(
      blocks,
      new Map([['https://caz.test/hero.jpg', 'image-abc-10x10-jpg']]),
    )
    expect((resolved[0]!.image as {asset: {_ref: string}}).asset._ref).toBe('image-abc-10x10-jpg')
    expect(JSON.stringify(resolved)).not.toContain('_sourceUrl')
  })
})
