/**
 * Netlify Background Function — up to 15 minutes (review F2).
 * Invoked by `/api/ritual/drain` after auth; does the lock + drain work.
 */
import type {Config, Context} from '@netlify/functions'
import {
  releaseDrainLock,
  runDrain,
  summariseDrain,
  tryAcquireDrainLock,
  type DrainMode,
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

  try {
    const results = await runDrain(mode)
    return Response.json(summariseDrain(results))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({error: message}, {status: 500})
  } finally {
    await releaseDrainLock(lock.rev)
  }
}

export const config: Config = {
  path: '/drain-background',
}
