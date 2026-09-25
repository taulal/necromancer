/**
 * Shared forced-tool-use parsing for autopsy + interrogation.
 */
import type Anthropic from '@anthropic-ai/sdk'
import type {z} from 'zod'

export type ToolCallMeta = {
  tool: string
  model: string
  stopReason: string | null
  inputTokens: number
  outputTokens: number
}

/** Carries the Claude response shape so failures can be diagnosed from necro.effectError. */
export class ToolCallError extends Error {
  readonly meta: ToolCallMeta
  constructor(message: string, meta: ToolCallMeta, options?: {cause?: unknown}) {
    super(message, options)
    this.name = 'ToolCallError'
    this.meta = meta
  }
}

/**
 * Sonnet intermittently JSON-encodes a large nested array (e.g. `types`) as a string
 * inside tool input. Parse those back; leave anything unparseable for zod to reject.
 */
export function coerceToolInput(input: unknown): unknown {
  let value: unknown = input
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return input
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const next: Record<string, unknown> = {...(value as Record<string, unknown>)}
  for (const [key, v] of Object.entries(next)) {
    if (typeof v === 'string' && (v.startsWith('[') || v.startsWith('{'))) {
      try {
        next[key] = JSON.parse(v)
      } catch {
        /* leave as string */
      }
    }
  }
  return next
}

/** Find the forced tool_use block and validate its input; throws ToolCallError with meta. */
export function parseToolUse<T>(
  message: Anthropic.Message,
  toolName: string,
  schema: z.ZodType<T>,
): {toolUseId: string; input: T} {
  const meta: ToolCallMeta = {
    tool: toolName,
    model: message.model,
    stopReason: message.stop_reason,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  }
  const block = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === toolName,
  )
  if (!block) {
    throw new ToolCallError(
      `Claude did not call ${toolName} (stop_reason=${meta.stopReason})`,
      meta,
    )
  }
  const parsed = schema.safeParse(coerceToolInput(block.input))
  if (!parsed.success) {
    throw new ToolCallError(
      `${toolName} input invalid (stop_reason=${meta.stopReason}, output_tokens=${meta.outputTokens}): ${parsed.error.message}`,
      meta,
      {cause: parsed.error},
    )
  }
  return {toolUseId: block.id, input: parsed.data}
}
