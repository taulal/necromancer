import type {BoneName} from './bones'

export type BoneCatalogueField = {
  type: string
  required?: boolean
  note?: string
}

export type BoneCatalogueEntry = {
  name: BoneName | 'link'
  purpose: string
  fields: Record<string, BoneCatalogueField | string>
}

/**
 * Compact catalogue for Autopsy prompts. Purpose lines are written for a model to choose blocks.
 * Field shapes stay loose; Autopsy tightens validation per site.
 */
export const BONES_CATALOGUE: BoneCatalogueEntry[] = [
  {
    name: 'link',
    purpose:
      'Shared link object used by CTAs and cards. Exactly one of external href or internal page ref.',
    fields: {
      label: 'string — visible link text',
      href: 'url — external http(s); mutually exclusive with internal',
      internal: 'reference → page — mutually exclusive with href',
    },
  },
  {
    name: 'hero',
    purpose:
      'Use for the first full-width band of a page: a headline, optional supporting line and up to two calls to action.',
    fields: {
      heading: 'string ≤90 required',
      subheading: 'text ≤240',
      image: 'image with hotspot; alt required when image set',
      primaryCta: 'link',
      secondaryCta: 'link',
    },
  },
  {
    name: 'richText',
    purpose:
      'Use for a free-form prose section — long copy, mixed headings and paragraphs that are not a specialised band.',
    fields: {
      body: 'portableText required',
    },
  },
  {
    name: 'mediaText',
    purpose:
      'Use for a two-column band: an image beside a heading and rich text body (about, feature, split story).',
    fields: {
      heading: 'string',
      body: 'portableText required',
      image: 'image required (hotspot)',
      imageSide: 'left | right',
    },
  },
  {
    name: 'cardGrid',
    purpose:
      'Use for a grid of cards — services, products, team teasers, or an index over a collection. Prefer items[] refs when a collection type exists; otherwise inline cards[].',
    fields: {
      heading: 'string',
      intro: 'text',
      cards: 'array of {title, body text, image, link} — inline; mutually exclusive with items',
      items:
        'reference[] → <collection type set by Autopsy; schema stub uses page> — mutually exclusive with cards',
    },
  },
  {
    name: 'gallery',
    purpose: 'Use for a photo gallery or image strip with optional captions.',
    fields: {
      heading: 'string',
      images: 'array of {image, alt required, caption}',
    },
  },
  {
    name: 'testimonial',
    purpose:
      'Use for customer or peer quotes. Prefer refs to reusable testimonialDoc documents when the same quote appears on multiple pages; otherwise inline {quote, name, detail}.',
    fields: {
      items: 'array of reference→testimonialDoc OR inline {quote, name, detail}',
    },
  },
  {
    name: 'faq',
    purpose: 'Use for a list of questions and answers (accordion or stacked Q&A).',
    fields: {
      heading: 'string',
      items: 'array of {question string, answer portableText}',
    },
  },
  {
    name: 'cta',
    purpose:
      'Use for a mid- or end-of-page call-to-action band with a required button (contact, book, get a quote).',
    fields: {
      heading: 'string required',
      body: 'text',
      button: 'link required',
    },
  },
  {
    name: 'contactBlock',
    purpose:
      'Use for a contact section shell. Phone, email, address and hours come from siteSettings — never store those facts on the block.',
    fields: {
      heading: 'string',
      intro: 'text',
      showForm: 'boolean — whether to show a form shell (facts still from siteSettings)',
    },
  },
  {
    name: 'logoStrip',
    purpose: 'Use for a trust / partner / client logo row.',
    fields: {
      heading: 'string',
      logos: 'array of {image, alt required}',
    },
  },
  {
    name: 'stats',
    purpose: 'Use for a row of key figures (years in business, projects completed, etc.).',
    fields: {
      items: 'array of {value string, label string}',
    },
  },
  {
    name: 'embed',
    purpose: 'Use for an embedded map, video, or generic iframe with an accessible title.',
    fields: {
      kind: 'map | video | iframe',
      url: 'url required',
      title: 'string required (a11y)',
    },
  },
]
