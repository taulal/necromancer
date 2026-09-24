import {defineArrayMember} from '@sanity/types'

/** Minimal portable text: blocks only. Autopsy may tighten marks/styles per site. */
export const portableTextMembers = [
  defineArrayMember({
    type: 'block',
  }),
]
