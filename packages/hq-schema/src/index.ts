/**
 * HQ content model — BRIEF.md §6.
 * This is the schema judges read: every type and field carries a human description.
 */
import type {SchemaTypeDefinition} from 'sanity'
import {exhumedPage} from './documents/exhumedPage'
import {question} from './documents/question'
import {redirectLedgerEntry} from './documents/redirectLedgerEntry'
import {schemaProposal} from './documents/schemaProposal'
import {seance} from './documents/seance'
import {task} from './documents/task'
import {proposedField} from './objects/proposedField'
import {proposedType} from './objects/proposedType'

export const hqSchemaTypes: SchemaTypeDefinition[] = [
  seance,
  exhumedPage,
  schemaProposal,
  proposedType,
  proposedField,
  question,
  task,
  redirectLedgerEntry,
]

export {
  seance,
  exhumedPage,
  schemaProposal,
  proposedType,
  proposedField,
  question,
  task,
  redirectLedgerEntry,
}
export {slugFromUrl} from './slugFromUrl'
