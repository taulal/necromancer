/**
 * Shared Sanity client for the workflow engine + effect handlers.
 * Lazy: importing this module must not throw when tokens are absent
 * (Vessel cold-start / typecheck). Call `getWorkflowClient()` at request time.
 */
import {createClient, type SanityClient} from '@sanity/client'
import {ENGINE_API_VERSION} from '@sanity/workflow-engine'

export const projectId = process.env.SANITY_PROJECT_ID ?? 'v9dl2xdi'
export const dataset = process.env.SANITY_HQ_DATASET ?? 'hq'
export const tag = process.env.SANITY_WORKFLOW_TAG ?? 'necromancer'

let cached: SanityClient | null = null

export function getWorkflowClient(): SanityClient {
  if (cached) return cached
  const token = process.env.SANITY_HQ_WRITE_TOKEN?.trim()
  if (!token) {
    throw new Error('SANITY_HQ_WRITE_TOKEN is required to drain workflow effects')
  }
  cached = createClient({
    projectId,
    dataset,
    apiVersion: ENGINE_API_VERSION,
    token,
    useCdn: false,
    perspective: 'raw',
  })
  return cached
}
