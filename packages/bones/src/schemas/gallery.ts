import {defineArrayMember, defineField, defineType} from '@sanity/types'

export const gallery = defineType({
  name: 'gallery',
  title: 'Gallery',
  type: 'object',
  description: 'A grid or strip of images with optional captions.',
  fields: [
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
      description: 'Optional heading above the gallery.',
    }),
    defineField({
      name: 'images',
      title: 'Images',
      type: 'array',
      description: 'Gallery images with alt text and optional captions.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'galleryImage',
          title: 'Gallery image',
          fields: [
            defineField({
              name: 'image',
              title: 'Image',
              type: 'image',
              description: 'The gallery image asset.',
              options: {hotspot: true},
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'alt',
              title: 'Alt text',
              type: 'string',
              description: 'Accessible description of the image.',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'caption',
              title: 'Caption',
              type: 'string',
              description: 'Optional caption shown under the image.',
            }),
          ],
          preview: {
            select: {title: 'alt', subtitle: 'caption', media: 'image'},
            prepare({title, subtitle, media}) {
              return {title: title || 'Image', subtitle, media}
            },
          },
        }),
      ],
    }),
  ],
  preview: {
    select: {title: 'heading'},
    prepare({title}) {
      return {title: title || 'Gallery', subtitle: 'Gallery'}
    },
  },
})
