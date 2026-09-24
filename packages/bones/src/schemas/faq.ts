import {defineArrayMember, defineField, defineType} from '@sanity/types'
import {portableTextMembers} from './portableText'

export const faq = defineType({
  name: 'faq',
  title: 'FAQ',
  type: 'object',
  description: 'A list of questions and answers.',
  fields: [
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
      description: 'Optional heading above the FAQ list.',
    }),
    defineField({
      name: 'items',
      title: 'Items',
      type: 'array',
      description: 'FAQ entries: question string + portable text answer.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'faqItem',
          title: 'FAQ item',
          fields: [
            defineField({
              name: 'question',
              title: 'Question',
              type: 'string',
              description: 'The question shown as the accordion/list title.',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'answer',
              title: 'Answer',
              type: 'array',
              description: 'Portable Text answer body.',
              of: portableTextMembers,
              validation: (rule) => rule.required().min(1),
            }),
          ],
          preview: {
            select: {title: 'question'},
            prepare({title}) {
              return {title: title || 'FAQ item'}
            },
          },
        }),
      ],
    }),
  ],
  preview: {
    select: {title: 'heading'},
    prepare({title}) {
      return {title: title || 'FAQ', subtitle: 'FAQ'}
    },
  },
})
