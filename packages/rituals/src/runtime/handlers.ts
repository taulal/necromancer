/**
 * Effect handlers. Progress throttle (review F1) applies to stubs;
 * exhume uses its own onProgress path (also throttled in NEC-08 fixes).
 */
import type {EffectHandler} from '@sanity/workflow-engine'
import {EFFECTS} from '../effects/names'
import {asDocumentId} from './refId'
import {createProgressThrottle} from './progressThrottle'
import {autopsyHandler} from './autopsyHandler'
import {exhumeHandler} from './exhumeHandler'
import {interrogateHandler} from './interrogateHandler'
import {reanimateHandler} from './reanimateHandler'

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
      /* child casts may lack progress field */
    }
    ctx.log(`[stub] ${label}`, {seance, page})
  }

/** Real exhume, autopsy, interrogate, and showcase-gated reanimate; stubs for the rest. */
export const effectHandlers: Record<string, EffectHandler> = {
  [EFFECTS.exhume]: exhumeHandler,
  [EFFECTS.autopsy]: autopsyHandler,
  [EFFECTS.autopsyRerun]: autopsyHandler,
  [EFFECTS.interrogate]: interrogateHandler,
  [EFFECTS.reanimate]: reanimateHandler,
  [EFFECTS.planRitual]: stub('necro.plan-ritual'),
  [EFFECTS.cast]: stub('necro.cast'),
  [EFFECTS.rise]: stub('necro.rise'),
}
