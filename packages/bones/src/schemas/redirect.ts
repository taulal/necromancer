import {defineField, defineType} from 'sanity'

/**
 * Redirect ledger entry for Vessel 301 middleware.
 */
export const redirect = defineType({
  name: 'redirect',
  title: 'Redirect',
  type: 'document',
  description: 'Maps an old URL path to a new one. Vessel serves these as 301s.',
  fields: [
    defineField({
      name: 'from',
      title: 'From',
      type: 'string',
      description: 'Old path or URL path segment to match (e.g. /old-page.php).',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'to',
      title: 'To',
      type: 'string',
      description: 'New path or absolute URL to send the visitor to.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'statusCode',
      title: 'Status code',
      type: 'number',
      description: 'HTTP status for the redirect. Default 301.',
      initialValue: 301,
      validation: (rule) => rule.min(301).max(308),
    }),
  ],
  preview: {
    select: {title: 'from', subtitle: 'to'},
    prepare({title, subtitle}) {
      return {title: title || 'Redirect', subtitle}
    },
  },
})
