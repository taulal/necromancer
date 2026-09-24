/**
 * Sanity Functions for Necromancer. The Function is the trigger; the Vessel drain route is the muscle.
 * TODO(NEC-07): confirm current @sanity/blueprints API (defineBlueprint / defineDocumentFunction /
 * scheduled trigger) against docs before deploying — this file is a placeholder shape.
 */
export default {
  resources: [
    // drain-kicker: on workflow instance create/update in hq (tag necromancer) + every minute
  ],
}
