import type {ExhumedPageInput} from '../corpse'
import type {ProposedType} from '../proposal'

/** Minimal multi-page site for condense cluster + facts tests. */
export const fixtureExhumedPages: ExhumedPageInput[] = [
  {
    _id: 'page-home',
    path: '/',
    url: 'https://acme.example/',
    title: 'Acme Plumbing',
    httpStatus: 200,
    contentHash: 'hash-home',
    sections: [
      {
        kind: 'hero',
        text: 'Welcome to Acme Plumbing. We fix pipes fast across Auckland.',
      },
      {
        kind: 'contact',
        text: 'Call 021 152 6894 or email hello@acme.example. © Acme Plumbing · Privacy · Terms',
      },
    ],
    images: [{src: 'https://acme.example/hero.jpg'}],
    links: ['https://acme.example/services/drain'],
    detectedEntities: {
      phones: ['021 152 6894'],
      emails: ['hello@acme.example'],
      addresses: ['12 Pipe St, Auckland'],
      prices: [],
    },
  },
  {
    _id: 'page-drain',
    path: '/services/drain',
    url: 'https://acme.example/services/drain',
    title: 'Drain clearing',
    httpStatus: 200,
    contentHash: 'hash-drain',
    sections: [
      {kind: 'hero', text: 'Drain clearing by licensed plumbers.'},
      {kind: 'prose', text: 'We clear blocked drains same day. Call 021 152 6894.'},
      {kind: 'cta', text: 'Book a drain clear today.'},
    ],
    images: [],
    links: [],
    detectedEntities: {phones: ['021 152 6894'], emails: [], addresses: [], prices: ['$120']},
  },
  {
    _id: 'page-hotwater',
    path: '/services/hot-water',
    url: 'https://acme.example/services/hot-water',
    title: 'Hot water',
    httpStatus: 200,
    contentHash: 'hash-hotwater',
    sections: [
      {kind: 'hero', text: 'Hot water cylinder repair and install.'},
      {kind: 'prose', text: 'Same-day hot water fixes. Call 021 152 6894.'},
      {kind: 'cta', text: 'Book a hot water visit today.'},
    ],
    images: [],
    links: [],
    detectedEntities: {phones: ['021 152 6894'], emails: [], addresses: [], prices: []},
  },
  {
    _id: 'page-gas',
    path: '/services/gas',
    url: 'https://acme.example/services/gas',
    title: 'Gas fitting',
    httpStatus: 200,
    contentHash: 'hash-gas',
    sections: [
      {kind: 'hero', text: 'Certified gas fitting for homes.'},
      {kind: 'prose', text: 'Safe gas installs and certificates. Call 09 555 0100.'},
      {kind: 'cta', text: 'Book a gas fitter today.'},
    ],
    images: [],
    links: [],
    detectedEntities: {
      phones: ['09 555 0100'],
      emails: [],
      addresses: [],
      prices: [],
    },
  },
  {
    _id: 'page-404',
    path: '/missing',
    url: 'https://acme.example/missing',
    title: 'Not found',
    httpStatus: 404,
    contentHash: 'hash-404',
    sections: [{kind: 'prose', text: 'This page should be skipped.'}],
    detectedEntities: {phones: ['021 000 0000'], emails: [], addresses: [], prices: []},
  },
]

/** Happy-path proposal that compiles and matches fixture excerpts. */
export function fixtureHappyProposalTypes(): ProposedType[] {
  return [
    {
      name: 'page',
      title: 'Page',
      kind: 'document',
      bonesMatch: null,
      fields: [
        {name: 'title', type: 'string', required: true, evidenceCount: 4},
        {name: 'slug', type: 'slug', required: true, evidenceCount: 4},
        {
          name: 'body',
          type: 'array',
          of: ['hero', 'richText', 'cta', 'contactBlock'],
          evidenceCount: 4,
        },
      ],
      rationale: 'Routable pages for the marketing site.',
      evidence: [
        {
          pageId: 'page-home',
          url: 'https://acme.example/',
          excerpt: 'Welcome to Acme Plumbing. We fix pipes fast across Auckland.',
        },
      ],
      confidence: 0.9,
      decision: 'keep',
    },
    {
      name: 'siteSettings',
      title: 'Site settings',
      kind: 'singleton',
      bonesMatch: null,
      fields: [
        {name: 'siteTitle', type: 'string', evidenceCount: 4},
        {name: 'phone', type: 'string', evidenceCount: 4},
        {name: 'email', type: 'string', evidenceCount: 1},
      ],
      rationale: 'Site-wide contact facts live once.',
      evidence: [
        {
          pageId: 'page-home',
          url: 'https://acme.example/',
          excerpt: 'Call 021 152 6894 or email hello@acme.example',
        },
      ],
      confidence: 0.95,
      decision: 'keep',
    },
    {
      name: 'service',
      title: 'Service',
      kind: 'document',
      bonesMatch: null,
      fields: [
        {name: 'title', type: 'string', required: true, evidenceCount: 3},
        {name: 'slug', type: 'slug', required: true, evidenceCount: 3},
        {name: 'summary', type: 'text', evidenceCount: 3},
      ],
      rationale: 'Repeated /services/* pages share the same shape.',
      evidence: [
        {
          pageId: 'page-drain',
          url: 'https://acme.example/services/drain',
          excerpt: 'Drain clearing by licensed plumbers.',
        },
      ],
      confidence: 0.85,
      decision: 'keep',
    },
  ]
}
