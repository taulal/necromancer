import {defineField, defineType} from '@sanity/types'

/**
 * Singleton stub for site-wide facts and brand. contactBlock reads contact fields from here.
 */
export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Site settings',
  type: 'document',
  description:
    'Singleton: brand tokens and site-wide contact facts. Blocks reference these; they are never copied into page copy.',
  fields: [
    defineField({
      name: 'siteTitle',
      title: 'Site title',
      type: 'string',
      description: 'Public site name.',
    }),
    defineField({
      name: 'brand',
      title: 'Brand',
      type: 'object',
      description: 'Visual identity fed to the Vessel as CSS variables (corpse keeps its face).',
      fields: [
        defineField({
          name: 'primaryColor',
          title: 'Primary colour',
          type: 'string',
          description: 'Primary brand colour (CSS colour string).',
        }),
        defineField({
          name: 'secondaryColor',
          title: 'Secondary colour',
          type: 'string',
          description: 'Secondary brand colour (CSS colour string).',
        }),
        defineField({
          name: 'fontHeading',
          title: 'Heading font',
          type: 'string',
          description: 'CSS font-family for headings.',
        }),
        defineField({
          name: 'fontBody',
          title: 'Body font',
          type: 'string',
          description: 'CSS font-family for body text.',
        }),
        defineField({
          name: 'logo',
          title: 'Logo',
          type: 'image',
          description: 'Site logo asset.',
          options: {hotspot: true},
        }),
      ],
    }),
    defineField({
      name: 'phone',
      title: 'Phone',
      type: 'string',
      description: 'Primary phone number. contactBlock reads this; do not duplicate on pages.',
    }),
    defineField({
      name: 'email',
      title: 'Email',
      type: 'string',
      description: 'Primary contact email. contactBlock reads this; do not duplicate on pages.',
      validation: (rule) => rule.email(),
    }),
    defineField({
      name: 'address',
      title: 'Address',
      type: 'text',
      rows: 3,
      description: 'Postal / street address. contactBlock reads this; do not duplicate on pages.',
    }),
    defineField({
      name: 'openingHours',
      title: 'Opening hours',
      type: 'text',
      rows: 3,
      description: 'Opening hours text. contactBlock reads this; do not duplicate on pages.',
    }),
  ],
  preview: {
    select: {title: 'siteTitle'},
    prepare({title}) {
      return {title: title || 'Site settings'}
    },
  },
})
