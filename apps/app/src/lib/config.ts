import type {SanityConfig} from '@sanity/sdk'
import type {WorkflowResource} from '@sanity/workflow-engine'

/** Only non-secret values. Anything prefixed SANITY_APP_ is bundled into the browser. */
export const PROJECT_ID = import.meta.env.SANITY_APP_PROJECT_ID ?? 'v9dl2xdi'
export const HQ_DATASET = import.meta.env.SANITY_APP_HQ_DATASET ?? 'hq'
export const SHOWCASE_DATASET = 'showcase'
export const WORKFLOW_TAG = 'necromancer'

/** Engine + instances live in HQ under the necromancer tag (sanity.workflow.ts). */
export const WORKFLOW_RESOURCE: WorkflowResource = {
  type: 'dataset',
  id: `${PROJECT_ID}.${HQ_DATASET}`,
}

/**
 * HQ first (séances, exhumed pages, workflow instances). Showcase second so the
 * Summon drawer can detect occupancy without a write token.
 */
export const sanityConfigs: SanityConfig[] = [
  {projectId: PROJECT_ID, dataset: HQ_DATASET},
  {projectId: PROJECT_ID, dataset: SHOWCASE_DATASET},
]
