import type Anthropic from '@anthropic-ai/sdk'
import {describe, expect, test} from 'vitest'
import {proposeAnatomyInputSchema} from './schema'
import {coerceToolInput, parseToolUse, ToolCallError} from './toolInput'

const TYPE = {
  name: 'page',
  title: 'Page',
  kind: 'document',
  bonesMatch: null,
  fields: [{name: 'title', type: 'string', evidenceCount: 3}],
  rationale: 'Every page has a title.',
  evidence: [{pageId: 'p1', url: 'https://example.com/', excerpt: 'Home'}],
  confidence: 0.9,
  decision: 'keep',
}

function message(input: unknown, stopReason: Anthropic.Message['stop_reason'] = 'tool_use') {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-test',
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {input_tokens: 100, output_tokens: 50},
    content: [{type: 'tool_use', id: 'tu_1', name: 'propose_anatomy', input}],
  } as unknown as Anthropic.Message
}

describe('coerceToolInput', () => {
  test('parses a stringified nested array', () => {
    const out = coerceToolInput({types: JSON.stringify([TYPE])}) as {types: unknown}
    expect(Array.isArray(out.types)).toBe(true)
  })

  test('parses fully stringified input', () => {
    const out = coerceToolInput(JSON.stringify({types: [TYPE]})) as {types: unknown}
    expect(Array.isArray(out.types)).toBe(true)
  })

  test('leaves unparseable strings alone', () => {
    expect(coerceToolInput({types: '[{"name":'})).toEqual({types: '[{"name":'})
  })
})

describe('parseToolUse', () => {
  test('accepts Sonnet stringified types (Netlify cap-50 failure shape)', () => {
    const {toolUseId, input} = parseToolUse(
      message({types: JSON.stringify([TYPE])}),
      'propose_anatomy',
      proposeAnatomyInputSchema,
    )
    expect(toolUseId).toBe('tu_1')
    expect(input.types[0]?.name).toBe('page')
  })

  test('throws ToolCallError with response meta on invalid input', () => {
    try {
      parseToolUse(
        message({types: '[{"trunc'}, 'max_tokens'),
        'propose_anatomy',
        proposeAnatomyInputSchema,
      )
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(ToolCallError)
      expect((err as ToolCallError).meta).toEqual({
        tool: 'propose_anatomy',
        model: 'claude-sonnet-test',
        stopReason: 'max_tokens',
        inputTokens: 100,
        outputTokens: 50,
      })
      expect((err as Error).message).toContain('stop_reason=max_tokens')
    }
  })

  test('throws ToolCallError when the tool was not called', () => {
    const m = message({})
    m.content = []
    expect(() => parseToolUse(m, 'propose_anatomy', proposeAnatomyInputSchema)).toThrow(
      ToolCallError,
    )
  })
})
