/**
 * Sanitize HTML before storing on exhumedPage (review F9).
 * - Strip Durable __NEXT_DATA__ privacy fields (ipAddress, captchaKey, apiUrl)
 * - Cap stored HTML at 500 KB (keep contentHash + structure either way)
 */
export const MAX_STORED_HTML_BYTES = 500 * 1024

const PRIVACY_KEYS = ['ipAddress', 'captchaKey', 'apiUrl'] as const

function stripPrivacyFromNextData(html: string): string {
  return html.replace(
    /(<script[^>]*\bid=["']__NEXT_DATA__["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
    (_full, open: string, json: string, close: string) => {
      try {
        const data = JSON.parse(json) as unknown
        scrub(data)
        return `${open}${JSON.stringify(data)}${close}`
      } catch {
        // If JSON is broken, drop the script entirely rather than store secrets.
        return `${open}{}${close}`
      }
    },
  )
}

function scrub(node: unknown): void {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const child of node) scrub(child)
    return
  }
  const obj = node as Record<string, unknown>
  for (const key of Object.keys(obj)) {
    if ((PRIVACY_KEYS as readonly string[]).includes(key)) {
      delete obj[key]
    } else {
      scrub(obj[key])
    }
  }
}

export function sanitizeStoredHtml(html: string): string {
  let out = stripPrivacyFromNextData(html)
  const bytes = Buffer.byteLength(out, 'utf8')
  if (bytes > MAX_STORED_HTML_BYTES) {
    // Prefer dropping the body over truncating mid-tag; structure lives in sections.
    out =
      `<!-- truncated: ${bytes} bytes → cap ${MAX_STORED_HTML_BYTES} -->\n` +
      out.slice(0, MAX_STORED_HTML_BYTES)
  }
  return out
}
