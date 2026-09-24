/**
 * Bones — the open block kit. Deliberately plain; styled only via CSS variables
 * fed from siteSettings.brand so each resurrected site keeps its own face.
 * NEC-14a: object schemas + catalogue. Renderers land in a later ticket.
 */
export {BONES, type BoneName} from './bones'
export {BONES_CATALOGUE, type BoneCatalogueEntry, type BoneCatalogueField} from './catalogue'
export {
  bonesBlockTypes,
  bonesDocumentTypes,
  bonesSchemaTypes,
  link,
  hero,
  richText,
  mediaText,
  cardGrid,
  gallery,
  testimonial,
  faq,
  cta,
  contactBlock,
  logoStrip,
  stats,
  embed,
  page,
  siteSettings,
  redirect,
  testimonialDoc,
} from './schemas'
