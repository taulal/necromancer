/**
 * Schedule twin — POSTs with mode=schedule so Vessel ticks all instances + sweeps.
 */
import {scheduledEventHandler} from '@sanity/functions'

export const handler = scheduledEventHandler(async () => {
  const base = process.env.VESSEL_URL?.replace(/\/$/, '')
  const secret = process.env.DRAIN_SECRET
  if (!base || !secret) {
    console.warn('[drain-kicker-schedule] VESSEL_URL or DRAIN_SECRET missing — skip')
    return
  }
  const res = await fetch(`${base}/api/ritual/drain`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({mode: 'schedule'}),
  })
  console.log(`[drain-kicker-schedule] drain → ${res.status}`)
})
