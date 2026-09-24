import {HelpCircleIcon} from '@sanity/icons/HelpCircle'
import {defineArrayMember, defineField, defineType} from 'sanity'
import {evidenceObject} from '../objects/evidence'

/**
 * One interrogation item (BRIEF.md §6 / §7.3). Required open questions gate the stage.
 */
export const question = defineType({
  name: 'question',
  title: 'Question',
  type: 'document',
  icon: HelpCircleIcon,
  description:
    'A question for the human during interrogation — contradiction, authenticity, mapping, etc.',
  fields: [
    defineField({
      name: 'seance',
      title: 'Séance',
      type: 'reference',
      to: [{type: 'seance'}],
      description: 'Séance this question belongs to.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      description: 'What sort of uncertainty this question resolves.',
      options: {
        list: [
          {title: 'Contradiction', value: 'contradiction'},
          {title: 'Authenticity', value: 'authenticity'},
          {title: 'Keep or kill', value: 'keep-or-kill'},
          {title: 'Mapping', value: 'mapping'},
          {title: 'Missing info', value: 'missing-info'},
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'prompt',
      title: 'Prompt',
      type: 'text',
      rows: 3,
      description: 'The question shown to the reviewer.',
      validation: (rule) => rule.required().min(1),
    }),
    evidenceObject,
    defineField({
      name: 'options',
      title: 'Options',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      description: 'Suggested answer chips; free text is always allowed.',
    }),
    defineField({
      name: 'answer',
      title: 'Answer',
      type: 'text',
      rows: 2,
      description: 'The reviewer’s chosen or typed answer.',
    }),
    defineField({
      name: 'answeredBy',
      title: 'Answered by',
      type: 'string',
      description: 'Account-global actor id who answered.',
    }),
    defineField({
      name: 'answeredAt',
      title: 'Answered at',
      type: 'datetime',
      description: 'When the answer was recorded.',
    }),
    defineField({
      name: 'required',
      title: 'Required',
      type: 'boolean',
      description: 'If true, the interrogation stage will not advance until answered.',
      initialValue: true,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'source',
      title: 'Source',
      type: 'string',
      description: 'Whether Claude or a Knowledge Base produced this question.',
      options: {
        list: [
          {title: 'Claude', value: 'claude'},
          {title: 'Knowledge Base', value: 'knowledgeBase'},
        ],
        layout: 'radio',
      },
      initialValue: 'claude',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'spawnsTasks',
      title: 'Spawns tasks',
      type: 'boolean',
      description: 'If true, answering this question should generate ritual tasks.',
      initialValue: false,
    }),
  ],
  preview: {
    select: {title: 'prompt', kind: 'kind', required: 'required', answer: 'answer'},
    prepare({title, kind, required, answer}) {
      const state = answer ? 'answered' : required ? 'required' : 'optional'
      return {
        title: title ? String(title).slice(0, 80) : 'Question',
        subtitle: [kind, state].filter(Boolean).join(' · '),
      }
    },
  },
})
