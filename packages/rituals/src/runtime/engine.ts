/**
 * Workflow engine wired to HQ + stub effect handlers (BRIEF.md §4).
 * createEngine is lazy so importing the package does not require tokens.
 */
import {createEngine, type Engine} from '@sanity/workflow-engine'
import {dataset, getWorkflowClient, projectId, tag} from './client'
import {effectHandlers} from './handlers'

let cached: Engine | null = null

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
  })
  return cached
}
