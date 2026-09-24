import {SchemaIcon} from '@sanity/icons/Schema'
import {defineArrayMember, defineField, defineType} from 'sanity'

/**
 * Inferred anatomy for a séance. Versions are kept for the write-up (BRIEF.md §6 / §7.2).
 */
export const schemaProposal = defineType({
  name: 'schemaProposal',
  title: 'Schema proposal',
  type: 'document',
  icon: SchemaIcon,
  description:
    'Editable content-model proposal produced by necro.autopsy. Accept anatomy freezes it.',
  fields: [
    defineField({
      name: 'seance',
      title: 'Séance',
      type: 'reference',
      to: [{type: 'seance'}],
      description: 'Séance this proposal belongs to.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'version',
      title: 'Version',
      type: 'number',
      description: 'Starts at 1; re-running autopsy writes v2, v3, … (history kept).',
      validation: (rule) => rule.required().integer().min(1),
      initialValue: 1,
    }),
    defineField({
      name: 'types',
      title: 'Types',
      type: 'array',
      description: 'Proposed document, object and singleton types.',
      of: [defineArrayMember({type: 'proposedType'})],
      validation: (rule) => rule.min(1),
    }),
    defineField({
      name: 'model',
      title: 'Model',
      type: 'string',
      description: 'Claude model id used for the propose step (NECRO_MODEL_REASONING).',
      readOnly: true,
    }),
    defineField({
      name: 'inputTokens',
      title: 'Input tokens',
      type: 'number',
      description: 'Total input tokens for propose (+ repair if any). Logged for the write-up.',
      validation: (rule) => rule.integer().min(0),
      readOnly: true,
    }),
    defineField({
      name: 'outputTokens',
      title: 'Output tokens',
      type: 'number',
      description: 'Total output tokens for propose (+ repair if any). Logged for the write-up.',
      validation: (rule) => rule.integer().min(0),
      readOnly: true,
    }),
    defineField({
      name: 'repairRounds',
      title: 'Repair rounds',
      type: 'number',
      description: 'How many validate→Claude repair rounds ran (0 or 1).',
      validation: (rule) => rule.integer().min(0).max(1),
      readOnly: true,
    }),
    defineField({
      name: 'acceptedAt',
      title: 'Accepted at',
      type: 'datetime',
      description:
        'Set when the reviewer fires Accept anatomy; proposal should be treated as frozen.',
      readOnly: true,
    }),
  ],
  preview: {
    select: {version: 'version', seance: 'seance._ref'},
    prepare({version, seance}) {
      return {
        title: `Anatomy v${version ?? '?'}`,
        subtitle: seance ? `séance ${seance}` : undefined,
      }
    },
  },
})
