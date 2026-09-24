import {CubeIcon} from '@sanity/icons/Cube'
import {defineArrayMember, defineField, defineType} from '@sanity/types'

/**
 * One proposed document/object/singleton type from the autopsy (BRIEF.md §6).
 */
export const proposedType = defineType({
  name: 'proposedType',
  title: 'Proposed type',
  type: 'object',
  icon: CubeIcon,
  description: 'A candidate Sanity type inferred from the dead site.',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'Machine name (camelCase). Becomes the Sanity type name.',
      validation: (rule) =>
        rule
          .required()
          .regex(/^[a-z][a-zA-Z0-9]*$/, {name: 'camelCase'})
          .error('Must be camelCase starting with a lowercase letter'),
    }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'Human-readable Studio title.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      description: 'Document (collection), object (embeddable), or singleton (one per site).',
      options: {
        list: [
          {title: 'Document', value: 'document'},
          {title: 'Object', value: 'object'},
          {title: 'Singleton', value: 'singleton'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'bonesMatch',
      title: 'Bones match',
      type: 'string',
      description:
        'Matching Bones block name when this type reuses the open kit; null/empty when custom.',
    }),
    defineField({
      name: 'fields',
      title: 'Fields',
      type: 'array',
      description: 'Proposed fields for this type.',
      of: [defineArrayMember({type: 'proposedField'})],
      validation: (rule) => rule.min(1),
    }),
    defineField({
      name: 'rationale',
      title: 'Rationale',
      type: 'text',
      rows: 3,
      description: 'Why this type exists — the schema-thoughtfulness note judges will read.',
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'evidence',
      title: 'Evidence',
      type: 'array',
      description: 'Exhumed pages (and excerpts) that justified proposing this type.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'typeEvidence',
          fields: [
            defineField({
              name: 'page',
              title: 'Page',
              type: 'reference',
              to: [{type: 'exhumedPage'}],
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'excerpt',
              title: 'Excerpt',
              type: 'text',
              rows: 2,
              description: 'Short quote or structural note from the page.',
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: {title: 'excerpt', subtitle: 'page._ref'},
          },
        }),
      ],
    }),
    defineField({
      name: 'confidence',
      title: 'Confidence',
      type: 'number',
      description: 'Model confidence that this type is correct (0–1).',
      validation: (rule) => rule.required().min(0).max(1),
    }),
    defineField({
      name: 'decision',
      title: 'Decision',
      type: 'string',
      description: 'Reviewer decision on the Autopsy board before Accept anatomy.',
      options: {
        list: [
          {title: 'Keep', value: 'keep'},
          {title: 'Merge', value: 'merge'},
          {title: 'Drop', value: 'drop'},
        ],
        layout: 'radio',
      },
      initialValue: 'keep',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'mergeInto',
      title: 'Merge into',
      type: 'string',
      description: 'When decision is merge: the target type name this folds into.',
      hidden: ({parent}) => parent?.decision !== 'merge',
    }),
  ],
  preview: {
    select: {title: 'title', name: 'name', kind: 'kind', confidence: 'confidence'},
    prepare({title, name, kind, confidence}) {
      const pct = typeof confidence === 'number' ? ` · ${Math.round(confidence * 100)}%` : ''
      return {
        title: title || name || 'type',
        subtitle: `${kind || '?'}${pct}`,
      }
    },
  },
})
