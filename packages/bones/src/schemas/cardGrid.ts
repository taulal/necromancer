import {defineArrayMember, defineField, defineType} from 'sanity'

export const cardGrid = defineType({
  name: 'cardGrid',
  title: 'Card grid',
  type: 'object',
  description:
    'A grid of cards. Use inline `cards` for one-off content, or `items` refs to a collection type (Autopsy sets the target type per site).',
  fields: [
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
      description: 'Optional heading above the card grid.',
    }),
    defineField({
      name: 'intro',
      title: 'Intro',
      type: 'text',
      rows: 3,
      description: 'Optional short intro under the heading.',
    }),
    defineField({
      name: 'cards',
      title: 'Cards',
      type: 'array',
      description:
        'Inline cards unique to this page. Mutually exclusive with items — use one or the other.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'card',
          title: 'Card',
          fields: [
            defineField({
              name: 'title',
              title: 'Title',
              type: 'string',
              description: 'Card title.',
            }),
            defineField({
              name: 'body',
              title: 'Body',
              type: 'text',
              rows: 4,
              description: 'Short card body copy.',
            }),
            defineField({
              name: 'image',
              title: 'Image',
              type: 'image',
              description: 'Optional card image.',
              options: {hotspot: true},
              fields: [
                defineField({
                  name: 'alt',
                  title: 'Alt text',
                  type: 'string',
                  description: 'Accessible description of the card image.',
                }),
              ],
            }),
            defineField({
              name: 'link',
              title: 'Link',
              type: 'link',
              description: 'Optional link for the whole card or a CTA on it.',
            }),
          ],
          preview: {
            select: {title: 'title', media: 'image'},
            prepare({title, media}) {
              return {title: title || 'Card', media}
            },
          },
        }),
      ],
    }),
    defineField({
      name: 'items',
      title: 'Items',
      type: 'array',
      description:
        'References to a collection type. Placeholder target is page; Autopsy rewrites `to` to the proposed collection per site. Mutually exclusive with cards.',
      of: [
        defineArrayMember({
          type: 'reference',
          // Placeholder until Autopsy sets the collection type for this site.
          to: [{type: 'page'}],
        }),
      ],
    }),
  ],
  validation: (rule) =>
    rule.custom((value) => {
      if (!value || typeof value !== 'object') return true
      const cards = (value as {cards?: unknown[]}).cards
      const items = (value as {items?: unknown[]}).items
      const hasCards = Array.isArray(cards) && cards.length > 0
      const hasItems = Array.isArray(items) && items.length > 0
      if (hasCards && hasItems) {
        return 'Use either cards (inline) or items (refs), not both'
      }
      return true
    }),
  preview: {
    select: {title: 'heading'},
    prepare({title}) {
      return {title: title || 'Card grid', subtitle: 'Card grid'}
    },
  },
})
