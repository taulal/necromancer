import {defineField, defineType} from '@sanity/types'

export const cta = defineType({
  name: 'cta',
  title: 'CTA',
  type: 'object',
  description: 'A call-to-action band: heading, optional body, and a required button link.',
  fields: [
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
      description: 'Primary CTA headline.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'text',
      rows: 3,
      description: 'Optional supporting copy under the heading.',
    }),
    defineField({
      name: 'button',
      title: 'Button',
      type: 'link',
      description: 'Required button link (label + href or internal page).',
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {title: 'heading'},
    prepare({title}) {
      return {title: title || 'CTA', subtitle: 'CTA'}
    },
  },
})
