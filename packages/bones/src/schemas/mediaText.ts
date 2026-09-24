import {defineField, defineType} from '@sanity/types'
import {portableTextMembers} from './portableText'

export const mediaText = defineType({
  name: 'mediaText',
  title: 'Media + text',
  type: 'object',
  description: 'Two-column band: image beside a heading and rich text body.',
  fields: [
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
      description: 'Optional section heading above or beside the body.',
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'array',
      description: 'Portable Text copy for the text column.',
      of: portableTextMembers,
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      description: 'Required image for the media column.',
      options: {hotspot: true},
      fields: [
        defineField({
          name: 'alt',
          title: 'Alt text',
          type: 'string',
          description: 'Accessible description of the image.',
        }),
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'imageSide',
      title: 'Image side',
      type: 'string',
      description: 'Which side the image sits on in a two-column layout.',
      options: {
        list: [
          {title: 'Left', value: 'left'},
          {title: 'Right', value: 'right'},
        ],
        layout: 'radio',
      },
      initialValue: 'left',
    }),
  ],
  preview: {
    select: {title: 'heading', media: 'image'},
    prepare({title, media}) {
      return {title: title || 'Media + text', subtitle: 'Media + text', media}
    },
  },
})
