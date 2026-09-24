/** NZ / AU / UK-ish phone, email, price, rough address heuristics (BRIEF.md §7.1). */
const PHONE_RE =
  /(?:\+?(?:64|61|44)\s?[1-9][\d\s()-]{7,14}|\(0[2-9]\)\s?\d{3,4}\s?\d{3,4}|0[2-9]\d{7,9}|021[\s-]?\d{3}[\s-]?\d{4})/g
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const PRICE_RE = /(?:NZ\$|AU\$|£|\$)\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g
const ADDRESS_RE =
  /\d{1,5}\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Way|Place|Pl)\b[^.\n]{0,40}/g

export interface DetectedEntities {
  phones: string[]
  emails: string[]
  addresses: string[]
  prices: string[]
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))]
}

export function extractEntities(text: string): DetectedEntities {
  return {
    phones: unique(text.match(PHONE_RE) ?? []),
    emails: unique(text.match(EMAIL_RE) ?? []),
    addresses: unique(text.match(ADDRESS_RE) ?? []),
    prices: unique(text.match(PRICE_RE) ?? []),
  }
}
