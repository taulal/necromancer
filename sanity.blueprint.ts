/**
 * Sanity Functions for Necromancer (review F1 + NEC-06b / NEC-07c).
 * Document kick: only when there is unclaimed pending work.
 * Schedule: tick-all + sweep (Vessel interprets mode=schedule).
 * question-gate: recompute openRequiredQuestions on question changes.
 *
 * Stack is org-scoped (scheduled Functions require it). Document Functions
 * therefore need an explicit `project`. Growth plan caps cron at hourly —
 * was `every 1 minute` in the brief; Vessel schedule mode still does a full
 * tick when kicked.
 */
import {defineBlueprint, defineDocumentFunction, defineScheduledFunction} from '@sanity/blueprints'

const PROJECT_ID = process.env.SANITY_PROJECT_ID ?? 'v9dl2xdi'
const HQ = process.env.SANITY_HQ_DATASET ?? 'hq'

export default defineBlueprint({
  resources: [
    defineDocumentFunction({
      name: 'question-gate',
      displayName: 'Necromancer question gate',
      project: PROJECT_ID,
      timeout: 30,
      memory: 1,
      event: {
        // delete too (B7): removing an open required question must lower the count.
        on: ['create', 'update', 'delete'],
        filter: '_type == "question"',
        // The App SDK writes answers to drafts, so draft edits must trigger the recount.
        includeDrafts: true,
        projection:
          '{"seance": coalesce(after().seance, before().seance), "required": coalesce(after().required, before().required)}',
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
      project: PROJECT_ID,
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
      // Growth plan: hourly max (not every minute). Document kick still covers live work.
      event: {expression: '0 * * * *'},
      env: {
        VESSEL_URL: process.env.VESSEL_URL ?? '',
        DRAIN_SECRET: process.env.DRAIN_SECRET ?? '',
        DRAIN_MODE: 'schedule',
      },
    }),
  ],
})
