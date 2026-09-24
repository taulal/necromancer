import {DocumentIcon} from '@sanity/icons/Document'
import {defineArrayMember, defineField, defineType} from '@sanity/types'

/**
 * Raw evidence for one crawled URL (BRIEF.md §6). HTML is cached so reruns skip refetch.
 */
export const exhumedPage = defineType({
  name: 'exhumedPage',
  title: 'Exhumed page',
  type: 'document',
  icon: DocumentIcon,
  description: 'One page pulled from the dead site: structure, entities, and cached HTML.',
  fields: [
    defineField({
      name: 'seance',
      title: 'Séance',
      type: 'reference',
      to: [{type: 'seance'}],
      description: 'The resurrection attempt this page belongs to.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'url',
      title: 'URL',
      type: 'url',
      description: 'Absolute URL that was fetched.',
      validation: (rule) => rule.required().uri({scheme: ['http', 'https']}),
    }),
    defineField({
      name: 'path',
      title: 'Path',
      type: 'string',
      description: 'URL pathname used for redirect mapping and Vessel routes.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'httpStatus',
      title: 'HTTP status',
      type: 'number',
      description: 'Response status code from the crawl.',
      validation: (rule) => rule.required().integer().min(100).max(599),
    }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'Document title from <title> or h1.',
    }),
    defineField({
      name: 'meta',
      title: 'Meta',
      type: 'object',
      description: 'Common meta tags used for SEO tasks and brand guesses.',
      fields: [
        defineField({
          name: 'description',
          title: 'Description',
          type: 'text',
          rows: 2,
          description: 'meta description, if present.',
        }),
        defineField({
          name: 'ogImage',
          title: 'OG image',
          type: 'url',
          description: 'og:image URL.',
          validation: (rule) => rule.uri({scheme: ['http', 'https']}),
        }),
        defineField({
          name: 'canonical',
          title: 'Canonical',
          type: 'url',
          description: 'link[rel=canonical] href.',
          validation: (rule) => rule.uri({scheme: ['http', 'https']}),
        }),
      ],
    }),
    defineField({
      name: 'headings',
      title: 'Headings',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      description: 'h1–h3 text in document order.',
    }),
    defineField({
      name: 'sections',
      title: 'Sections',
      type: 'array',
      description: 'Content chunks after chrome stripping, with a guessed kind.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'exhumedSection',
          fields: [
            defineField({
              name: 'kind',
              title: 'Kind guess',
              type: 'string',
              description: 'Heuristic section kind (hero, faq, contact, prose, …).',
            }),
            defineField({
              name: 'html',
              title: 'HTML excerpt',
              type: 'text',
              rows: 4,
              description: 'Sanitised HTML snippet for this section.',
            }),
            defineField({
              name: 'text',
              title: 'Text',
              type: 'text',
              rows: 4,
              description: 'Plain-text extraction for AI / entity passes.',
            }),
          ],
          preview: {
            select: {title: 'kind', subtitle: 'text'},
            prepare({title, subtitle}) {
              return {
                title: title || 'section',
                subtitle: subtitle ? String(subtitle).slice(0, 60) : undefined,
              }
            },
          },
        }),
      ],
    }),
    defineField({
      name: 'images',
      title: 'Images',
      type: 'array',
      description: 'Images discovered on the page (for asset upload + alt tasks).',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'exhumedImage',
          fields: [
            defineField({
              name: 'src',
              title: 'Src',
              type: 'url',
              validation: (rule) => rule.required().uri({scheme: ['http', 'https']}),
            }),
            defineField({name: 'alt', title: 'Alt', type: 'string'}),
            defineField({
              name: 'width',
              title: 'Width',
              type: 'number',
              validation: (rule) => rule.integer().min(0),
            }),
            defineField({
              name: 'height',
              title: 'Height',
              type: 'number',
              validation: (rule) => rule.integer().min(0),
            }),
          ],
          preview: {
            select: {title: 'alt', subtitle: 'src'},
          },
        }),
      ],
    }),
    defineField({
      name: 'links',
      title: 'Links',
      type: 'array',
      of: [defineArrayMember({type: 'url'})],
      description: 'Outbound hrefs collected for crawl frontier and redirect ledger.',
    }),
    defineField({
      name: 'detectedEntities',
      title: 'Detected entities',
      type: 'object',
      description: 'Phones, emails, addresses and prices found on this page.',
      fields: [
        defineField({
          name: 'phones',
          title: 'Phones',
          type: 'array',
          of: [defineArrayMember({type: 'string'})],
        }),
        defineField({
          name: 'emails',
          title: 'Emails',
          type: 'array',
          of: [defineArrayMember({type: 'string'})],
        }),
        defineField({
          name: 'addresses',
          title: 'Addresses',
          type: 'array',
          of: [defineArrayMember({type: 'string'})],
        }),
        defineField({
          name: 'prices',
          title: 'Prices',
          type: 'array',
          of: [defineArrayMember({type: 'string'})],
        }),
      ],
    }),
    defineField({
      name: 'contentHash',
      title: 'Content hash',
      type: 'string',
      description: 'Hash of normalised body text for deduping autopsy input.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'html',
      title: 'Cached HTML',
      type: 'text',
      rows: 8,
      description: 'Raw response body so a rerun does not refetch (NEC-08).',
    }),
  ],
  preview: {
    select: {title: 'title', subtitle: 'path', status: 'httpStatus'},
    prepare({title, subtitle, status}) {
      return {
        title: title || subtitle || 'page',
        subtitle: [subtitle, status != null ? String(status) : null].filter(Boolean).join(' · '),
      }
    },
  },
})
