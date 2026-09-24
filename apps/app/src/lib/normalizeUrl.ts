/** Normalize a typed URL the way `bun run summon` does. */
export function normalizeSiteUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const u = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString().replace(/\/$/, '') || u.origin
  } catch {
    return null
  }
}
