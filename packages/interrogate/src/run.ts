/**
 * Interrogation pipeline: deterministic → Claude ask_questions → validate → rank/cap.
 */
import type Anthropic from '@anthropic-ai/sdk'
import {askQuestions, selectLowConfidenceTypes} from './ask'
import {collectDeterministicQuestions} from './deterministic'
import {rankAndCap} from './rank'
import type {
  DraftQuestion,
  InterrogatePageInput,
  InterrogateResult,
  ProposedTypeSummary,
} from './types'
import {filterQuestionEvidence} from './validate'

export type RunInterrogateArgs = {
  pages: InterrogatePageInput[]
  /** Latest schema proposal types (for mapping questions). */
  proposalTypes?: ProposedTypeSummary[]
  client?: Anthropic
  /**
   * When true, skip the Claude call (deterministic only).
   * Also skipped automatically when no model env is set and no client is passed.
   */
  skipClaude?: boolean
}

function canCallClaude(args: RunInterrogateArgs): boolean {
  if (args.skipClaude) return false
  if (args.client) return true
  return Boolean(process.env.NECRO_MODEL_REASONING?.trim() || process.env.NECRO_MODEL_FAST?.trim())
}

export async function runInterrogate(args: RunInterrogateArgs): Promise<InterrogateResult> {
  const deterministicRaw = collectDeterministicQuestions(args.pages)
  const deterministic = filterQuestionEvidence(deterministicRaw, args.pages)

  let claudeQuestions: DraftQuestion[] = []
  let inputTokens = 0
  let outputTokens = 0
  let model: string | null = null

  const lowConfidence = selectLowConfidenceTypes(args.proposalTypes ?? [])

  if (canCallClaude(args)) {
    try {
      const call = await askQuestions({
        pages: args.pages,
        lowConfidenceTypes: lowConfidence,
        deterministic,
        client: args.client,
      })
      claudeQuestions = filterQuestionEvidence(call.questions, args.pages)
      inputTokens = call.inputTokens
      outputTokens = call.outputTokens
      model = call.model
    } catch (err) {
      // Soft-fail when deterministic findings exist — stage still advances with evidence-backed questions.
      if (deterministic.length === 0) {
        throw err
      }
      console.warn(
        '[interrogate] Claude ask_questions failed; shipping deterministic questions only:',
        err instanceof Error ? err.message : err,
      )
      model = null
    }
  }

  const merged = rankAndCap([...deterministic, ...claudeQuestions])

  return {
    questions: merged,
    usage: {model, inputTokens, outputTokens},
  }
}
