#!/usr/bin/env bun
/**
 * Pre-bundle the Netlify background drain into a single ESM file.
 *
 * Why fully bundled ESM (NEC-07c):
 * - `node_bundler = "none"` has no npm resolve — external `@sanity/*` crashed
 *   the BG after Netlify's immediate 202 (no drainLog / never claimed).
 * - CJS `exports.default` is easy for Netlify's BG loader to miss; ESM
 *   `export default` matches Functions v2 + `-background` Fetch handlers.
 * - Handlers import `@necro/hq-schema/arrayKey` so react/icons stay out.
 *
 * Output: `netlify/functions/drain-background.mjs`
 */
import * as esbuild from 'esbuild'
import {mkdirSync, unlinkSync, existsSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const entry = join(root, 'netlify/drain/entry.mts')
const outDir = join(root, 'netlify/functions')
const outfile = join(outDir, 'drain-background.mjs')

mkdirSync(outDir, {recursive: true})

for (const stale of [
  'drain-background.js',
  'drain-background.bundle.mjs',
  'drain-background.cjs',
]) {
  const p = join(outDir, stale)
  if (existsSync(p)) unlinkSync(p)
}

// ESM package so .mjs is unambiguous; remove CJS package.json if present.
const pkg = join(outDir, 'package.json')
if (existsSync(pkg)) unlinkSync(pkg)

await esbuild.build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: false,
  packages: 'bundle',
  banner: {
    js: `import {createRequire as __necroCreateRequire} from 'node:module';
import {fileURLToPath as __necroFileURLToPath} from 'node:url';
import {dirname as __necroDirname} from 'node:path';
const require = __necroCreateRequire(import.meta.url);
const __filename = __necroFileURLToPath(import.meta.url);
const __dirname = __necroDirname(__filename);
`,
  },
  logOverride: {
    'empty-import-meta': 'silent',
    'direct-eval': 'silent',
  },
})

console.log(`[build-drain-fn] wrote ${outfile}`)
