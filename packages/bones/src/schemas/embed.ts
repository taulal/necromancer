import {defineField, defineType} from 'sanity'

export const embed = defineType({
  name: 'embed',
  title: 'Embed',
  type: 'object',
  description: 'An embedded map, video, or generic iframe.',
  fields: [
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      description: 'What kind of embed this is — drives Vessel rendering and a11y defaults.',
      options: {
        list: [
          {title: 'Map', value: 'map'},
          {title: 'Video', value: 'video'},
          {title: 'Iframe', value: 'iframe'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'url',
      title: 'URL',
      type: 'url',
      description: 'Embed source URL (map share link, video URL, or iframe src).',
      validation: (rule) => rule.required().uri({scheme: ['http', 'https']}),
    }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'Accessible title for the embed iframe (required for a11y).',
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {title: 'title', subtitle: 'kind'},
    prepare({title, subtitle}) {
      return {title: title || 'Embed', subtitle: subtitle || 'Embed'}
    },
  },
})
