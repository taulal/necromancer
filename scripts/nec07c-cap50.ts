#!/usr/bin/env bun
/**
 * NEC-07c acceptance: hewahihaumaru cap 50, Sonnet autopsy, App closed.
 * Kick only /api/ritual/drain (must return via:background).
 */
import {getEngine, getWorkflowClient, projectId, dataset} from '@necro/rituals'
import {refDataset} from '@sanity/workflow-engine'

const url = 'https://hewahihaumaru.org.nz'
const slug = `nec07c-cap50-${Date.now().toString(36)}`
const client = getWorkflowClient()
const engine = getEngine()
const base = (process.env.VESSEL_URL || '').replace(/\/$/, '')
const secret = process.env.DRAIN_SECRET || ''

delete process.env.NECRO_AUTOPSY_FAST
const SONNET = 'claude-sonnet-4-5-20250929'
process.env.NECRO_MODEL_REASONING = SONNET
console.log('[cap50] model', process.env.NECRO_MODEL_REASONING)

const seance = await client.create({
  _type: 'seance',
  url,
  slug: {_type: 'slug', current: slug},
  status: 'alive',
  pageCap: 50,
  targetMode: 'dataset',
  targetDataset: 'showcase',
  visibility: 'private',
  replaceTarget: true,
})
console.log('[cap50] seance', seance._id, slug)

const started = await engine.startInstance({
  definition: 'resurrection',
  initialFields: [
    {
      type: 'subject',
      name: 'subject',
      value: refDataset({projectId, dataset, documentId: seance._id, type: 'seance'}),
    },
  ],
})
const instanceId = started.instance._id
console.log('[cap50] instance', instanceId)

await engine.fireAction({instanceId, activity: 'confirm', action: 'begin-exhumation'})
console.log('[cap50] begin-exhumation fired')

async function kick(holder: string) {
  const res = await fetch(`${base}/api/ritual/drain`, {
    method: 'POST',
    headers: {authorization: `Bearer ${secret}`, 'content-type': 'application/json'},
    body: JSON.stringify({mode: 'pending', holder, modelReasoning: SONNET}),
    signal: AbortSignal.timeout(15_000),
  })
  const text = await res.text()
  console.log(`[kick] ${holder} → ${res.status} ${text.slice(0, 160)}`)
  if (!text.includes('"via":"background"') && !text.includes('"skipped":"busy"')) {
    console.warn('[kick] expected via:background — got', text.slice(0, 200))
  }
  return res.status
}

const t0 = Date.now()
const marks: Record<string, {at: number; note?: string}> = {}
function mark(name: string, note?: string) {
  if (marks[name]) return
  marks[name] = {at: Date.now() - t0, note}
  console.log(`[t+${(marks[name].at / 1000).toFixed(1)}s] ${name}${note ? ` — ${note}` : ''}`)
}

await kick('cap50-start')
mark('kicked')

const deadline = Date.now() + 45 * 60 * 1000
let lastKick = Date.now()
let lastStage = ''
let accepted = false

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
    client.fetch<number>(`count(*[_type=="exhumedPage"&&seance._ref==$s])`, {s: seance._id}),
    client.fetch<number>(`count(*[_type=="schemaProposal"&&seance._ref==$s])`, {s: seance._id}),
    client.fetch<number>(`count(*[_type=="question"&&seance._ref==$s])`, {s: seance._id}),
    client.fetch<{phase?: string; holder?: string; at?: string; drained?: number} | null>(
      `*[_id=="necro.drainLog"][0]{phase,holder,at,drained}`,
    ),
    client.fetch<{
      model?: string
      inputTokens?: number
      outputTokens?: number
      repairRounds?: number
      version?: number
    } | null>(
      `*[_type=="schemaProposal"&&seance._ref==$s]|order(version desc)[0]{model,inputTokens,outputTokens,repairRounds,version}`,
      {s: seance._id},
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
    `[t+${((Date.now() - t0) / 1000).toFixed(1)}s] stage=${stage} pending=${inst?.pending} unclaimed=${inst?.unclaimed} claimed=${inst?.claimed} pages=${pages} proposals=${proposals} questions=${questions} log=${log?.phase}@${log?.holder}`,
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
        seanceId: seance._id,
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
