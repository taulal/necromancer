import {useEffect} from 'react'

/**
 * Polls the Vessel drain route while a séance screen is open (BRIEF.md §4).
 * Uses SANITY_APP_* only — never the real write token / DRAIN_SECRET.
 * The Function kicker is the safety net when the App is closed.
 */
export function useDrainKicker(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    const base = import.meta.env.SANITY_APP_VESSEL_URL?.replace(/\/$/, '')
    const kick = import.meta.env.SANITY_APP_DRAIN_KICK
    if (!base || !kick) return

    let cancelled = false

    const poke = () => {
      if (cancelled) return
      void fetch(`${base}/api/ritual/drain`, {
        method: 'POST',
        headers: {authorization: `Bearer ${kick}`},
      }).catch(() => undefined)
    }

    poke()
    const id = window.setInterval(poke, 5000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [enabled])
}
