import {defineField, defineType} from '@sanity/types'

/**
 * Reusable testimonial document. Named `testimonialDoc` so it does not collide with the
 * Bones `testimonial` block object (Sanity type names are a single namespace).
 */
export const testimonialDoc = defineType({
  name: 'testimonialDoc',
  title: 'Testimonial',
  type: 'document',
  description: 'A reusable quote with attribution. Referenced from testimonial blocks.',
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
        title: title || 'Testimonial',
        subtitle: subtitle ? String(subtitle).slice(0, 60) : undefined,
      }
    },
  },
})
