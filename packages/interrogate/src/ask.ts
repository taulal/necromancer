/**
 * One Claude tool-use call (`ask_questions`). No free-text parsing.
 */
import {createHash} from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import {parseToolUse} from '@necro/autopsy'
import {INTERROGATE_SYSTEM_PROMPT} from './prompt'
import {ASK_QUESTIONS_INPUT_JSON_SCHEMA, askQuestionsInputSchema} from './schema'
import type {DraftQuestion, InterrogatePageInput, ProposedTypeSummary} from './types'
import {pagePath, pageTextCorpus, pageUrl} from './pageText'

export const ASK_QUESTIONS_TOOL_NAME = 'ask_questions'

export const LOW_CONFIDENCE_THRESHOLD = 0.6

export type AskCallResult = {
  questions: DraftQuestion[]
  inputTokens: number
  outputTokens: number
  model: string
}

function resolveAskModel(opts?: {fast?: boolean}): string {
  const preferFast = opts?.fast === true || process.env.NECRO_INTERROGATE_FAST === '1'
  if (preferFast) {
    const fast = process.env.NECRO_MODEL_FAST?.trim()
    if (fast) return fast
  }
  const reasoning = process.env.NECRO_MODEL_REASONING?.trim()
  if (reasoning) return reasoning
  const fastFallback = process.env.NECRO_MODEL_FAST?.trim()
  if (fastFallback) return fastFallback
  throw new Error(
    'NECRO_MODEL_REASONING must be set (use NECRO_MODEL_FAST only with NECRO_INTERROGATE_FAST=1)',
  )
}

/** @internal exported for tests */
export {resolveAskModel}

function fingerprintOf(kind: string, prompt: string, extra?: string): string {
  return createHash('sha256')
    .update(['claude', kind, extra ?? '', prompt].join('\0'))
    .digest('hex')
    .slice(0, 16)
}

function rankForKind(kind: DraftQuestion['kind']): number {
  switch (kind) {
    case 'authenticity':
      return 92
    case 'mapping':
      return 72
    case 'keep-or-kill':
      return 48
    default:
      return 40
  }
}

function buildUserMessage(args: {
  pages: InterrogatePageInput[]
  lowConfidenceTypes: ProposedTypeSummary[]
  deterministicSummaries: Array<{kind: string; prompt: string}>
}): string {
  const pagePayload = args.pages
    .filter((p) => (p.httpStatus ?? 200) < 400)
    .slice(0, 40)
    .map((p) => ({
      pageId: p._id.replace(/^drafts\./, ''),
      path: pagePath(p),
      url: pageUrl(p),
      title: p.title,
      text: pageTextCorpus(p).slice(0, 1200),
    }))

  return [
    '## Pages (excerpts — copy evidence excerpts exactly from these)',
    JSON.stringify(pagePayload),
    '',
    '## Deterministic questions already queued (do not duplicate)',
    JSON.stringify(args.deterministicSummaries),
    '',
    '## Low-confidence autopsy types (ask mapping questions)',
    JSON.stringify(args.lowConfidenceTypes),
  ].join('\n')
}

function extractToolUse(message: Anthropic.Message): DraftQuestion[] {
  const {input} = parseToolUse(message, ASK_QUESTIONS_TOOL_NAME, askQuestionsInputSchema)
  return input.questions.map((q) => {
    const required = q.kind === 'authenticity' ? true : q.required
    return {
      fingerprint: q.fingerprint?.trim() || fingerprintOf(q.kind, q.prompt),
      kind: q.kind,
      prompt: q.prompt,
      evidence: q.evidence.map((e) => ({
        pageId: e.pageId.replace(/^drafts\./, ''),
        url: e.url,
        excerpt: e.excerpt,
      })),
      options: q.options,
      required,
      source: 'claude' as const,
      spawnsTasks: q.spawnsTasks,
      rank: rankForKind(q.kind),
    }
  })
}

const askTool: Anthropic.Tool = {
  name: ASK_QUESTIONS_TOOL_NAME,
  description: 'Submit interrogation questions for the human. Input is the full questions list.',
  input_schema: ASK_QUESTIONS_INPUT_JSON_SCHEMA as unknown as Anthropic.Tool.InputSchema,
}

export function selectLowConfidenceTypes(types: ProposedTypeSummary[]): ProposedTypeSummary[] {
  return types
    .filter((t) => t.confidence < LOW_CONFIDENCE_THRESHOLD)
    .filter((t) => t.decision !== 'drop')
    .slice(0, 8)
}

export async function askQuestions(args: {
  pages: InterrogatePageInput[]
  lowConfidenceTypes: ProposedTypeSummary[]
  deterministic: DraftQuestion[]
  client?: Anthropic
}): Promise<AskCallResult> {
  const client = args.client ?? new Anthropic()
  const model = resolveAskModel()

  const message = await client.messages.create({
    model,
    max_tokens: 8192,
    system: INTERROGATE_SYSTEM_PROMPT,
    tools: [askTool],
    tool_choice: {type: 'tool', name: ASK_QUESTIONS_TOOL_NAME},
    messages: [
      {
        role: 'user',
        content: buildUserMessage({
          pages: args.pages,
          lowConfidenceTypes: args.lowConfidenceTypes,
          deterministicSummaries: args.deterministic.map((q) => ({
            kind: q.kind,
            prompt: q.prompt,
          })),
        }),
      },
    ],
  })

  return {
    questions: extractToolUse(message),
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    model,
  }
}
