import {defineArrayMember, defineField, defineType} from '@sanity/types'
import {BONES} from '../bones'

/**
 * Minimal page document so `link.internal` and cardGrid item stubs can resolve.
 * Autopsy expands fields (SEO, etc.) per site; body is a Bones page-builder array.
 */
export const page = defineType({
  name: 'page',
  title: 'Page',
  type: 'document',
  description:
    'A routable page. Body is composed of Bones blocks (and later site-specific objects).',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'Page title for Studio lists and default document title.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      description: 'URL path segment for this page (Vessel routing).',
      options: {source: 'title', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'array',
      description: 'Ordered page sections. Members are Bones block objects.',
      of: BONES.map((name) => defineArrayMember({type: name})),
    }),
  ],
  preview: {
    select: {title: 'title', subtitle: 'slug.current'},
    prepare({title, subtitle}) {
      return {title: title || 'Page', subtitle: subtitle ? `/${subtitle}` : undefined}
    },
  },
})
