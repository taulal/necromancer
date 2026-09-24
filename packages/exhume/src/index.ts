export {detectPlatform, FINGERPRINTS, type Platform} from './fingerprints'
export {crawl, type CrawlResult, type CrawlOptions, type CrawlProgress} from './crawl/crawl'
export {extractEntities, type DetectedEntities} from './extract/entities'
export {extractBrand, type BrandExtraction} from './extract/brand'
export {extractPage, type ExtractedPage} from './extract/page'
export {detectChrome} from './extract/chrome'
export {decodeCfEmail, decodeCfEmailsInHtml, extractDurable} from './extract/durable'
export {sanitizeStoredHtml, MAX_STORED_HTML_BYTES} from './extract/sanitizeHtml'
export {looksLikeSitemapXml} from './crawl/sitemap'
export {
  sameOrigin,
  isSameSiteRedirect,
  OffSiteRedirectError,
  USER_AGENT,
  DEFAULT_PAGE_CAP,
  DEFAULT_CONCURRENCY,
} from './crawl/http'
