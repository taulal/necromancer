import type {SanityConfig} from '@sanity/sdk'

/** Only non-secret values. Anything prefixed SANITY_APP_ is bundled into the browser. */
export const PROJECT_ID = import.meta.env.SANITY_APP_PROJECT_ID ?? 'v9dl2xdi'
export const HQ_DATASET = import.meta.env.SANITY_APP_HQ_DATASET ?? 'hq'

/**
 * HQ first. Target datasets (rip-*, showcase) are added at runtime from seance docs —
 * TODO(NEC-04): confirm the SDK pattern for adding resources dynamically vs. up-front.
 */
export const sanityConfigs: SanityConfig[] = [{projectId: PROJECT_ID, dataset: HQ_DATASET}]
