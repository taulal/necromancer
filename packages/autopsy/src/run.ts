/**
 * Autopsy pipeline: condense → propose → validate (+ one repair) → SchemaProposal.
 */
import type Anthropic from '@anthropic-ai/sdk'
import {condense} from './condense'
import type {Corpse, ExhumedPageInput} from './corpse'
import {humanDecisionsFromProposal, propose, repairPropose} from './propose'
import type {AutopsyResult, HumanDecision, SchemaProposal} from './proposal'
import {validateProposal} from './validate'

export type RunAutopsyArgs = {
  seanceId: string
  version: number
  pages: ExhumedPageInput[]
  priorProposal?: SchemaProposal
  humanDecisions?: HumanDecision[]
  client?: Anthropic
  /** Optional pre-built corpse (tests). */
  corpse?: Corpse
}

export async function runAutopsy(args: RunAutopsyArgs): Promise<AutopsyResult> {
  const corpse = args.corpse ?? condense(args.pages)
  const decisions =
    args.humanDecisions ??
    (args.priorProposal ? humanDecisionsFromProposal(args.priorProposal) : undefined)

  let call = await propose({
    corpse,
    priorProposal: args.priorProposal,
    humanDecisions: decisions,
    client: args.client,
  })

  let inputTokens = call.inputTokens
  let outputTokens = call.outputTokens
  let repairRounds = 0

  let {types, errors} = validateProposal(call.types, corpse)

  if (errors.length > 0) {
    call = await repairPropose({
      corpse,
      priorProposal: args.priorProposal,
      humanDecisions: decisions,
      previous: call,
      errors,
      client: args.client,
    })
    inputTokens += call.inputTokens
    outputTokens += call.outputTokens
    repairRounds = 1

    const repaired = validateProposal(call.types, corpse)
    types = repaired.types
    errors = repaired.errors
  }

  if (errors.length > 0) {
    throw new Error(`Autopsy proposal invalid after repair: ${errors.join('; ')}`)
  }

  const proposal: SchemaProposal = {
    seanceId: args.seanceId,
    version: args.version,
    types,
    model: call.model,
    inputTokens,
    outputTokens,
    repairRounds,
  }

  return {
    proposal,
    usage: {
      model: call.model,
      inputTokens,
      outputTokens,
      repairRounds,
    },
  }
}
