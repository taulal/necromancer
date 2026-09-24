/**
 * Schedule twin of drain-kicker — same POST, different Blueprint trigger.
 */
import {scheduledEventHandler} from '@sanity/functions'

async function kickVessel(): Promise<void> {
  const base = process.env.VESSEL_URL?.replace(/\/$/, '')
  const secret = process.env.DRAIN_SECRET
  if (!base || !secret) {
    console.warn('[drain-kicker-schedule] VESSEL_URL or DRAIN_SECRET missing — skip')
    return
  }
  const res = await fetch(`${base}/api/ritual/drain`, {
    method: 'POST',
    headers: {authorization: `Bearer ${secret}`},
  })
  console.log(`[drain-kicker-schedule] drain → ${res.status}`)
}

export const handler = scheduledEventHandler(async () => {
  await kickVessel()
})
