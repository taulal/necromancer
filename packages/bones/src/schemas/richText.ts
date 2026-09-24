import {defineField, defineType} from '@sanity/types'
import {portableTextMembers} from './portableText'

export const richText = defineType({
  name: 'richText',
  title: 'Rich text',
  type: 'object',
  description: 'A free-form prose section: headings, paragraphs, lists.',
  fields: [
    defineField({
      name: 'body',
      title: 'Body',
      type: 'array',
      description: 'Portable Text body for the section.',
      of: portableTextMembers,
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    prepare() {
      return {title: 'Rich text', subtitle: 'Rich text'}
    },
  },
})
