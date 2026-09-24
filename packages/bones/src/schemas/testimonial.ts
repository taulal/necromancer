import {defineArrayMember, defineField, defineType} from '@sanity/types'

/**
 * Testimonial band. Items may be refs to `testimonialDoc` documents or inline quotes.
 * Document type is `testimonialDoc` (not `testimonial`) because Sanity type names are global
 * and `testimonial` is reserved for this Bones block object.
 */
export const testimonial = defineType({
  name: 'testimonial',
  title: 'Testimonial',
  type: 'object',
  description: 'A band of quotes: reusable testimonial docs and/or one-off inline quotes.',
  fields: [
    defineField({
      name: 'items',
      title: 'Items',
      type: 'array',
      description:
        'Mix of references to testimonialDoc documents and inline {quote, name, detail} objects.',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{type: 'testimonialDoc'}],
        }),
        defineArrayMember({
          type: 'object',
          name: 'inlineTestimonial',
          title: 'Inline testimonial',
          fields: [
            defineField({
              name: 'quote',
              title: 'Quote',
              type: 'text',
              rows: 4,
              description: 'The quote text.',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'name',
              title: 'Name',
              type: 'string',
              description: 'Attribution name (person or organisation).',
            }),
            defineField({
              name: 'detail',
              title: 'Detail',
              type: 'string',
              description: 'Optional role, company, or location under the name.',
            }),
          ],
          preview: {
            select: {title: 'name', subtitle: 'quote'},
            prepare({title, subtitle}) {
              return {
                title: title || 'Quote',
                subtitle: subtitle ? String(subtitle).slice(0, 60) : undefined,
              }
            },
          },
        }),
      ],
    }),
  ],
  preview: {
    prepare() {
      return {title: 'Testimonial', subtitle: 'Testimonial'}
    },
  },
})
