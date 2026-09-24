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
 * Child: page-ritual (BRIEF.md §5.2)
 * One instance per target page (fan-out from resurrection.ritual).
 * lifecycle: child — never started on its own.
 *
 *   casting ⇄ reviewing → blessed
 */
export const pageRitual = defineWorkflow({
  name: 'page-ritual',
  title: 'Page ritual',
  lifecycle: 'child',
  initialStage: 'casting',
  roleAliases: {
    reviewer: ['administrator', 'editor'],
  },
  fields: [
    defineField({
      type: 'doc.ref',
      name: 'page',
      required: true,
      initialValue: {type: 'input'},
      // Stand-in until NEC-12 writes target pages into a queryable HQ shape.
      // Fan-out currently keys off exhumedPage rows for the séance.
      types: ['exhumedPage'],
    }),
    defineField({type: 'actor', name: 'reviewer'}),
    defineField({
      type: 'boolean',
      name: 'castFailed',
      // Set when necro.cast fails so reviewing can still open (F5).
    }),
  ],
  stages: [
    defineStage({
      name: 'casting',
      title: 'Casting',
      activities: [
        defineActivity({
          name: 'cast',
          title: 'Run auto tasks for this page',
          actions: [
            defineAction({
              name: 'queue-cast',
              when: 'true',
              effects: [
                {
                  name: EFFECTS.cast,
                  bindings: {page: '$fields.page._id'},
                },
              ],
            }),
            defineAction({
              name: 'cast-done',
              when: `$effectStatus['${EFFECTS.cast}'] == 'done'`,
              status: 'done',
            }),
            defineAction({
              name: 'cast-failed',
              // Mark activity done (not failed) so we can enter reviewing with a flag (F5).
              when: `$effectStatus['${EFFECTS.cast}'] == 'failed'`,
              status: 'done',
              ops: [
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'castFailed'},
                  value: {type: 'literal', value: true},
                },
              ],
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({name: 'to-reviewing', to: 'reviewing', when: '$allActivitiesDone'}),
      ],
    }),

    defineStage({
      name: 'reviewing',
      title: 'Reviewing',
      fields: [
        // Stage-scoped: cleared on each visit so a recast comes back clean.
        defineField({type: 'string', name: 'decision'}),
        defineField({type: 'string', name: 'note'}),
      ],
      guards: [
        defineGuard({
          name: 'freeze-page',
          match: {idRefs: [{type: 'fieldRead', field: 'page'}], actions: ['update']},
          // Soft freeze: block title/meta edits until approve or recast.
          predicate: '!delta::changedAny((title, meta))',
        }),
      ],
      activities: [
        defineActivity({
          name: 'review',
          title: 'Approve or recast',
          actions: [
            defineAction({
              name: 'approve',
              title: 'Bless',
              roles: ['reviewer'],
              status: 'done',
              ops: [
                {
                  type: 'field.set',
                  target: {field: 'decision'},
                  value: {type: 'literal', value: 'approve'},
                },
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'reviewer'},
                  value: {type: 'actor'},
                },
              ],
            }),
            defineAction({
              name: 'recast',
              title: 'Recast',
              roles: ['reviewer'],
              status: 'done',
              ops: [
                {
                  type: 'field.set',
                  target: {field: 'decision'},
                  value: {type: 'literal', value: 'recast'},
                },
              ],
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({
          name: 'to-blessed',
          to: 'blessed',
          when: "$fields.decision == 'approve'",
        }),
        defineTransition({
          name: 'back-to-casting',
          to: 'casting',
          when: "$fields.decision == 'recast'",
        }),
      ],
    }),

    defineStage({name: 'blessed', title: 'Blessed'}),
  ],
})
