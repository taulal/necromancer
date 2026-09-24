import {
  defineAction,
  defineActivity,
  defineField,
  defineGuard,
  defineStage,
  defineTransition,
  defineWorkflow,
} from '@sanity/workflow-engine/define'
import {EFFECTS} from '../effects/names'

/**
 * Parent: resurrection (BRIEF.md §5.1)
 * Subject: one seance document. singleSubject — one open run per séance.
 *
 *   summoned → exhuming → autopsy → interrogation → reanimating → ritual → risen
 *                  └─(failed)──────────────────────────────────────────▶ entombed
 *
 * SLA: if interrogation sits past interrogationDeadline, set haunted flag
 * (workflow field only — no stage change). App/Graveyard can mirror onto seance.status.
 */
export const resurrection = defineWorkflow({
  name: 'resurrection',
  title: 'Resurrection',
  initialStage: 'summoned',
  start: {
    requirements: [{type: 'singleSubject', name: 'one-open-run'}],
  },
  roleAliases: {
    editor: ['administrator', 'editor'],
  },
  fields: [
    defineField({
      type: 'subject',
      name: 'subject',
      required: true,
      initialValue: {type: 'input'},
      types: ['seance'],
    }),
    defineField({
      type: 'progress',
      name: 'exhumeProgress',
      // Driven by necro.exhume via ctx.setProgress in the drain worker.
    }),
    defineField({
      type: 'datetime',
      name: 'interrogationDeadline',
      // Set when necro.interrogate completes (handler or bench ops). 48h SLA.
    }),
    defineField({
      type: 'boolean',
      name: 'haunted',
      // Flag only — SLA breach does not change stage.
    }),
    defineField({
      type: 'number',
      name: 'openRequiredQuestions',
      // System / interrogate completion / question-gate write this (F4).
      // Not listed for `editor` — App must not decrement it.
      editable: ['administrator'],
    }),
    defineField({
      type: 'boolean',
      name: 'riseFailed',
      // Set when necro.rise fails; retry-rise clears it (F5).
    }),
    defineField({
      type: 'boolean',
      name: 'anatomyAccepted',
      // Human Accept anatomy sets this; cascade finalize waits for rerun (F6).
    }),
    defineField({
      type: 'boolean',
      name: 'autopsyRerunBusy',
      // True while necro.autopsy-rerun is in flight (F6). Human `when` is illegal.
    }),
    defineField({
      type: 'string',
      name: 'entombedFromStage',
      // Set by *-failed actions before the to-entombed transition. Retry reads it.
    }),
    defineField({
      type: 'boolean',
      name: 'retryFromEntomb',
      // Human Retry on entombed; transitions back to entombedFromStage.
    }),
  ],
  stages: [
    /* ---------- summoned ---------- */
    defineStage({
      name: 'summoned',
      title: 'Summoned',
      activities: [
        defineActivity({
          name: 'confirm',
          title: 'Confirm URL, page cap and target, then begin',
          actions: [
            defineAction({
              name: 'begin-exhumation',
              title: 'Begin exhumation',
              roles: ['editor'],
              status: 'done',
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({name: 'to-exhuming', to: 'exhuming', when: '$allActivitiesDone'}),
      ],
    }),

    /* ---------- exhuming ---------- */
    defineStage({
      name: 'exhuming',
      title: 'Exhuming',
      activities: [
        defineActivity({
          name: 'exhume',
          actions: [
            defineAction({
              name: 'queue-exhume',
              when: 'true',
              effects: [
                {
                  name: EFFECTS.exhume,
                  bindings: {seance: '$fields.subject._id'},
                },
              ],
            }),
            defineAction({
              name: 'exhume-done',
              when: `$effectStatus['${EFFECTS.exhume}'] == 'done'`,
              status: 'done',
            }),
            defineAction({
              name: 'exhume-failed',
              when: `$effectStatus['${EFFECTS.exhume}'] == 'failed'`,
              status: 'failed',
              ops: [
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'entombedFromStage'},
                  value: {type: 'literal', value: 'exhuming'},
                },
              ],
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({name: 'to-autopsy', to: 'autopsy', when: '$allActivitiesDone'}),
        defineTransition({name: 'to-entombed', to: 'entombed', when: '$anyActivityFailed'}),
      ],
    }),

    /* ---------- autopsy ---------- */
    defineStage({
      name: 'autopsy',
      title: 'Autopsy',
      activities: [
        defineActivity({
          name: 'infer',
          actions: [
            defineAction({
              name: 'queue-autopsy',
              when: 'true',
              effects: [
                {
                  name: EFFECTS.autopsy,
                  bindings: {seance: '$fields.subject._id'},
                },
              ],
            }),
            defineAction({
              name: 'autopsy-done',
              when: `$effectStatus['${EFFECTS.autopsy}'] == 'done'`,
              status: 'done',
            }),
            defineAction({
              name: 'autopsy-failed',
              when: `$effectStatus['${EFFECTS.autopsy}'] == 'failed'`,
              status: 'failed',
              ops: [
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'entombedFromStage'},
                  value: {type: 'literal', value: 'autopsy'},
                },
              ],
            }),
          ],
        }),
        defineActivity({
          name: 'accept',
          title: 'Review the proposal, then accept anatomy',
          actions: [
            defineAction({
              name: 'accept-anatomy',
              title: 'Accept anatomy',
              roles: ['editor'],
              // Human button — no `when` (would cascade-fire). Flag only (F6).
              ops: [
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'anatomyAccepted'},
                  value: {type: 'literal', value: true},
                },
              ],
            }),
            defineAction({
              name: 'accept-ready',
              // Finalize only when Accept was clicked AND no autopsy re-run is in flight (F6).
              when: '$fields.anatomyAccepted == true && !($fields.autopsyRerunBusy == true)',
              status: 'done',
            }),
            defineAction({
              name: 'rerun-autopsy',
              title: 'Re-run autopsy',
              roles: ['editor'],
              ops: [
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'anatomyAccepted'},
                  value: {type: 'literal', value: false},
                },
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'autopsyRerunBusy'},
                  value: {type: 'literal', value: true},
                },
              ],
              effects: [
                {
                  name: EFFECTS.autopsyRerun,
                  bindings: {seance: '$fields.subject._id'},
                },
              ],
            }),
            defineAction({
              name: 'clear-rerun-busy',
              when: `$effectStatus['${EFFECTS.autopsyRerun}'] == 'done' || $effectStatus['${EFFECTS.autopsyRerun}'] == 'failed'`,
              ops: [
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'autopsyRerunBusy'},
                  value: {type: 'literal', value: false},
                },
              ],
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({
          name: 'to-interrogation',
          to: 'interrogation',
          when: '$allActivitiesDone',
        }),
        defineTransition({name: 'to-entombed', to: 'entombed', when: '$anyActivityFailed'}),
      ],
    }),

    /* ---------- interrogation ---------- */
    defineStage({
      name: 'interrogation',
      title: 'Interrogation',
      activities: [
        defineActivity({
          name: 'interrogate',
          actions: [
            defineAction({
              name: 'queue-interrogate',
              when: 'true',
              effects: [
                {
                  name: EFFECTS.interrogate,
                  bindings: {seance: '$fields.subject._id'},
                },
              ],
            }),
            defineAction({
              name: 'questions-resolved',
              // Effect must finish first; openRequiredQuestions is maintained by
              // the interrogate handler + App as answers land (no lake scan in when).
              when: `$effectStatus['${EFFECTS.interrogate}'] == 'done' && coalesce($fields.openRequiredQuestions, 0) == 0`,
              status: 'done',
            }),
            defineAction({
              name: 'interrogate-failed',
              when: `$effectStatus['${EFFECTS.interrogate}'] == 'failed'`,
              status: 'failed',
              ops: [
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'entombedFromStage'},
                  value: {type: 'literal', value: 'interrogation'},
                },
              ],
            }),
            // SLA: flag haunted, do not change stage.
            defineAction({
              name: 'flag-haunted',
              when: 'defined($fields.interrogationDeadline) && $fields.interrogationDeadline <= $now && !($fields.haunted == true)',
              ops: [
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'haunted'},
                  value: {type: 'literal', value: true},
                },
              ],
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({
          name: 'to-reanimating',
          to: 'reanimating',
          when: '$allActivitiesDone',
        }),
        defineTransition({name: 'to-entombed', to: 'entombed', when: '$anyActivityFailed'}),
      ],
    }),

    /* ---------- reanimating ---------- */
    defineStage({
      name: 'reanimating',
      title: 'Reanimating',
      activities: [
        defineActivity({
          name: 'reanimate',
          actions: [
            defineAction({
              name: 'queue-reanimate',
              when: 'true',
              effects: [
                {
                  name: EFFECTS.reanimate,
                  bindings: {seance: '$fields.subject._id'},
                },
              ],
            }),
            defineAction({
              name: 'reanimate-done',
              when: `$effectStatus['${EFFECTS.reanimate}'] == 'done'`,
              status: 'done',
            }),
            defineAction({
              name: 'reanimate-failed',
              when: `$effectStatus['${EFFECTS.reanimate}'] == 'failed'`,
              status: 'failed',
              ops: [
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'entombedFromStage'},
                  value: {type: 'literal', value: 'reanimating'},
                },
              ],
            }),
          ],
        }),
        defineActivity({
          name: 'plan',
          actions: [
            defineAction({
              name: 'queue-plan-ritual',
              when: `$effectStatus['${EFFECTS.reanimate}'] == 'done'`,
              effects: [
                {
                  name: EFFECTS.planRitual,
                  bindings: {seance: '$fields.subject._id'},
                },
              ],
            }),
            defineAction({
              name: 'plan-done',
              when: `$effectStatus['${EFFECTS.planRitual}'] == 'done'`,
              status: 'done',
            }),
            defineAction({
              name: 'plan-failed',
              when: `$effectStatus['${EFFECTS.planRitual}'] == 'failed'`,
              status: 'failed',
              ops: [
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'entombedFromStage'},
                  value: {type: 'literal', value: 'reanimating'},
                },
              ],
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({name: 'to-ritual', to: 'ritual', when: '$allActivitiesDone'}),
        defineTransition({name: 'to-entombed', to: 'entombed', when: '$anyActivityFailed'}),
      ],
    }),

    /* ---------- ritual (fan-out) ---------- */
    defineStage({
      name: 'ritual',
      title: 'Ritual',
      guards: [
        defineGuard({
          name: 'freeze-seance',
          match: {idRefs: [{type: 'fieldRead', field: 'subject'}], actions: ['update']},
          predicate: '!delta::changedAny((url, slug, targetDataset, targetMode))',
        }),
      ],
      activities: [
        defineActivity({
          name: 'page-rituals',
          actions: [
            defineAction({
              name: 'fan-out',
              when: 'true',
              spawn: {
                // Stand-in: one child per exhumed page until NEC-12 has target pages in HQ.
                forEach: "*[_type == 'exhumedPage' && seance._ref == $fields.subject._id]",
                definition: {name: 'page-ritual'},
                with: {page: '{"id": $row._id, "type": "exhumedPage"}'},
                onExit: 'abort',
              },
            }),
            defineAction({
              name: 'all-settled',
              // F5: zero children is done. F6: every current child must be blessed
              // (failed/aborted no longer count as settled for Rise).
              when: "count($subworkflows[activity == 'page-rituals' && current]) == 0 || (count($subworkflows[activity == 'page-rituals' && current && status == 'active']) == 0 && count($subworkflows[activity == 'page-rituals' && current && stage != 'blessed']) == 0)",
              status: 'done',
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({name: 'to-rising', to: 'rising', when: '$allActivitiesDone'}),
      ],
    }),

    /* ---------- rising (Rise button; cannot live on terminal risen) ---------- */
    defineStage({
      name: 'rising',
      title: 'Rise',
      activities: [
        defineActivity({
          name: 'publish',
          title: 'Preview the release, then Rise',
          actions: [
            defineAction({
              name: 'rise',
              title: 'Rise',
              roles: ['editor'],
              // Human button — no `when` (cascade). App hides while riseFailed.
              effects: [
                {
                  name: EFFECTS.rise,
                  bindings: {seance: '$fields.subject._id'},
                },
              ],
            }),
            defineAction({
              name: 'rise-done',
              when: `$effectStatus['${EFFECTS.rise}'] == 'done'`,
              status: 'done',
            }),
            defineAction({
              name: 'rise-failed',
              when: `$effectStatus['${EFFECTS.rise}'] == 'failed'`,
              ops: [
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'riseFailed'},
                  value: {type: 'literal', value: true},
                },
              ],
            }),
            defineAction({
              name: 'retry-rise',
              title: 'Retry Rise',
              roles: ['editor'],
              // Human button; App only shows when riseFailed.
              ops: [
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'riseFailed'},
                  value: {type: 'literal', value: false},
                },
              ],
              effects: [
                {
                  name: EFFECTS.riseRetry,
                  bindings: {seance: '$fields.subject._id'},
                },
              ],
            }),
            defineAction({
              name: 'rise-retry-done',
              when: `$effectStatus['${EFFECTS.riseRetry}'] == 'done'`,
              status: 'done',
            }),
            defineAction({
              name: 'rise-retry-failed',
              when: `$effectStatus['${EFFECTS.riseRetry}'] == 'failed'`,
              ops: [
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'riseFailed'},
                  value: {type: 'literal', value: true},
                },
              ],
            }),
            defineAction({
              name: 'entomb-rise',
              title: 'Entomb',
              roles: ['editor'],
              status: 'failed',
              ops: [
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'entombedFromStage'},
                  value: {type: 'literal', value: 'rising'},
                },
              ],
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({name: 'to-risen', to: 'risen', when: '$allActivitiesDone'}),
        defineTransition({name: 'to-entombed', to: 'entombed', when: '$anyActivityFailed'}),
      ],
    }),

    /* ---------- risen (terminal) ---------- */
    defineStage({name: 'risen', title: 'Risen'}),

    /* ---------- entombed (off-ramp; Retry returns to the stage that failed) ---------- */
    defineStage({
      name: 'entombed',
      title: 'Entombed',
      activities: [
        defineActivity({
          name: 'retry',
          title: 'Retry from the stage that failed',
          actions: [
            defineAction({
              name: 'enter-entombed',
              when: 'true',
              ops: [
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'retryFromEntomb'},
                  value: {type: 'literal', value: false},
                },
              ],
            }),
            defineAction({
              name: 'retry-from-entomb',
              title: 'Retry',
              roles: ['editor'],
              ops: [
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'retryFromEntomb'},
                  value: {type: 'literal', value: true},
                },
              ],
            }),
            defineAction({
              name: 'retry-acked',
              when: '$fields.retryFromEntomb == true',
              status: 'done',
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({
          name: 'retry-to-exhuming',
          to: 'exhuming',
          when: '$fields.retryFromEntomb == true && $fields.entombedFromStage == "exhuming"',
        }),
        defineTransition({
          name: 'retry-to-autopsy',
          to: 'autopsy',
          when: '$fields.retryFromEntomb == true && $fields.entombedFromStage == "autopsy"',
        }),
        defineTransition({
          name: 'retry-to-interrogation',
          to: 'interrogation',
          when: '$fields.retryFromEntomb == true && $fields.entombedFromStage == "interrogation"',
        }),
        defineTransition({
          name: 'retry-to-reanimating',
          to: 'reanimating',
          when: '$fields.retryFromEntomb == true && $fields.entombedFromStage == "reanimating"',
        }),
        defineTransition({
          name: 'retry-to-ritual',
          to: 'ritual',
          when: '$fields.retryFromEntomb == true && $fields.entombedFromStage == "ritual"',
        }),
        defineTransition({
          name: 'retry-to-rising',
          to: 'rising',
          when: '$fields.retryFromEntomb == true && $fields.entombedFromStage == "rising"',
        }),
      ],
    }),
  ],
})
