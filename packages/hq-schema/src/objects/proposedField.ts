import {ComposeIcon} from '@sanity/icons/Compose'
import {defineField, defineType} from '@sanity/types'

/**
 * One field inside a proposed content type (BRIEF.md §6).
 * Editable on the Autopsy board; frozen after "Accept anatomy".
 */
export const proposedField = defineType({
  name: 'proposedField',
  title: 'Proposed field',
  type: 'object',
  icon: ComposeIcon,
  description: 'A single field on a proposed document or object type.',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'Machine name (camelCase). Becomes the Sanity field name.',
      validation: (rule) =>
        rule
          .required()
          .regex(/^[a-z][a-zA-Z0-9]*$/, {name: 'camelCase'})
          .error('Must be camelCase starting with a lowercase letter'),
    }),
    defineField({
      name: 'type',
      title: 'Type',
      type: 'string',
      description: 'Sanity field type (or portableText for block content).',
      options: {
        list: [
          {title: 'String', value: 'string'},
          {title: 'Text', value: 'text'},
          {title: 'Number', value: 'number'},
          {title: 'Boolean', value: 'boolean'},
          {title: 'Date', value: 'date'},
          {title: 'Datetime', value: 'datetime'},
          {title: 'URL', value: 'url'},
          {title: 'Slug', value: 'slug'},
          {title: 'Image', value: 'image'},
          {title: 'File', value: 'file'},
          {title: 'Array', value: 'array'},
          {title: 'Object', value: 'object'},
          {title: 'Reference', value: 'reference'},
          {title: 'Portable Text', value: 'portableText'},
        ],
        layout: 'dropdown',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'of',
      title: 'Array of',
      type: 'array',
      of: [{type: 'string'}],
      description: 'For array fields: member type names (e.g. string, hero, reference).',
      hidden: ({parent}) => parent?.type !== 'array',
    }),
    defineField({
      name: 'to',
      title: 'Reference to',
      type: 'array',
      of: [{type: 'string'}],
      description: 'For reference fields: target type names.',
      hidden: ({parent}) => parent?.type !== 'reference' && parent?.type !== 'array',
    }),
    defineField({
      name: 'required',
      title: 'Required',
      type: 'boolean',
      description: 'True when the field was present on >90% of evidence pages.',
      initialValue: false,
    }),
    defineField({
      name: 'validation',
      title: 'Validation',
      type: 'object',
      description: 'Constraints inferred from observed values (+20% slack on lengths).',
      fields: [
        defineField({
          name: 'min',
          title: 'Min',
          type: 'number',
          description: 'Minimum length or numeric value.',
        }),
        defineField({
          name: 'max',
          title: 'Max',
          type: 'number',
          description: 'Maximum length or numeric value.',
        }),
        defineField({
          name: 'regex',
          title: 'Regex',
          type: 'string',
          description: 'Optional pattern the value must match.',
        }),
      ],
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 2,
      description: 'Human-readable help text for Studio editors.',
    }),
    defineField({
      name: 'evidenceCount',
      title: 'Evidence count',
      type: 'number',
      description: 'How many exhumed pages contributed evidence for this field.',
      validation: (rule) => rule.required().integer().min(0),
      initialValue: 0,
    }),
  ],
  preview: {
    select: {title: 'name', subtitle: 'type', required: 'required'},
    prepare({title, subtitle, required}) {
      return {
        title: title || 'field',
        subtitle: `${subtitle || '?'}${required ? ' · required' : ''}`,
      }
    },
  },
})
