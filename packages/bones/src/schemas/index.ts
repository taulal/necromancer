import type {SchemaTypeDefinition} from 'sanity'
import {cardGrid} from './cardGrid'
import {contactBlock} from './contactBlock'
import {cta} from './cta'
import {embed} from './embed'
import {faq} from './faq'
import {gallery} from './gallery'
import {hero} from './hero'
import {link} from './link'
import {logoStrip} from './logoStrip'
import {mediaText} from './mediaText'
import {page} from './page'
import {redirect} from './redirect'
import {richText} from './richText'
import {siteSettings} from './siteSettings'
import {stats} from './stats'
import {testimonial} from './testimonial'
import {testimonialDoc} from './testimonialDoc'

/** Shared objects + Bones blocks (page-builder members). */
export const bonesBlockTypes: SchemaTypeDefinition[] = [
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
]

/** Document stubs needed for refs and Vessel (page, settings, redirects, testimonials). */
export const bonesDocumentTypes: SchemaTypeDefinition[] = [
  page,
  siteSettings,
  redirect,
  testimonialDoc,
]

/** Full Bones schema set for Schema.compile / Studio registration. */
export const bonesSchemaTypes: SchemaTypeDefinition[] = [...bonesBlockTypes, ...bonesDocumentTypes]

export {
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
}
