/**
 * Stub effect handlers for NEC-07. Real work lands in later tickets.
 * Progress is throttled (review F1): ≥10pp or ≥3s between reports.
 */
import type {EffectHandler} from '@sanity/workflow-engine'
import {EFFECTS} from '../effects/names'
import {asDocumentId} from './refId'
import {createProgressThrottle} from './progressThrottle'

const stub =
  (label: string): EffectHandler =>
  async (params, ctx) => {
    const seance = params.seance != null ? asDocumentId(params.seance) : undefined
    const page = params.page != null ? asDocumentId(params.page) : undefined
    const progress = createProgressThrottle((field, value) => ctx.setProgress(field, value))
    try {
      await progress(15)
      await new Promise((r) => setTimeout(r, 50))
      await progress(100)
    } catch {
      /* progress field only exists on the parent; child casts may lack it */
    }
    ctx.log(`[stub] ${label}`, {seance, page})
  }

/** Every effect name the definitions queue — stubs until their ticket lands. */
export const effectHandlers: Record<string, EffectHandler> = {
  [EFFECTS.exhume]: stub('necro.exhume'),
  [EFFECTS.autopsy]: stub('necro.autopsy'),
  [EFFECTS.autopsyRerun]: stub('necro.autopsy-rerun'),
  [EFFECTS.interrogate]: stub('necro.interrogate'),
  [EFFECTS.reanimate]: stub('necro.reanimate'),
  [EFFECTS.planRitual]: stub('necro.plan-ritual'),
  [EFFECTS.cast]: stub('necro.cast'),
  [EFFECTS.rise]: stub('necro.rise'),
}
