/**
 * Sanity Functions for Necromancer (review F1 + NEC-06b).
 * Document kick: only when there is unclaimed pending work.
 * Schedule: tick-all + sweep (Vessel interprets mode=schedule).
 * question-gate: recompute openRequiredQuestions on question changes.
 * Blueprint deploy: NO-GO until Vessel is on Netlify.
 */
import {defineBlueprint, defineDocumentFunction, defineScheduledFunction} from '@sanity/blueprints'

const PROJECT_ID = process.env.SANITY_PROJECT_ID ?? 'v9dl2xdi'
const HQ = process.env.SANITY_HQ_DATASET ?? 'hq'

export default defineBlueprint({
  resources: [
    defineDocumentFunction({
      name: 'question-gate',
      displayName: 'Necromancer question gate',
      timeout: 30,
      memory: 1,
      event: {
        on: ['create', 'update'],
        filter: '_type == "question"',
        resource: {type: 'dataset', id: `${PROJECT_ID}.${HQ}`},
      },
      env: {
        SANITY_PROJECT_ID: PROJECT_ID,
        SANITY_HQ_DATASET: HQ,
        SANITY_WORKFLOW_TAG: process.env.SANITY_WORKFLOW_TAG ?? 'necromancer',
        SANITY_HQ_WRITE_TOKEN: process.env.SANITY_HQ_WRITE_TOKEN ?? '',
      },
    }),
    defineDocumentFunction({
      name: 'drain-kicker',
      displayName: 'Necromancer drain kicker',
      timeout: 30,
      memory: 1,
      event: {
        on: ['create', 'update'],
        // Unclaimed pending effects only (0.35: claim absence = available).
        // Prefer delta when the Functions runtime supports it.
        filter:
          '_type == "sanity.workflow.instance" && tag == "necromancer" && count(pendingEffects[!defined(claim)]) > 0 && delta::changedAny(pendingEffects)',
        resource: {type: 'dataset', id: `${PROJECT_ID}.${HQ}`},
      },
      env: {
        VESSEL_URL: process.env.VESSEL_URL ?? '',
        DRAIN_SECRET: process.env.DRAIN_SECRET ?? '',
      },
    }),
    defineScheduledFunction({
      name: 'drain-kicker-schedule',
      displayName: 'Necromancer drain schedule',
      timeout: 30,
      memory: 1,
      event: {expression: 'every 1 minute'},
      env: {
        VESSEL_URL: process.env.VESSEL_URL ?? '',
        DRAIN_SECRET: process.env.DRAIN_SECRET ?? '',
        DRAIN_MODE: 'schedule',
      },
    }),
  ],
})
