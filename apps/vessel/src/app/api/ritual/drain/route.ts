/**
 * Drain worker entry (BRIEF.md §4, review F1–F3).
 *
 * Auth:
 * - `DRAIN_SECRET` (Function / ops): full access; body `{mode:"schedule"}` for tick-all
 * - `DRAIN_KICK` / App `SANITY_APP_DRAIN_KICK`: public-by-design, pending-only, lock-throttled
 *
 * Returns 202 immediately. Work runs via Next.js `after()` (keeps the Vessel
 * isolate alive — Netlify's separate `*-background` function was accepting
 * kicks but never executing the handler). Background URL kick remains as a
 * best-effort parallel path after the pre-bundled function lands.
 */
import {after} from 'next/server'
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
/** Autopsy / interrogate can exceed the default serverless cap. */
export const maxDuration = 300

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
  if (!site) return null
  // Next on Netlify sometimes omits NETLIFY=true; URL/DEPLOY_PRIME_URL are reliable.
  const hosted =
    Boolean(env('NETLIFY')) ||
    Boolean(env('URL')) ||
    Boolean(env('DEPLOY_PRIME_URL')) ||
    site.includes('netlify.app')
  if (!hosted) return null
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

  // Cheap read first: if a drain holds the lock, don't start another run.
  if (await isDrainLockHeld()) {
    return Response.json({skipped: 'busy'}, {status: 202})
  }

  // Prefer Next.js `after()` so the Vessel's already-working `@necro/rituals`
  // bundle runs the drain (Netlify `drain-background` was 202-no-op).
  after(async () => {
    try {
      await runLocked(mode, holder)
    } catch (err) {
      console.error('[drain] after() run failed', err)
    }
  })

  // Best-effort parallel kick of the pre-bundled background function (15 min).
  const bg = backgroundUrl()
  if (bg && env('DRAIN_SECRET')) {
    void kickDrainBackground(mode, holder).catch((err) =>
      console.error('[drain] background kick failed', err),
    )
  }

  return Response.json({accepted: true, mode, via: 'after'}, {status: 202})
}
