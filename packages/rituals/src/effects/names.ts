/** Effect names queued by the workflow and claimed by the Vessel drain worker. */
export const EFFECTS = {
  exhume: 'necro.exhume',
  autopsy: 'necro.autopsy',
  /** Engine 0.35: effect names are unique per definition — re-run needs its own key. Same handler as autopsy. */
  autopsyRerun: 'necro.autopsy-rerun',
  interrogate: 'necro.interrogate',
  reanimate: 'necro.reanimate',
  planRitual: 'necro.plan-ritual',
  cast: 'necro.cast',
  rise: 'necro.rise',
} as const

export type EffectName = (typeof EFFECTS)[keyof typeof EFFECTS]
