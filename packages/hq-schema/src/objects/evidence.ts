import {defineArrayMember, defineField} from '@sanity/types'

/** Shared: every claim about the dead site carries a page + quote. */
export const evidenceFields = [
  defineField({
    name: 'page',
    title: 'Page',
    type: 'reference',
    to: [{type: 'exhumedPage'}],
    description: 'The exhumed page this evidence was taken from.',
    validation: (rule) => rule.required(),
  }),
  defineField({
    name: 'quote',
    title: 'Quote',
    type: 'text',
    rows: 3,
    description: 'Verbatim excerpt from the page that supports the claim.',
    validation: (rule) => rule.required().min(1),
  }),
  defineField({
    name: 'url',
    title: 'Source URL',
    type: 'url',
    description: 'Canonical URL of the source page (for opening the old site).',
    validation: (rule) => rule.uri({scheme: ['http', 'https']}),
  }),
]

export const evidenceObject = defineField({
  name: 'evidence',
  title: 'Evidence',
  type: 'array',
  description: 'Page references and quotes that back this claim.',
  of: [
    defineArrayMember({
      type: 'object',
      name: 'evidenceItem',
      title: 'Evidence item',
      fields: evidenceFields,
      preview: {
        select: {title: 'quote', subtitle: 'url'},
        prepare({title, subtitle}) {
          return {
            title: title ? String(title).slice(0, 80) : 'Evidence',
            subtitle,
          }
        },
      },
    }),
  ],
})
