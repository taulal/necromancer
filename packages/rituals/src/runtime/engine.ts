/**
 * Workflow engine wired to HQ + stub effect handlers (BRIEF.md §4).
 * createEngine is lazy so importing the package does not require tokens.
 */
import {createEngine, type Engine, type LoggerFactory} from '@sanity/workflow-engine'
import {dataset, getWorkflowClient, projectId, tag} from './client'
import {effectHandlers} from './handlers'

let cached: Engine | null = null

/**
 * The engine's default logger sends `info` to stderr, which Netlify labels ERROR,
 * so every "[autopsy] wrote schemaProposal" looked like a failure. Info → stdout.
 */
const loggerFactory: LoggerFactory = (name) => ({
  info: (message, extra) => console.log(`[${name}] ${message}`, extra ?? ''),
  warn: (message, extra) => console.warn(`[${name}] ${message}`, extra ?? ''),
  error: (message, extra) => console.error(`[${name}] ${message}`, extra ?? ''),
})

export function getEngine(): Engine {
  if (cached) return cached
  cached = createEngine({
    client: getWorkflowClient(),
    workflowResource: {type: 'dataset', id: `${projectId}.${dataset}`},
    tag,
    effects: {
      handlers: effectHandlers,
      missingHandler: 'fail',
      // ~12 min — above Netlify background (15 min) longest effect budget with headroom for sweep.
      leaseMs: 12 * 60 * 1000,
    },
    executionContext: {kind: 'server', id: 'vessel-drain'},
    loggerFactory,
  })
  return cached
}
