#!/usr/bin/env bun
/**
 * NEC-08L — create a séance, start resurrection, begin exhumation, drain until autopsy.
 *
 *   bun run summon <url> [--cap 50] [--no-drain] [--replace] [--mode dataset|project]
 *
 * Default target: dataset `showcase` (public). One resurrected site at a time —
 * pass --replace to wipe showcase on reanimate if it already holds another séance.
 * Project mode is stretch (kept in code; not the default).
 */
import {slugFromUrl} from '@necro/hq-schema'
import {
  getEngine,
  getWorkflowClient,
  projectId,
  dataset,
  runDrainAndTickAll,
  tag,
} from '@necro/rituals'
import {refDataset} from '@sanity/workflow-engine'

const SHOWCASE = 'showcase'

function usage(): never {
  console.error(
    'Usage: bun run summon <url> [--cap 50] [--no-drain] [--replace] [--mode dataset|project]',
  )
  process.exit(1)
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2)
  let url: string | undefined
  let cap = 50
  let drain = true
  let replace = false
  let mode: 'dataset' | 'project' = 'dataset'
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!
    if (a === '--cap') {
      cap = Number(args[++i])
      if (!Number.isFinite(cap) || cap < 1) usage()
    } else if (a === '--no-drain') {
      drain = false
    } else if (a === '--replace') {
      replace = true
    } else if (a === '--mode') {
      const m = args[++i]
      if (m !== 'dataset' && m !== 'project') usage()
      mode = m
    } else if (a.startsWith('-')) {
      usage()
    } else if (!url) {
      url = a
    } else {
      usage()
    }
  }
  if (!url) usage()
  try {
    const u = new URL(url.includes('://') ? url : `https://${url}`)
    url = u.toString().replace(/\/$/, '') || u.origin
  } catch {
    console.error(`Invalid URL: ${url}`)
    process.exit(1)
  }
  return {url, cap, drain, replace, mode}
}

async function main() {
  const {url, cap, drain, replace, mode} = parseArgs(process.argv)
  const slug = slugFromUrl(url)
  if (!slug) {
    console.error('Could not derive slug from URL')
    process.exit(1)
  }

  const targetDataset = mode === 'dataset' ? SHOWCASE : undefined
  const visibility = mode === 'dataset' ? 'public' : 'private'
  const client = getWorkflowClient()
  const engine = getEngine()

  console.log(`[summon] ${url}`)
  console.log(
    `[summon] slug=${slug} mode=${mode}` +
      (targetDataset ? ` dataset=${targetDataset}` : '') +
      ` replace=${replace} cap=${cap} project=${projectId} tag=${tag}`,
  )
  if (mode === 'project') {
    console.log(
      '[summon] project mode is stretch — targetProjectId filled at reanimate (not default)',
    )
  }

  const existing = await client.fetch<{_id: string} | null>(
    `*[_type == "seance" && slug.current == $slug][0]{_id}`,
    {slug},
  )
  if (existing) {
    console.error(`[summon] séance already exists for slug "${slug}" (${existing._id}). Abort.`)
    process.exit(1)
  }

  const seance = await client.create({
    _type: 'seance',
    url,
    slug: {current: slug, _type: 'slug'},
    pageCap: cap,
    targetMode: mode,
    ...(targetDataset ? {targetDataset} : {}),
    visibility,
    replaceTarget: replace,
    status: 'alive',
  })
  console.log(`[summon] created seance ${seance._id}`)

  const started = await engine.startInstance({
    definition: 'resurrection',
    initialFields: [
      {
        type: 'subject',
        name: 'subject',
        value: refDataset({
          projectId,
          dataset,
          documentId: seance._id,
          type: 'seance',
        }),
      },
    ],
  })
  const instanceId = started.instance._id
  console.log(`[summon] started resurrection ${instanceId} @ ${started.instance.currentStage}`)

  await engine.fireAction({
    instanceId,
    activity: 'confirm',
    action: 'begin-exhumation',
  })
  console.log(`[summon] fired begin-exhumation`)

  if (!drain) {
    console.log('[summon] --no-drain: kick Vessel / wait for Function yourself')
    return
  }

  const deadline = Date.now() + 25 * 60 * 1000
  let stage = (await engine.getInstance({instanceId})).currentStage
  while (Date.now() < deadline) {
    const summary = await runDrainAndTickAll()
    stage = (await engine.getInstance({instanceId})).currentStage
    const drained = summary.reduce((n, r) => n + r.drained, 0)
    const swept = summary.reduce((n, r) => n + (r.swept || 0), 0)
    const err = summary
      .map((r) => r.error)
      .filter(Boolean)
      .join(' | ')
    const proposals = await client.fetch<number>(
      `count(*[_type == "schemaProposal" && seance._ref == $id])`,
      {id: seance._id},
    )
    console.log(
      `[summon] drain instances=${summary.length} stage=${stage} drained=${drained} swept=${swept} proposals=${proposals}` +
        (err ? ` err=${err}` : ''),
    )
    if (stage === 'entombed' || stage === 'risen') break
    // Autopsy stage means exhume done; keep draining until schemaProposal exists (or we leave autopsy).
    if (stage === 'autopsy' && proposals > 0) break
    if (stage === 'interrogation') break
    if (err && stage === 'exhuming' && drained === 0) {
      console.log(`[summon] drain note: ${err}`)
    }
    if (drained === 0 && swept === 0) {
      await new Promise((r) => setTimeout(r, 1500))
    }
  }

  const seanceNow = await client.fetch<{
    platform?: string
    platformConfidence?: number
    stats?: {pages?: number; images?: number; words?: number; links?: number}
    status?: string
  } | null>(`*[_id == $id][0]{platform, platformConfidence, stats, status}`, {id: seance._id})

  const pages = await client.fetch<number>(
    `count(*[_type == "exhumedPage" && seance._ref == $id])`,
    {id: seance._id},
  )

  console.log('[summon] ── result ──')
  console.log(`  stage:     ${stage}`)
  console.log(
    `  platform:  ${seanceNow?.platform ?? '?'} (${seanceNow?.platformConfidence ?? '?'})`,
  )
  console.log(`  pages:     ${pages}`)
  console.log(`  stats:     ${JSON.stringify(seanceNow?.stats ?? {})}`)
  const proposals = await client.fetch<number>(
    `count(*[_type == "schemaProposal" && seance._ref == $id])`,
    {id: seance._id},
  )
  console.log(`  proposals: ${proposals}`)
  if (stage === 'entombed' || (stage === 'autopsy' && proposals < 1 && pages < 1)) {
    console.error(
      `[summon] expected autopsy with pages+proposal, got stage=${stage} pages=${pages} proposals=${proposals}`,
    )
    process.exit(2)
  }
  if (stage === 'autopsy' && proposals < 1) {
    console.error(`[summon] reached autopsy but no schemaProposal yet`)
    process.exit(2)
  }
}

main().catch((err) => {
  console.error('[summon] failed:', err)
  process.exit(1)
})
