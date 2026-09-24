/**
 * Bones — the open block kit. Deliberately plain; styled only via CSS variables
 * fed from siteSettings.brand so each resurrected site keeps its own face.
 * TODO(NEC-14): object schema + renderer for each block below, plus page/siteSettings/redirect.
 */
export const BONES = [
  'hero', 'richText', 'mediaText', 'cardGrid', 'gallery', 'testimonial',
  'faq', 'cta', 'contactBlock', 'logoStrip', 'stats', 'embed',
] as const

export type BoneName = (typeof BONES)[number]
