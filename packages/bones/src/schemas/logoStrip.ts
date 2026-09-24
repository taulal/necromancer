import {defineArrayMember, defineField, defineType} from 'sanity'

export const logoStrip = defineType({
  name: 'logoStrip',
  title: 'Logo strip',
  type: 'object',
  description: 'A row of partner / client / trust logos.',
  fields: [
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
      description: 'Optional heading above the logo row.',
    }),
    defineField({
      name: 'logos',
      title: 'Logos',
      type: 'array',
      description: 'Logo images with alt text.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'logo',
          title: 'Logo',
          fields: [
            defineField({
              name: 'image',
              title: 'Image',
              type: 'image',
              description: 'Logo image asset.',
              options: {hotspot: true},
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'alt',
              title: 'Alt text',
              type: 'string',
              description: 'Accessible name of the organisation the logo represents.',
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: {title: 'alt', media: 'image'},
            prepare({title, media}) {
              return {title: title || 'Logo', media}
            },
          },
        }),
      ],
    }),
  ],
  preview: {
    select: {title: 'heading'},
    prepare({title}) {
      return {title: title || 'Logo strip', subtitle: 'Logo strip'}
    },
  },
})
