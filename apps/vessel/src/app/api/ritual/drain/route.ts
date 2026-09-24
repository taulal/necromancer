/**
 * Drain worker: claims queued workflow effects and runs them (BRIEF.md §4).
 * Called by the Sanity Function kicker and by the App while a séance is open.
 */
import {runDrainAndTickAll, summariseDrain} from '@necro/rituals'

function authorised(req: Request): boolean {
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const secret = process.env.DRAIN_SECRET?.trim()
  const kick = process.env.DRAIN_KICK?.trim()
  if (!token) return false
  if (secret && token === secret) return true
  // Optional low-privilege kick passphrase for the App (SANITY_APP_DRAIN_KICK).
  if (kick && token === kick) return true
  return false
}

export async function POST(req: Request) {
  if (!authorised(req)) {
    return new Response('Unauthorised', {status: 401})
  }

  try {
    const results = await runDrainAndTickAll()
    return Response.json(summariseDrain(results))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({error: message}, {status: 500})
  }
}
