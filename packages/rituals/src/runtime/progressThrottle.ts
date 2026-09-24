/**
 * Throttle ctx.setProgress (review F1): at most every 10 percentage points or every 3s.
 */
export function createProgressThrottle(
  setProgress: (field: string, value: number) => Promise<void>,
  field = 'exhumeProgress',
) {
  let lastPct = -Infinity
  let lastAt = 0

  return async (pct: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)))
    const now = Date.now()
    const jumped = clamped - lastPct >= 10 || clamped === 100 || clamped === 0
    const aged = now - lastAt >= 3000
    if (!jumped && !aged && lastPct !== -Infinity) return
    lastPct = clamped
    lastAt = now
    await setProgress(field, clamped)
  }
}
