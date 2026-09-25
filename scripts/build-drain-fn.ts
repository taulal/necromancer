#!/usr/bin/env bun
/**
 * Pre-bundle the Netlify background drain into a single CJS file.
 *
 * Why full CJS, no externals (NEC-07c):
 * - `node_bundler = "none"` ships the file as-is with no npm resolve.
 * - Leaving `@sanity/*` external made the BG crash after Netlify's immediate
 *   202 (no necro.drainLog, never claimed). Bundle everything the worker needs.
 * - Handlers import `@necro/hq-schema/arrayKey` (not the schema barrel) so
 *   `@sanity/icons` / react stay out of this graph.
 *
 * Output: `netlify/functions/drain-background.js` (`-background` → 15 min).
 * `netlify/functions/package.json` forces CJS (repo root is `"type":"module"`).
 */
import * as esbuild from 'esbuild'
import {mkdirSync, unlinkSync, existsSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const entry = join(root, 'netlify/drain/entry.mts')
const outDir = join(root, 'netlify/functions')
const outfile = join(outDir, 'drain-background.js')

mkdirSync(outDir, {recursive: true})

for (const stale of ['drain-background.mjs', 'drain-background.bundle.mjs']) {
  const p = join(outDir, stale)
  if (existsSync(p)) unlinkSync(p)
}

writeFileSync(
  join(outDir, 'package.json'),
  `${JSON.stringify({type: 'commonjs', private: true}, null, 2)}\n`,
)

await esbuild.build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: false,
  packages: 'bundle',
  logOverride: {
    'empty-import-meta': 'silent',
    'direct-eval': 'silent',
  },
})

console.log(`[build-drain-fn] wrote ${outfile}`)
