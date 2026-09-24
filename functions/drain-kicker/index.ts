/**
 * Pokes the Vessel drain route. Keep this tiny: no AI, no crawling, no long work.
 */
import {documentEventHandler} from '@sanity/functions'

async function kickVessel(): Promise<void> {
  const base = process.env.VESSEL_URL?.replace(/\/$/, '')
  const secret = process.env.DRAIN_SECRET
  if (!base || !secret) {
    console.warn('[drain-kicker] VESSEL_URL or DRAIN_SECRET missing — skip')
    return
  }
  const res = await fetch(`${base}/api/ritual/drain`, {
    method: 'POST',
    headers: {authorization: `Bearer ${secret}`},
  })
  console.log(`[drain-kicker] drain → ${res.status}`)
}

export const handler = documentEventHandler(async () => {
  await kickVessel()
})
