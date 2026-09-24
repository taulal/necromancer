/** Effect names queued by the workflow and claimed by the Vessel drain worker. */
export const EFFECTS = {
  exhume: 'necro.exhume',
  autopsy: 'necro.autopsy',
  interrogate: 'necro.interrogate',
  reanimate: 'necro.reanimate',
  planRitual: 'necro.plan-ritual',
  cast: 'necro.cast',
  rise: 'necro.rise',
} as const

export type EffectName = (typeof EFFECTS)[keyof typeof EFFECTS]
