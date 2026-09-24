/**
 * Canonical Bones block names. Keep in sync with object schemas in ./schemas/.
 */
export const BONES = [
  'hero',
  'richText',
  'mediaText',
  'cardGrid',
  'gallery',
  'testimonial',
  'faq',
  'cta',
  'contactBlock',
  'logoStrip',
  'stats',
  'embed',
] as const

export type BoneName = (typeof BONES)[number]
