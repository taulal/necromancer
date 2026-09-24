import {LinkIcon} from '@sanity/icons/Link'
import {defineField, defineType} from '@sanity/types'

/**
 * One 301 mapping from an old URL to its new Vessel path (BRIEF.md §6).
 */
export const redirectLedgerEntry = defineType({
  name: 'redirectLedgerEntry',
  title: 'Redirect ledger entry',
  type: 'document',
  icon: LinkIcon,
  description: 'Maps an old path to its resurrected home. Vessel middleware serves these as 301s.',
  fields: [
    defineField({
      name: 'seance',
      title: 'Séance',
      type: 'reference',
      to: [{type: 'seance'}],
      description: 'Séance this redirect belongs to.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'from',
      title: 'From',
      type: 'string',
      description: 'Old path or absolute URL on the dead site.',
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'to',
      title: 'To',
      type: 'string',
      description: 'New path on the Vessel (or absolute URL). Empty when unmapped/dropped.',
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      description: 'Coverage state for the Rise redirect table.',
      options: {
        list: [
          {title: 'Mapped', value: 'mapped'},
          {title: 'Unmapped', value: 'unmapped'},
          {title: 'Dropped', value: 'dropped'},
        ],
        layout: 'radio',
      },
      initialValue: 'unmapped',
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {from: 'from', to: 'to', status: 'status'},
    prepare({from, to, status}) {
      return {
        title: from || 'redirect',
        subtitle: [status, to].filter(Boolean).join(' → '),
      }
    },
  },
})
