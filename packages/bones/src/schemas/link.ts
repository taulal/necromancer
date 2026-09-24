import {defineField, defineType} from 'sanity'

/**
 * Shared link object: exactly one of external `href` or internal `page` ref.
 */
export const link = defineType({
  name: 'link',
  title: 'Link',
  type: 'object',
  description:
    'A labelled link to an external URL or an internal page. Provide exactly one target.',
  fields: [
    defineField({
      name: 'label',
      title: 'Label',
      type: 'string',
      description: 'Visible link text shown to the visitor.',
    }),
    defineField({
      name: 'href',
      title: 'External URL',
      type: 'url',
      description: 'Absolute http(s) URL. Mutually exclusive with internal.',
      validation: (rule) => rule.uri({scheme: ['http', 'https']}),
    }),
    defineField({
      name: 'internal',
      title: 'Internal page',
      type: 'reference',
      to: [{type: 'page'}],
      description: 'Reference to a page document. Mutually exclusive with href.',
    }),
  ],
  validation: (rule) =>
    rule.custom((value) => {
      if (!value || typeof value !== 'object') return true
      const hasHref = typeof (value as {href?: unknown}).href === 'string'
      const hasInternal = Boolean((value as {internal?: {_ref?: string}}).internal?._ref)
      if (hasHref === hasInternal) {
        return 'Provide exactly one of href (external) or internal (page ref)'
      }
      return true
    }),
  preview: {
    select: {title: 'label', href: 'href'},
    prepare({title, href}) {
      return {
        title: title || 'Link',
        subtitle: href || 'Internal page',
      }
    },
  },
})
