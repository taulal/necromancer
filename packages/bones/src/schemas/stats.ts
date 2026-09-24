import {defineArrayMember, defineField, defineType} from '@sanity/types'

export const stats = defineType({
  name: 'stats',
  title: 'Stats',
  type: 'object',
  description: 'A row of key numbers with short labels.',
  fields: [
    defineField({
      name: 'items',
      title: 'Items',
      type: 'array',
      description: 'Stat entries: a display value and a label.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'statItem',
          title: 'Stat',
          fields: [
            defineField({
              name: 'value',
              title: 'Value',
              type: 'string',
              description: 'The number or figure as display text (e.g. "50+", "1,200").',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'label',
              title: 'Label',
              type: 'string',
              description: 'Short label under the value (e.g. "Projects completed").',
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: {title: 'value', subtitle: 'label'},
            prepare({title, subtitle}) {
              return {title: title || 'Stat', subtitle}
            },
          },
        }),
      ],
    }),
  ],
  preview: {
    prepare() {
      return {title: 'Stats', subtitle: 'Stats'}
    },
  },
})
