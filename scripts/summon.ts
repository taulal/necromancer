#!/usr/bin/env bun
/**
 * NEC-08L — create a séance, start resurrection, begin exhumation, drain until autopsy.
 *
 *   bun run summon https://pnjbuild.co.nz [--cap 50] [--no-drain]
 */
import {slugFromUrl} from '@necro/hq-schema'
import {getEngine, getWorkflowClient, projectId, runDrain, tag} from '@necro/rituals'

function usage(): never {
  console.error('Usage: bun run summon <url> [--cap 50] [--no-drain]')
  process.exit(1)
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2)
  let url: string | undefined
  let cap = 50
  let drain = true
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!
    if (a === '--cap') {
      cap = Number(args[++i])
      if (!Number.isFinite(cap) || cap < 1) usage()
    } else if (a === '--no-drain') {
      drain = false
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
  return {url, cap, drain}
}

async function main() {
  const {url, cap, drain} = parseArgs(process.argv)
  const slug = slugFromUrl(url)
  if (!slug) {
    console.error('Could not derive slug from URL')
    process.exit(1)
  }
  const targetDataset = `rip-${slug}`
  const client = getWorkflowClient()
  const engine = getEngine()

  console.log(`[summon] ${url}`)
  console.log(
    `[summon] slug=${slug} dataset=${targetDataset} cap=${cap} project=${projectId} tag=${tag}`,
  )

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
    targetMode: 'dataset',
    targetDataset,
    visibility: 'private',
    status: 'alive',
  })
  console.log(`[summon] created seance ${seance._id}`)

  const started = await engine.startInstance({
    definition: 'resurrection',
    initialFields: [
      {
        type: 'subject',
        name: 'subject',
        value: {id: seance._id, type: 'seance'},
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

  const deadline = Date.now() + 15 * 60 * 1000
  let stage = (await engine.getInstance({instanceId})).currentStage
  while (Date.now() < deadline) {
    const summary = await runDrain('pending')
    stage = (await engine.getInstance({instanceId})).currentStage
    console.log(
      `[summon] drain instances=${summary.length} stage=${stage} drained=${summary.reduce((n, r) => n + r.drained, 0)}`,
    )
    if (stage === 'autopsy' || stage === 'entombed' || stage === 'risen') break
    if (summary.every((r) => r.drained === 0 && !r.error)) {
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
  console.log(`  status:    ${seanceNow?.status ?? '?'}`)
  if (stage !== 'autopsy') {
    console.error(`[summon] expected autopsy, got ${stage}`)
    process.exit(2)
  }
}

main().catch((err) => {
  console.error('[summon] failed:', err)
  process.exit(1)
})
