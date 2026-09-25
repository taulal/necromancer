#!/usr/bin/env bun
/**
 * NEC-07c — retry entombed séance, kick Netlify drain via /api/ritual/drain
 * (App closed), poll to interrogation with questions written.
 */
import {getEngine, getWorkflowClient} from '@necro/rituals'

const instanceId = process.argv[2] || 'necromancer.wf-instance.356b93135c5c'
const seanceId = process.argv[3] || 'NUTbHt8Bunvcm3fS8gPQw0'

const engine = getEngine()
const client = getWorkflowClient()
const base = (process.env.VESSEL_URL || '').replace(/\/$/, '')
const secret = process.env.DRAIN_SECRET || ''

async function kick(holder: string) {
  const res = await fetch(`${base}/api/ritual/drain`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({mode: 'pending', holder}),
    signal: AbortSignal.timeout(15_000),
  })
  const text = await res.text()
  console.log(`[kick] ${holder} → ${res.status} ${text.slice(0, 120)}`)
  return res.status
}

const before = await engine.getInstance({instanceId})
console.log(`[retry] stage=${before.currentStage}`)
if (before.currentStage === 'entombed') {
  const from = before.fields?.find((f) => f.name === 'entombedFromStage')?.value
  console.log(`[retry] entombedFromStage=${from}`)
  await engine.fireAction({instanceId, activity: 'retry', action: 'retry-from-entomb'})
  const after = await engine.getInstance({instanceId})
  console.log(`[retry] after → ${after.currentStage} pending=${after.pendingEffects?.length ?? 0}`)
}

const started = Date.now()
const marks: Record<string, number> = {}
function mark(stage: string) {
  if (!marks[stage]) {
    marks[stage] = Date.now() - started
    console.log(`[t+${(marks[stage] / 1000).toFixed(1)}s] entered ${stage}`)
  }
}

await kick('nec07c-accept')
const deadline = Date.now() + 25 * 60 * 1000
let lastKick = Date.now()

while (Date.now() < deadline) {
  const inst = await client.fetch<{
    currentStage?: string
    pending?: number
    unclaimed?: number
    claimed?: number
  } | null>(
    `*[_id==$id][0]{currentStage,"pending":count(pendingEffects),"unclaimed":count(pendingEffects[!defined(claim)]),"claimed":count(pendingEffects[defined(claim)])}`,
    {id: instanceId},
  )
  const stage = inst?.currentStage || '?'
  mark(stage)
  const [pages, proposals, questions, log] = await Promise.all([
    client.fetch<number>(`count(*[_type=="exhumedPage"&&seance._ref==$id])`, {id: seanceId}),
    client.fetch<number>(`count(*[_type=="schemaProposal"&&seance._ref==$id])`, {id: seanceId}),
    client.fetch<number>(`count(*[_type=="question"&&seance._ref==$id])`, {id: seanceId}),
    client.fetch<{phase?: string; holder?: string; at?: string} | null>(
      `*[_id=="necro.drainLog"][0]{phase,holder,at}`,
    ),
  ])
  console.log(
    `[t+${((Date.now() - started) / 1000).toFixed(1)}s] stage=${stage} pending=${inst?.pending} unclaimed=${inst?.unclaimed} claimed=${inst?.claimed} pages=${pages} proposals=${proposals} questions=${questions} log=${log?.phase}@${log?.holder}`,
  )

  if (stage === 'interrogation' && questions > 0 && (inst?.pending ?? 0) === 0) {
    const proposal = await client.fetch<{
      model?: string
      inputTokens?: number
      outputTokens?: number
      version?: number
    } | null>(
      `*[_type=="schemaProposal"&&seance._ref==$id]|order(version desc)[0]{model,inputTokens,outputTokens,version}`,
      {id: seanceId},
    )
    console.log(
      '[DONE]',
      JSON.stringify({
        marks,
        stage,
        pages,
        proposals,
        questions,
        model: proposal?.model,
        inputTokens: proposal?.inputTokens,
        outputTokens: proposal?.outputTokens,
        proposalVersion: proposal?.version,
        elapsedSec: (Date.now() - started) / 1000,
      }),
    )
    process.exit(0)
  }
  if (stage === 'entombed' || stage === 'risen') {
    console.log('[FAIL]', JSON.stringify({marks, stage, pages, proposals, questions}))
    process.exit(2)
  }

  if ((inst?.unclaimed ?? 0) > 0 && Date.now() - lastKick > 45_000) {
    await kick('nec07c-rekick')
    lastKick = Date.now()
  }

  await new Promise((r) => setTimeout(r, 12_000))
}

console.log('[TIMEOUT]', JSON.stringify({marks}))
process.exit(2)
