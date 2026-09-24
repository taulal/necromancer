/**
 * Condensed autopsy input built deterministically from exhumedPage docs (NEC-09).
 */

export type CorpseSection = {
  kind: string
  text: string
  imageCount: number
  linkCount: number
}

export type CorpsePage = {
  pageId: string
  path: string
  title?: string
  httpStatus: number
  sections: CorpseSection[]
}

export type ShapeCluster = {
  pathPrefix: string
  /** Representative kind sequence (shortest member signature). */
  signature: string[]
  pageIds: string[]
}

export type SiteFact = {
  value: string
  pages: string[]
}

export type CorpseFacts = {
  phones: SiteFact[]
  emails: SiteFact[]
  addresses: SiteFact[]
  prices: SiteFact[]
}

export type Corpse = {
  pages: CorpsePage[]
  /** Collapsed chrome blocks shared across the site (header/footer noise). */
  chrome: string[]
  clusters: ShapeCluster[]
  facts: CorpseFacts
}

/** Raw exhumed page shape as stored in HQ (subset used by condense). */
export type ExhumedPageInput = {
  _id: string
  path?: string
  url?: string
  title?: string
  httpStatus?: number
  contentHash?: string
  headings?: string[]
  sections?: Array<{kind?: string; html?: string; text?: string}>
  images?: Array<{src?: string}>
  links?: string[]
  detectedEntities?: {
    phones?: string[]
    emails?: string[]
    addresses?: string[]
    prices?: string[]
  }
}
