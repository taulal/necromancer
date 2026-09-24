import {CheckmarkCircleIcon} from '@sanity/icons/CheckmarkCircle'
import {defineArrayMember, defineField, defineType} from '@sanity/types'

/**
 * One ritual to-do — auto (Agent Actions) or human (BRIEF.md §6 / §7.5–7.6).
 */
export const task = defineType({
  name: 'task',
  title: 'Task',
  type: 'document',
  icon: CheckmarkCircleIcon,
  description: 'A clean-up ritual item for a target page, planned after reanimation.',
  fields: [
    defineField({
      name: 'seance',
      title: 'Séance',
      type: 'reference',
      to: [{type: 'seance'}],
      description: 'Séance this task belongs to.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'page',
      title: 'Target page id',
      type: 'string',
      description:
        'Document id of the target-dataset page this task acts on (not an HQ exhumedPage).',
    }),
    defineField({
      name: 'mode',
      title: 'Mode',
      type: 'string',
      description: 'auto = Agent Action recipe; human = judgement or missing asset.',
      options: {
        list: [
          {title: 'Auto', value: 'auto'},
          {title: 'Human', value: 'human'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'action',
      title: 'Action',
      type: 'string',
      description: 'What kind of clean-up this task performs.',
      options: {
        list: [
          {title: 'Rewrite placeholder', value: 'rewrite-placeholder'},
          {title: 'Generate alt text', value: 'generate-alt'},
          {title: 'Generate meta', value: 'generate-meta'},
          {title: 'Fix contact', value: 'fix-contact'},
          {title: 'Normalise headings', value: 'normalise-headings'},
          {title: 'Map block', value: 'map-block'},
          {title: 'Verify testimonial', value: 'verify-testimonial'},
          {title: 'Supply asset', value: 'supply-asset'},
          {title: 'Custom', value: 'custom'},
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'why',
      title: 'Why',
      type: 'string',
      description: 'One-line explanation of why this task exists.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'agentAction',
      title: 'Agent Action',
      type: 'object',
      description: 'Recipe for auto tasks (Generate / Transform / Patch / Prompt).',
      fields: [
        defineField({
          name: 'kind',
          title: 'Kind',
          type: 'string',
          options: {
            list: [
              {title: 'Generate', value: 'generate'},
              {title: 'Transform', value: 'transform'},
              {title: 'Patch', value: 'patch'},
              {title: 'Prompt', value: 'prompt'},
            ],
          },
        }),
        defineField({
          name: 'instruction',
          title: 'Instruction',
          type: 'text',
          rows: 3,
          description: 'Prompt or patch description passed to Agent Actions.',
        }),
        defineField({
          name: 'targetPaths',
          title: 'Target paths',
          type: 'array',
          of: [defineArrayMember({type: 'string'})],
          description: 'Field paths on the target document this action may touch.',
        }),
      ],
      hidden: ({document}) => document?.mode !== 'auto',
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      description: 'Lifecycle of this task inside page-ritual.',
      options: {
        list: [
          {title: 'Todo', value: 'todo'},
          {title: 'Casting', value: 'casting'},
          {title: 'Done', value: 'done'},
          {title: 'Failed', value: 'failed'},
          {title: 'Skipped', value: 'skipped'},
        ],
      },
      initialValue: 'todo',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'fromQuestion',
      title: 'From question',
      type: 'reference',
      to: [{type: 'question'}],
      description: 'Interrogation question that spawned this task, if any.',
    }),
    defineField({
      name: 'result',
      title: 'Result',
      type: 'text',
      rows: 3,
      description: 'Outcome log after cast or human completion.',
    }),
  ],
  preview: {
    select: {title: 'why', action: 'action', mode: 'mode', status: 'status'},
    prepare({title, action, mode, status}) {
      return {
        title: title || action || 'Task',
        subtitle: [mode, action, status].filter(Boolean).join(' · '),
      }
    },
  },
})
