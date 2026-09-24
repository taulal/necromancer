import {defineField, defineType} from 'sanity'

export const contactBlock = defineType({
  name: 'contactBlock',
  title: 'Contact block',
  type: 'object',
  description:
    'Contact section chrome only. Phone, email, address and hours are read from siteSettings — never stored here.',
  fields: [
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
      description: 'Optional heading for the contact section.',
    }),
    defineField({
      name: 'intro',
      title: 'Intro',
      type: 'text',
      rows: 3,
      description: 'Optional intro copy above the contact facts / form.',
    }),
    defineField({
      name: 'showForm',
      title: 'Show form',
      type: 'boolean',
      description:
        'Whether the Vessel should render a contact form shell. Form fields and submission are out of scope for MVP; contact facts still come from siteSettings.',
      initialValue: false,
    }),
  ],
  preview: {
    select: {title: 'heading'},
    prepare({title}) {
      return {title: title || 'Contact', subtitle: 'Contact block'}
    },
  },
})
