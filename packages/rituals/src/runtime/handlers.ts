/**
 * Effect handlers claimed by the drain worker, keyed by effect name.
 */
import type {EffectHandler} from '@sanity/workflow-engine'
import {EFFECTS} from '../effects/names'
import {autopsyHandler} from './autopsyHandler'
import {exhumeHandler} from './exhumeHandler'
import {interrogateHandler} from './interrogateHandler'
import {reanimateHandler} from './reanimateHandler'
import {castHandler, planRitualHandler, riseHandler} from './ritualHandlers'

/** Every effect in the resurrection + page-ritual definitions has a real handler. */
export const effectHandlers: Record<string, EffectHandler> = {
  [EFFECTS.exhume]: exhumeHandler,
  [EFFECTS.autopsy]: autopsyHandler,
  [EFFECTS.autopsyRerun]: autopsyHandler,
  [EFFECTS.interrogate]: interrogateHandler,
  [EFFECTS.reanimate]: reanimateHandler,
  [EFFECTS.planRitual]: planRitualHandler,
  [EFFECTS.cast]: castHandler,
  [EFFECTS.rise]: riseHandler,
  [EFFECTS.riseRetry]: riseHandler,
}
