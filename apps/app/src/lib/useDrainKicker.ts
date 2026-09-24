import {useQuery} from '@sanity/sdk-react'
import {useEffect} from 'react'

/** How often the App pokes the Vessel while there is queued work. */
export const DRAIN_KICK_INTERVAL_MS = 20_000

/** Unclaimed pending effects on our workflow instances (0.35: claim absence = available). */
const PENDING_WORK_QUERY = `count(*[
  _type == "sanity.workflow.instance" &&
  tag == "necromancer" &&
  count(pendingEffects[!defined(claim)]) > 0
])`

/**
 * Pokes the Vessel drain route while `enabled` (BRIEF.md §4).
 * Uses SANITY_APP_* only: the kick token is public by design and can only drain
 * pending work. The Sanity Function kicker is the safety net when the App is closed.
 * Skips while the tab is hidden so background tabs cost nothing.
 */
export function useDrainKicker(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    const base = import.meta.env.SANITY_APP_VESSEL_URL?.replace(/\/$/, '')
    const kick = import.meta.env.SANITY_APP_DRAIN_KICK
    if (!base || !kick) return

    let cancelled = false

    const poke = () => {
      if (cancelled || document.visibilityState !== 'visible') return
      void fetch(`${base}/api/ritual/drain`, {
        method: 'POST',
        headers: {authorization: `Bearer ${kick}`},
      }).catch(() => undefined)
    }

    poke()
    const id = window.setInterval(poke, DRAIN_KICK_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [enabled])
}

/**
 * Mount inside <Suspense> on séance screens. Live-queries HQ and only polls
 * while some instance actually has queued, unclaimed work.
 */
export function PendingWorkKicker() {
  const {data} = useQuery<number>({query: PENDING_WORK_QUERY})
  useDrainKicker((data ?? 0) > 0)
  return null
}
