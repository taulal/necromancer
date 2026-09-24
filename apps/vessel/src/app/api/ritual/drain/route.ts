/**
 * Drain worker entry (BRIEF.md §4, review F1–F3).
 *
 * Auth:
 * - `DRAIN_SECRET` (Function / ops): full access; body `{mode:"schedule"}` for tick-all
 * - `DRAIN_KICK` / App `SANITY_APP_DRAIN_KICK`: public-by-design, pending-only, lock-throttled
 *
 * Returns 202 immediately and runs work via Netlify Background Function when
 * available; locally runs after the response is queued.
 */
import {
  releaseDrainLock,
  runDrain,
  summariseDrain,
  tryAcquireDrainLock,
  type DrainMode,
} from '@necro/rituals'

type AuthKind = 'secret' | 'kick'

function authorise(req: Request): AuthKind | null {
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return null
  const secret = process.env.DRAIN_SECRET?.trim()
  const kick = process.env.DRAIN_KICK?.trim()
  if (secret && token === secret) return 'secret'
  if (kick && token === kick) return 'kick'
  return null
}

async function readMode(req: Request, kind: AuthKind): Promise<DrainMode> {
  if (kind === 'kick') return 'pending'
  try {
    const body = (await req.json()) as {mode?: string}
    if (body?.mode === 'schedule') return 'schedule'
  } catch {
    /* no / empty body → pending */
  }
  return 'pending'
}

async function runLocked(mode: DrainMode, holder: string) {
  const lock = await tryAcquireDrainLock(holder)
  if (!lock.ok) {
    return {skipped: 'busy' as const}
  }
  try {
    const results = await runDrain(mode)
    return summariseDrain(results)
  } finally {
    await releaseDrainLock(lock.rev)
  }
}

function backgroundUrl(): string | null {
  const site = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? process.env.VESSEL_URL
  if (!site || !process.env.NETLIFY) return null
  return `${site.replace(/\/$/, '')}/.netlify/functions/drain-background`
}

export async function POST(req: Request) {
  const kind = authorise(req)
  if (!kind) return new Response('Unauthorised', {status: 401})

  const mode = await readMode(req.clone(), kind)
  const holder = kind === 'kick' ? 'app-kick' : mode === 'schedule' ? 'schedule' : 'secret-kick'

  const bg = backgroundUrl()
  if (bg) {
    // Netlify Background Function — 15 min; HTTP returns immediately.
    const secret = process.env.DRAIN_SECRET
    void fetch(bg, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(secret ? {authorization: `Bearer ${secret}`} : {}),
      },
      body: JSON.stringify({mode, holder}),
    }).catch((err) => console.error('[drain] background invoke failed', err))
    return Response.json({accepted: true, mode, via: 'background'}, {status: 202})
  }

  // Local / non-Netlify: accept then run (fire-and-forget after 202 is unreliable
  // on some hosts — await here for correctness in `next dev`).
  try {
    const summary = await runLocked(mode, holder)
    if ('skipped' in summary) {
      return Response.json(summary, {status: 202})
    }
    return Response.json({accepted: true, mode, ...summary}, {status: 202})
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({error: message}, {status: 500})
  }
}
