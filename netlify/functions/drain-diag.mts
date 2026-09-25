/**
 * Sync diagnostic for NEC-07c — returns immediately (not a background fn).
 * Confirms auth + which runtime env keys are present. Does not import
 * `@necro/*` so it works even when the background bundle is broken.
 */
import type {Context} from '@netlify/functions'

export default async (req: Request, _context: Context) => {
  const secret = process.env.DRAIN_SECRET?.trim()
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!secret || token !== secret) {
    return Response.json(
      {
        ok: false,
        error: 'Unauthorised',
        secretConfigured: Boolean(secret),
        tokenProvided: Boolean(token),
      },
      {status: 401},
    )
  }

  return Response.json({
    ok: true,
    env: {
      hasWriteToken: Boolean(process.env.SANITY_HQ_WRITE_TOKEN?.trim()),
      hasAnthropic: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
      projectId: process.env.SANITY_PROJECT_ID ?? null,
      dataset: process.env.SANITY_HQ_DATASET ?? null,
      vesselUrl: process.env.VESSEL_URL ?? process.env.URL ?? null,
      hasBundle: true,
    },
  })
}
