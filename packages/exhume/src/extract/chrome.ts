/**
 * Chrome = blocks that appear on >70% of pages → siteSettings candidates (BRIEF.md §7.1).
 */
export function detectChrome(pageTexts: string[]): string[] {
  if (pageTexts.length < 3) return []
  const threshold = Math.ceil(pageTexts.length * 0.7)
  const blockCounts = new Map<string, number>()

  for (const text of pageTexts) {
    const blocks = text
      .split(/\n+/)
      .map((b) => b.replace(/\s+/g, ' ').trim())
      .filter((b) => b.length >= 40 && b.length <= 400)
    const seen = new Set<string>()
    for (const b of blocks) {
      if (seen.has(b)) continue
      seen.add(b)
      blockCounts.set(b, (blockCounts.get(b) ?? 0) + 1)
    }
  }

  return [...blockCounts.entries()]
    .filter(([, n]) => n >= threshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([b]) => b)
}
