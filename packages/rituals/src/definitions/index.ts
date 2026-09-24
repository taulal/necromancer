/**
 * Workflow definitions deployed to hq under the `necromancer` tag.
 * Engine 0.35 — see PR build-log for grammar notes vs sandbox 0.28.
 */
import {pageRitual} from './page-ritual'
import {resurrection} from './resurrection'

export const definitions = [resurrection, pageRitual] as const

export {resurrection, pageRitual}
