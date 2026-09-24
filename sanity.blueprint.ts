/**
 * Sanity Functions for Necromancer.
 * Blueprint deploy: NO-GO until F1–F3 drain work merges and Vessel is on Netlify.
 * `question-gate` is defined here so it ships with NEC-06b when deploy is approved.
 */
import {defineBlueprint, defineDocumentFunction} from '@sanity/blueprints'

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
  ],
})
