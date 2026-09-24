import {existsSync, readFileSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {defineCliConfig} from 'sanity/cli'

/**
 * Load repo-root `.env` into `process.env`.
 * File wins over a stale shell export (same class of gotcha as glued token comments).
 */
function loadRootEnv(): void {
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env')
  if (!existsSync(envPath)) return
  for (const raw of readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

loadRootEnv()

const organizationId = process.env.SANITY_ORG_ID?.trim()
if (!organizationId) {
  throw new Error(
    'SANITY_ORG_ID is missing. Set it in the repo-root .env (see .env.example) before running the App CLI.',
  )
}

export default defineCliConfig({
  app: {
    organizationId,
    entry: './src/App.tsx',
    title: 'Necromancer',
  },
  // First deploy: `bun run deploy -- --create --title "Necromancer" --yes --json`,
  // then save application.id here as deployment.appId and drop --create.
  // deployment: {appId: ''},
})
