#!/usr/bin/env bun
/**
 * Poll an in-flight NEC-07c cap-50 séance (App closed). Kick via:background only.
 */
import {createClient} from '@sanity/client'
import {getEngine} from '@necro/rituals'

const instanceId = process.argv[2] || 'necromancer.wf-instance.b9c8c7bfa208'
const seanceId = process.argv[3] || 'e2m8kG6gvuYt6cGzurrAFQ'
const SONNET = 'claude-sonnet-4-5-20250929'
const base = (process.env.VESSEL_URL || '').trim().replace(/\/$/, '')
const secret = (process.env.DRAIN_SECRET || '').trim()
if (!base || !secret) {
  console.error('VESSEL_URL and DRAIN_SECRET required')
  process.exit(1)
}

const client = createClient({
  projectId: 'v9dl2xdi',
  dataset: 'hq',
  apiVersion: '2025-03-01',
  token: process.env.SANITY_HQ_WRITE_TOKEN,
  useCdn: false,
})
const engine = getEngine()

const t0 = Date.now()
const marks: Record<string, {at: number; note?: string}> = {}
function mark(name: string, note?: string) {
  if (marks[name]) return
  marks[name] = {at: Date.now() - t0, note}
  console.log(`[t+${(marks[name].at / 1000).toFixed(1)}s] ${name}${note ? ` — ${note}` : ''}`)
}

async function kick(holder: string) {
  const res = await fetch(`${base}/api/ritual/drain`, {
    method: 'POST',
    headers: {authorization: `Bearer ${secret}`, 'content-type': 'application/json'},
    body: JSON.stringify({mode: 'pending', holder, modelReasoning: SONNET}),
    signal: AbortSignal.timeout(15_000),
  })
  const text = await res.text()
  console.log(`[kick] ${holder} → ${res.status} ${text.slice(0, 160)}`)
  return res.status
}

await kick('cap50-poll-start')
mark('kicked')

let lastKick = Date.now()
let lastStage = ''
let accepted = false
const deadline = Date.now() + 45 * 60 * 1000

while (Date.now() < deadline) {
  const [inst, pages, proposals, questions, log, proposal] = await Promise.all([
    client.fetch<{
      currentStage?: string
      pending?: number
      unclaimed?: number
      claimed?: number
    } | null>(
      `*[_id==$id][0]{currentStage,"pending":count(pendingEffects),"unclaimed":count(pendingEffects[!defined(claim)]),"claimed":count(pendingEffects[defined(claim)])}`,
      {id: instanceId},
    ),
    client.fetch<number>(`count(*[_type=="exhumedPage"&&seance._ref==$s])`, {s: seanceId}),
    client.fetch<number>(`count(*[_type=="schemaProposal"&&seance._ref==$s])`, {
      s: seanceId,
    }),
    client.fetch<number>(`count(*[_type=="question"&&seance._ref==$s])`, {s: seanceId}),
    client.fetch<{
      phase?: string
      holder?: string
      at?: string
      modelReasoning?: string
      drained?: number
    } | null>(`*[_id=="necro.drainLog"][0]{phase,holder,at,modelReasoning,drained}`),
    client.fetch<{
      model?: string
      inputTokens?: number
      outputTokens?: number
      repairRounds?: number
      version?: number
    } | null>(
      `*[_type=="schemaProposal"&&seance._ref==$s]|order(version desc)[0]{model,inputTokens,outputTokens,repairRounds,version}`,
      {s: seanceId},
    ),
  ])

  const stage = inst?.currentStage || '?'
  if (stage !== lastStage) {
    mark(`stage:${stage}`)
    lastStage = stage
  }
  if (pages > 0) mark('first-page', `${pages} pages`)
  if (stage !== 'exhuming' && pages > 0) mark('exhume-done', `${pages} pages`)
  if (proposals > 0 && proposal) {
    mark(
      'autopsy-proposal',
      `${proposal.model} in=${proposal.inputTokens} out=${proposal.outputTokens}`,
    )
  }
  if (questions > 0) mark('interrogation-questions', `${questions}`)

  console.log(
    `[t+${((Date.now() - t0) / 1000).toFixed(1)}s] stage=${stage} pending=${inst?.pending} unclaimed=${inst?.unclaimed} claimed=${inst?.claimed} pages=${pages} proposals=${proposals} questions=${questions} log=${log?.phase}@${log?.holder} model=${log?.modelReasoning || '-'}`,
  )

  if (!accepted && stage === 'autopsy' && proposals > 0 && (inst?.pending ?? 0) === 0) {
    accepted = true
    mark('accept-anatomy')
    await engine.fireAction({instanceId, activity: 'accept', action: 'accept-anatomy'})
    await kick('cap50-after-accept')
    lastKick = Date.now()
  }

  if (stage === 'interrogation' && questions > 0 && (inst?.pending ?? 0) === 0) {
    console.log(
      '[DONE]',
      JSON.stringify({
        marks,
        seanceId,
        instanceId,
        pages,
        proposals,
        questions,
        autopsy: proposal,
        elapsedSec: (Date.now() - t0) / 1000,
      }),
    )
    process.exit(0)
  }

  if (stage === 'entombed') {
    console.log('[FAIL entombed]', JSON.stringify({marks, pages, proposals, questions}))
    process.exit(2)
  }

  if ((inst?.unclaimed ?? 0) > 0 && Date.now() - lastKick > 60_000) {
    await kick('cap50-rekick')
    lastKick = Date.now()
  }

  await new Promise((r) => setTimeout(r, 15_000))
}

console.log('[TIMEOUT]', JSON.stringify({marks}))
process.exit(2)
