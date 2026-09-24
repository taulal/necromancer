/**
 * Drain worker: claims queued workflow effects and runs them (BRIEF.md §4, §7).
 * Called by the Sanity Function kicker and by the App while it's open.
 * TODO(NEC-07): port sanity-sandbox/src/workflows/{engine,drain,runDrain}.ts against engine 0.35.
 */
export async function POST(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.DRAIN_SECRET}`) {
    return new Response('Unauthorised', {status: 401})
  }
  return Response.json({drained: 0, note: 'not yet implemented'})
}
