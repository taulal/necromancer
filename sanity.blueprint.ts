/**
 * Sanity Functions for Necromancer.
 * The Function is the trigger; the Vessel drain route is the muscle (BRIEF.md §4).
 * Deploy with Taylor's go: `bunx sanity blueprints deploy` (not run from this PR).
 */
import {defineBlueprint, defineDocumentFunction, defineScheduledFunction} from '@sanity/blueprints'

const PROJECT_ID = process.env.SANITY_PROJECT_ID ?? 'v9dl2xdi'
const HQ = process.env.SANITY_HQ_DATASET ?? 'hq'

export default defineBlueprint({
  resources: [
    defineDocumentFunction({
      name: 'drain-kicker',
      displayName: 'Necromancer drain kicker',
      timeout: 30,
      memory: 1,
      event: {
        on: ['create', 'update'],
        filter: '_type == "sanity.workflow.instance" && tag == "necromancer"',
        resource: {type: 'dataset', id: `${PROJECT_ID}.${HQ}`},
      },
      env: {
        VESSEL_URL: process.env.VESSEL_URL ?? '',
        DRAIN_SECRET: process.env.DRAIN_SECRET ?? '',
      },
    }),
    // Experimental in blueprints — still the BRIEF §4 safety net when the App is closed.
    defineScheduledFunction({
      name: 'drain-kicker-schedule',
      displayName: 'Necromancer drain schedule',
      timeout: 30,
      memory: 1,
      event: {expression: 'every 1 minute'},
      env: {
        VESSEL_URL: process.env.VESSEL_URL ?? '',
        DRAIN_SECRET: process.env.DRAIN_SECRET ?? '',
      },
    }),
  ],
})
