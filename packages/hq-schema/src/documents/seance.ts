import {EarthGlobeIcon} from '@sanity/icons/EarthGlobe'
import {defineArrayMember, defineField, defineType, type SanityDocument} from 'sanity'
import {slugFromUrl} from '../slugFromUrl'

/**
 * One resurrection attempt (BRIEF.md §6). Subject of the `resurrection` workflow.
 */
export const seance = defineType({
  name: 'seance',
  title: 'Séance',
  type: 'document',
  icon: EarthGlobeIcon,
  description:
    'A single attempt to resurrect a dying website: source URL, target dataset, platform verdict, brand, and display status.',
  fields: [
    defineField({
      name: 'url',
      title: 'Source URL',
      type: 'url',
      description: 'The dead (or dying) site being exhumed. Must be http(s).',
      validation: (rule) =>
        rule
          .required()
          .uri({scheme: ['http', 'https']})
          .error('Must be a valid http(s) URL'),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      description:
        'Short id used for the target dataset name (rip-<slug>) and Vessel route. Derived from the hostname (www + TLD stripped), not the raw URL.',
      options: {
        source: (doc: SanityDocument) => {
          const url = typeof doc.url === 'string' ? doc.url : ''
          return url ? slugFromUrl(url) : ''
        },
        maxLength: 64,
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'platform',
      title: 'Platform',
      type: 'string',
      description: 'Detected CMS / host platform from fingerprints during exhumation.',
      options: {
        list: [
          {title: 'WordPress', value: 'wordpress'},
          {title: 'Durable', value: 'durable'},
          {title: 'Wix', value: 'wix'},
          {title: 'Squarespace', value: 'squarespace'},
          {title: 'Webflow', value: 'webflow'},
          {title: 'Static / PHP', value: 'static'},
          {title: 'Unknown', value: 'unknown'},
        ],
      },
    }),
    defineField({
      name: 'platformConfidence',
      title: 'Platform confidence',
      type: 'number',
      description: 'Confidence in the platform verdict (0–1).',
      validation: (rule) => rule.min(0).max(1),
    }),
    defineField({
      name: 'targetMode',
      title: 'Target mode',
      type: 'string',
      description:
        'MVP uses a new dataset in the sandbox project. Stretch: create a whole new project per site.',
      options: {
        list: [
          {title: 'Dataset (MVP)', value: 'dataset'},
          {title: 'Project (stretch)', value: 'project'},
        ],
        layout: 'radio',
      },
      initialValue: 'dataset',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'targetDataset',
      title: 'Target dataset',
      type: 'string',
      description: 'Dataset id for the resurrected content (e.g. rip-example or showcase).',
      validation: (rule) =>
        rule.custom((value, context) => {
          const mode = (context.document as {targetMode?: string} | undefined)?.targetMode
          if (mode === 'dataset' && !value) return 'Required when target mode is dataset'
          return true
        }),
    }),
    defineField({
      name: 'targetProjectId',
      title: 'Target project id',
      type: 'string',
      description: 'Only used in stretch project mode.',
      hidden: ({document}) => document?.targetMode !== 'project',
    }),
    defineField({
      name: 'visibility',
      title: 'Visibility',
      type: 'string',
      description: 'Whether the target dataset is private or public (showcase is public).',
      options: {
        list: [
          {title: 'Private', value: 'private'},
          {title: 'Public', value: 'public'},
        ],
        layout: 'radio',
      },
      initialValue: 'private',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'pageCap',
      title: 'Page cap',
      type: 'number',
      description: 'Maximum pages to crawl (default 50). Same-origin only.',
      initialValue: 50,
      validation: (rule) => rule.required().integer().min(1).max(200),
    }),
    defineField({
      name: 'brand',
      title: 'Brand',
      type: 'object',
      description: 'Colours, fonts and logo extracted so the Vessel can keep the corpse’s face.',
      fields: [
        defineField({
          name: 'colors',
          title: 'Colours',
          type: 'array',
          of: [defineArrayMember({type: 'string'})],
          description: 'Hex or CSS colour tokens, most frequent first.',
        }),
        defineField({
          name: 'fonts',
          title: 'Fonts',
          type: 'array',
          of: [defineArrayMember({type: 'string'})],
          description: 'font-family stacks observed on the dead site.',
        }),
        defineField({
          name: 'logo',
          title: 'Logo URL',
          type: 'url',
          description: 'Best-guess logo (header img, og:image, or favicon).',
          validation: (rule) => rule.uri({scheme: ['http', 'https']}),
        }),
      ],
    }),
    defineField({
      name: 'stats',
      title: 'Stats',
      type: 'object',
      description: 'Crawl totals written by necro.exhume.',
      fields: [
        defineField({
          name: 'pages',
          title: 'Pages',
          type: 'number',
          description: 'Pages successfully exhumed.',
          validation: (rule) => rule.integer().min(0),
        }),
        defineField({
          name: 'images',
          title: 'Images',
          type: 'number',
          description: 'Distinct images discovered.',
          validation: (rule) => rule.integer().min(0),
        }),
        defineField({
          name: 'words',
          title: 'Words',
          type: 'number',
          description: 'Approximate word count across pages.',
          validation: (rule) => rule.integer().min(0),
        }),
        defineField({
          name: 'links',
          title: 'Links',
          type: 'number',
          description: 'Internal + external links counted.',
          validation: (rule) => rule.integer().min(0),
        }),
      ],
    }),
    defineField({
      name: 'exhumeProgress',
      title: 'Exhume progress',
      type: 'number',
      description: '0–1 progress for the necro.exhume effect (live progress bar).',
      validation: (rule) => rule.min(0).max(1),
      readOnly: true,
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      description:
        'Display status for the Graveyard. haunted = interrogation SLA breached (flag only).',
      options: {
        list: [
          {title: 'Alive', value: 'alive'},
          {title: 'Haunted', value: 'haunted'},
          {title: 'Risen', value: 'risen'},
          {title: 'Entombed', value: 'entombed'},
        ],
        layout: 'radio',
      },
      initialValue: 'alive',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'startedBy',
      title: 'Started by',
      type: 'string',
      description: 'Account-global actor id (g… user or p-… robot) who summoned this séance.',
    }),
  ],
  preview: {
    select: {
      title: 'url',
      slug: 'slug.current',
      platform: 'platform',
      status: 'status',
    },
    prepare({title, slug, platform, status}) {
      let domain = slug || 'séance'
      try {
        if (title) domain = new URL(String(title)).hostname
      } catch {
        /* keep slug */
      }
      return {
        title: domain,
        subtitle: [platform, status].filter(Boolean).join(' · '),
      }
    },
  },
  orderings: [
    {
      title: 'Started',
      name: 'startedDesc',
      by: [{field: '_createdAt', direction: 'desc'}],
    },
  ],
})
