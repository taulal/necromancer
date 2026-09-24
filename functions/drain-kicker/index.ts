/**
 * Pokes the Vessel drain route. Keep this tiny: no AI, no crawling, no long work here.
 * TODO(NEC-07): wrap with the @sanity/functions handler signature.
 */
export async function kick(): Promise<number> {
  const res = await fetch(`${process.env.VESSEL_URL}/api/ritual/drain`, {
    method: 'POST',
    headers: {authorization: `Bearer ${process.env.DRAIN_SECRET}`},
  })
  return res.status
}
