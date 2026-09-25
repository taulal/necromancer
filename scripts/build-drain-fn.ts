#!/usr/bin/env bun
/**
 * Pre-bundle the Netlify background drain so deploy-time esbuild does not have
 * to resolve source-only `@necro/*` workspace exports (NEC-07c B3).
 *
 * Writes `netlify/functions/drain-background.mjs` (the `-background` suffix
 * gives the 15-minute limit). Source: `netlify/drain/entry.mts`.
 */
import * as esbuild from 'esbuild'
import {mkdirSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const entry = join(root, 'netlify/drain/entry.mts')
const outfile = join(root, 'netlify/functions/drain-background.mjs')

mkdirSync(dirname(outfile), {recursive: true})

await esbuild.build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: false,
  external: ['@sanity/client', '@sanity/workflow-engine'],
  logOverride: {
    'empty-import-meta': 'silent',
    'direct-eval': 'silent',
  },
  banner: {
    js: `import {createRequire as __necroCreateRequire} from 'node:module';
import {fileURLToPath as __necroFileURLToPath} from 'node:url';
import {dirname as __necroDirname} from 'node:path';
const require = __necroCreateRequire(import.meta.url);
const __filename = __necroFileURLToPath(import.meta.url);
const __dirname = __necroDirname(__filename);
`,
  },
})

console.log(`[build-drain-fn] wrote ${outfile}`)
