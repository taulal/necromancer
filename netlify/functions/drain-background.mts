/**
 * Netlify Background Function — up to 15 minutes (review F2).
 * Invoked by `/api/ritual/drain` after auth; does the lock + drain work.
 * Loops pending work inside the lock; if the time budget expires with work
 * still queued, releases the lock then self-invokes so the chain continues.
 */
import type {Context} from '@netlify/functions'
import {
  kickDrainBackground,
  releaseDrainLock,
  runDrain,
  summariseDrain,
  tryAcquireDrainLock,
  type DrainMode,
  type DrainRunOutcome,
} from '@necro/rituals'

export default async (req: Request, _context: Context) => {
  const secret = process.env.DRAIN_SECRET?.trim()
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!secret || token !== secret) {
    return new Response('Unauthorised', {status: 401})
  }

  let mode: DrainMode = 'pending'
  let holder = 'background'
  try {
    const body = (await req.json()) as {mode?: DrainMode; holder?: string}
    if (body.mode === 'schedule' || body.mode === 'pending') mode = body.mode
    if (body.holder) holder = body.holder
  } catch {
    /* defaults */
  }

  const lock = await tryAcquireDrainLock(holder)
  if (!lock.ok) {
    return Response.json({skipped: 'busy'}, {status: 202})
  }

  let outcome: DrainRunOutcome | undefined
  let response: Response
  try {
    outcome = await runDrain(mode)
    response = Response.json(summariseDrain(outcome))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    response = Response.json({error: message}, {status: 500})
  } finally {
    await releaseDrainLock(lock.rev)
  }

  if (outcome?.budgetExhausted && outcome.pendingAfter > 0) {
    await kickDrainBackground(mode, holder)
  }

  return response
}

// No `config.path` on purpose (B2): the Vessel route calls the default
// /.netlify/functions/drain-background URL, and the `-background` filename suffix is
// what makes this a 15-minute background function.
