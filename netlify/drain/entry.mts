/**
 * Netlify Background Function body — bundled by `scripts/build-drain-fn.ts`
 * into `netlify/functions/drain-background.js` (CJS, fully inlined deps).
 *
 * Functions v2 Fetch handler. The `-background` filename suffix makes Netlify
 * return 202 immediately and run this for up to 15 minutes.
 */
import {
  getWorkflowClient,
  kickDrainBackground,
  releaseDrainLock,
  runDrain,
  summariseDrain,
  tryAcquireDrainLock,
  type DrainMode,
  type DrainRunOutcome,
} from '@necro/rituals'

const LOG_ID = 'necro.drainLog'

async function writeDrainLog(entry: Record<string, unknown>): Promise<void> {
  try {
    const client = getWorkflowClient()
    await client.createOrReplace({
      _id: LOG_ID,
      _type: 'necro.drainLog',
      at: new Date().toISOString(),
      ...entry,
    })
  } catch (err) {
    console.error('[drain-background] log write failed', err)
  }
}

export default async (req: Request): Promise<Response> => {
  const started = Date.now()
  const secret = process.env.DRAIN_SECRET?.trim()
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!secret || token !== secret) {
    await writeDrainLog({
      phase: 'auth-failed',
      secretConfigured: Boolean(secret),
      tokenProvided: Boolean(token),
      elapsedMs: Date.now() - started,
    })
    return new Response('Unauthorised', {status: 401})
  }

  let mode: DrainMode = 'pending'
  let holder = 'background'
  try {
    const body = (await req.json()) as {
      mode?: DrainMode
      holder?: string
      /** Secret-auth only: pin NECRO_MODEL_REASONING for this drain (and continues). */
      modelReasoning?: string
    }
    if (body.mode === 'schedule' || body.mode === 'pending') mode = body.mode
    if (body.holder) holder = body.holder
    const override = body.modelReasoning?.trim()
    if (override) {
      process.env.NECRO_MODEL_REASONING = override
      delete process.env.NECRO_AUTOPSY_FAST
    }
  } catch {
    /* defaults */
  }

  await writeDrainLog({
    phase: 'start',
    mode,
    holder,
    hasWriteToken: Boolean(process.env.SANITY_HQ_WRITE_TOKEN?.trim()),
    hasAnthropic: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    // Non-secret model ids — acceptance / write-up evidence.
    modelReasoning: process.env.NECRO_MODEL_REASONING?.trim() || null,
    modelFast: process.env.NECRO_MODEL_FAST?.trim() || null,
    autopsyFast: process.env.NECRO_AUTOPSY_FAST === '1',
  })

  const lock = await tryAcquireDrainLock(holder)
  if (!lock.ok) {
    await writeDrainLog({phase: 'busy', mode, holder, elapsedMs: Date.now() - started})
    return Response.json({skipped: 'busy'}, {status: 202})
  }

  let outcome: DrainRunOutcome | undefined
  let response: Response
  try {
    outcome = await runDrain(mode)
    const summary = summariseDrain(outcome)
    await writeDrainLog({
      phase: 'done',
      mode,
      holder,
      ...summary,
      elapsedMs: Date.now() - started,
    })
    response = Response.json(summary)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await writeDrainLog({
      phase: 'error',
      mode,
      holder,
      error: message,
      elapsedMs: Date.now() - started,
    })
    response = Response.json({error: message}, {status: 500})
  } finally {
    await releaseDrainLock(lock.rev)
  }

  if (outcome?.budgetExhausted && outcome.pendingAfter > 0) {
    await kickDrainBackground(mode, holder)
  }

  return response
}

/** Opt out of Netlify re-bundling (Frameworks API). includedFiles keeps the entry. */
export const config = {
  nodeBundler: 'none' as const,
  includedFiles: ['**'],
}
