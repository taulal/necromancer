import {defineField, defineType} from '@sanity/types'

export const hero = defineType({
  name: 'hero',
  title: 'Hero',
  type: 'object',
  description: 'First full-width band of a page: headline, optional support line, image, and CTAs.',
  fields: [
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
      description: 'Primary headline for the hero band.',
      validation: (rule) => rule.required().max(90),
    }),
    defineField({
      name: 'subheading',
      title: 'Subheading',
      type: 'text',
      rows: 3,
      description: 'Optional supporting line under the heading.',
      validation: (rule) => rule.max(240),
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      description: 'Optional hero image. Alt is required when an image is set.',
      options: {hotspot: true},
      fields: [
        defineField({
          name: 'alt',
          title: 'Alt text',
          type: 'string',
          description: 'Accessible description of the image. Required when an image asset is set.',
          validation: (rule) =>
            rule.custom((alt, context) => {
              const parent = context.parent as {asset?: {_ref?: string}} | undefined
              if (parent?.asset?._ref && !alt) {
                return 'Alt text is required when an image is set'
              }
              return true
            }),
        }),
      ],
    }),
    defineField({
      name: 'primaryCta',
      title: 'Primary CTA',
      type: 'link',
      description: 'Primary call-to-action button (label + href or internal page).',
    }),
    defineField({
      name: 'secondaryCta',
      title: 'Secondary CTA',
      type: 'link',
      description: 'Optional secondary call-to-action beside the primary.',
    }),
  ],
  preview: {
    select: {title: 'heading', media: 'image'},
    prepare({title, media}) {
      return {title: title || 'Hero', subtitle: 'Hero', media}
    },
  },
})
