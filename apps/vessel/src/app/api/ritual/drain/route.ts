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
  isDrainLockHeld,
  kickDrainBackground,
  releaseDrainLock,
  runDrain,
  summariseDrain,
  tryAcquireDrainLock,
  type DrainMode,
  type DrainRunOutcome,
} from '@necro/rituals'

/** Always read Netlify/runtime env — never bake an empty secret at build. */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type AuthKind = 'secret' | 'kick'

function env(name: string): string {
  return (process.env[name] ?? '').trim()
}

function authorise(req: Request): AuthKind | null {
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return null
  const secret = env('DRAIN_SECRET')
  const kick = env('DRAIN_KICK')
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
  let outcome: DrainRunOutcome | undefined
  try {
    outcome = await runDrain(mode)
    return summariseDrain(outcome)
  } finally {
    await releaseDrainLock(lock.rev)
    if (outcome?.budgetExhausted && outcome.pendingAfter > 0) {
      // Local / after-lock continue (Netlify path uses drain-background's own continue).
      await kickDrainBackground(mode, holder)
    }
  }
}

function backgroundUrl(): string | null {
  const site = env('URL') || env('DEPLOY_PRIME_URL') || env('VESSEL_URL')
  if (!site || !env('NETLIFY')) return null
  // Default Functions v2 URL: drain-background.mts has no custom `config.path` (B2).
  return `${site.replace(/\/$/, '')}/.netlify/functions/drain-background`
}

export async function POST(req: Request) {
  const kind = authorise(req)
  if (!kind) {
    const header = req.headers.get('authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    const secretConfigured = Boolean(env('DRAIN_SECRET'))
    return Response.json(
      {
        error: 'Unauthorised',
        secretConfigured,
        tokenProvided: Boolean(token),
        tokenLen: token.length,
        secretLen: env('DRAIN_SECRET').length,
      },
      {status: 401},
    )
  }

  const mode = await readMode(req.clone(), kind)
  const holder = kind === 'kick' ? 'app-kick' : mode === 'schedule' ? 'schedule' : 'secret-kick'

  // Cheap read first: if a drain holds the lock, don't spend a background invocation.
  if (await isDrainLockHeld()) {
    return Response.json({skipped: 'busy'}, {status: 202})
  }

  const bg = backgroundUrl()
  if (bg) {
    // Netlify Background Function (15 min). It answers 202 at once, so awaiting is
    // cheap, and it guarantees the request leaves before this function is frozen (B1).
    try {
      const res = await fetch(bg, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${env('DRAIN_SECRET')}`,
        },
        body: JSON.stringify({mode, holder}),
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        console.error('[drain] background invoke returned', res.status)
        return Response.json({error: `background ${res.status}`}, {status: 502})
      }
    } catch (err) {
      console.error('[drain] background invoke failed', err)
      return Response.json({error: 'background invoke failed'}, {status: 502})
    }
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
