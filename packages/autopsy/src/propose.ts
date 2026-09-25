/**
 * Step 2 — one Claude tool-use call (`propose_anatomy`). No free-text parsing.
 */
import Anthropic from '@anthropic-ai/sdk'
import {BONES_CATALOGUE} from '@necro/bones'
import type {Corpse} from './corpse'
import {AUTOPSY_RERUN_RULE, AUTOPSY_SYSTEM_PROMPT} from './prompt'
import type {HumanDecision, ProposedType, SchemaProposal} from './proposal'
import {PROPOSE_ANATOMY_INPUT_JSON_SCHEMA, proposeAnatomyInputSchema} from './schema'
import {parseToolUse} from './toolInput'

export const PROPOSE_ANATOMY_TOOL_NAME = 'propose_anatomy'

export type ProposeCallResult = {
  types: ProposedType[]
  inputTokens: number
  outputTokens: number
  model: string
  /** Prior assistant message content (for repair tool_result round-trip). */
  assistantContent: Anthropic.ContentBlock[]
  toolUseId: string
}

function resolveProposeModel(opts?: {fast?: boolean}): string {
  // Default: REASONING (Sonnet). Haiku only when --fast / NECRO_AUTOPSY_FAST=1.
  const preferFast = opts?.fast === true || process.env.NECRO_AUTOPSY_FAST === '1'
  if (preferFast) {
    const fast = process.env.NECRO_MODEL_FAST?.trim()
    if (fast) return fast
  }
  const reasoning = process.env.NECRO_MODEL_REASONING?.trim()
  if (reasoning) return reasoning
  const fastFallback = process.env.NECRO_MODEL_FAST?.trim()
  if (fastFallback) return fastFallback
  throw new Error(
    'NECRO_MODEL_REASONING must be set (use NECRO_MODEL_FAST only with --fast / NECRO_AUTOPSY_FAST=1)',
  )
}

/** @internal exported for tests */
export {resolveProposeModel}

function buildUserMessage(args: {
  corpse: Corpse
  priorProposal?: SchemaProposal
  humanDecisions?: HumanDecision[]
}): string {
  const parts: string[] = [
    '## Corpse (condensed site dump)',
    JSON.stringify(args.corpse),
    '',
    '## Bones catalogue',
    JSON.stringify(BONES_CATALOGUE),
  ]

  if (args.priorProposal || (args.humanDecisions && args.humanDecisions.length > 0)) {
    parts.push('', `## Re-run rule`, AUTOPSY_RERUN_RULE)
  }
  if (args.priorProposal) {
    parts.push('', '## Previous proposal', JSON.stringify(args.priorProposal.types))
  }
  if (args.humanDecisions && args.humanDecisions.length > 0) {
    parts.push('', '## Human decisions to respect', JSON.stringify(args.humanDecisions))
  }

  return parts.join('\n')
}

function extractToolUse(message: Anthropic.Message): {toolUseId: string; types: ProposedType[]} {
  const {toolUseId, input} = parseToolUse(
    message,
    PROPOSE_ANATOMY_TOOL_NAME,
    proposeAnatomyInputSchema,
  )
  return {toolUseId, types: input.types}
}

const proposeTool: Anthropic.Tool = {
  name: PROPOSE_ANATOMY_TOOL_NAME,
  description:
    'Propose the Sanity content model (anatomy) for the dead site. Input is the full ProposedType list.',
  input_schema: PROPOSE_ANATOMY_INPUT_JSON_SCHEMA as unknown as Anthropic.Tool.InputSchema,
}

export async function propose(args: {
  corpse: Corpse
  priorProposal?: SchemaProposal
  humanDecisions?: HumanDecision[]
  client?: Anthropic
}): Promise<ProposeCallResult> {
  const client = args.client ?? new Anthropic()
  const model = resolveProposeModel()

  const message = await client.messages.create({
    model,
    max_tokens: 16_384,
    system: AUTOPSY_SYSTEM_PROMPT,
    tools: [proposeTool],
    tool_choice: {type: 'tool', name: PROPOSE_ANATOMY_TOOL_NAME},
    messages: [{role: 'user', content: buildUserMessage(args)}],
  })

  const {toolUseId, types} = extractToolUse(message)
  return {
    types,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    model,
    assistantContent: message.content,
    toolUseId,
  }
}

/**
 * One repair round: send compile/validate errors back as a tool_result,
 * force another propose_anatomy call, change nothing else.
 */
export async function repairPropose(args: {
  corpse: Corpse
  priorProposal?: SchemaProposal
  humanDecisions?: HumanDecision[]
  previous: ProposeCallResult
  errors: string[]
  client?: Anthropic
}): Promise<ProposeCallResult> {
  const client = args.client ?? new Anthropic()
  const model = args.previous.model || resolveProposeModel()

  const userContent = buildUserMessage({
    corpse: args.corpse,
    priorProposal: args.priorProposal,
    humanDecisions: args.humanDecisions,
  })

  const message = await client.messages.create({
    model,
    max_tokens: 16_384,
    system: AUTOPSY_SYSTEM_PROMPT,
    tools: [proposeTool],
    tool_choice: {type: 'tool', name: PROPOSE_ANATOMY_TOOL_NAME},
    messages: [
      {role: 'user', content: userContent},
      {role: 'assistant', content: args.previous.assistantContent},
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: args.previous.toolUseId,
            content: `Fix these errors, change nothing else:\n${args.errors.join('\n')}`,
            is_error: true,
          },
        ],
      },
    ],
  })

  const {toolUseId, types} = extractToolUse(message)
  return {
    types,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    model,
    assistantContent: message.content,
    toolUseId,
  }
}

/** Diff prior proposal decisions into a human-decision list for re-runs. */
export function humanDecisionsFromProposal(prior: SchemaProposal): HumanDecision[] {
  const decisions: HumanDecision[] = []
  for (const t of prior.types) {
    if (t.decision === 'drop') {
      decisions.push({kind: 'drop', typeName: t.name})
    } else if (t.decision === 'merge' && t.mergeInto) {
      decisions.push({kind: 'merge', from: t.name, into: t.mergeInto})
    }
    for (const field of t.fields) {
      if (typeof field.required === 'boolean') {
        // Board toggles are not distinguishable from model output; still pass through.
      }
    }
  }
  return decisions
}
