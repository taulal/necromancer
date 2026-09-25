import {afterEach, describe, expect, test, vi} from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import {ASK_QUESTIONS_TOOL_NAME, resolveAskModel, runInterrogate} from './index'
import type {InterrogatePageInput} from './types'

function mockClient(toolInput: unknown): Anthropic {
  return {
    messages: {
      create: vi.fn(async () => ({
        content: [
          {
            type: 'tool_use',
            id: 'toolu_test',
            name: ASK_QUESTIONS_TOOL_NAME,
            input: toolInput,
          },
        ],
        usage: {input_tokens: 100, output_tokens: 50},
      })),
    },
  } as unknown as Anthropic
}

const pages: InterrogatePageInput[] = [
  {
    _id: 'page-home',
    path: '/',
    url: 'https://acme.example/',
    title: 'Acme Plumbing',
    httpStatus: 200,
    contentHash: 'h1',
    meta: {description: 'Plumbers'},
    sections: [
      {
        kind: 'hero',
        text: 'Welcome to Acme Plumbing. Call 021 152 6894. Our clients say we are amazing always.',
      },
    ],
    images: [{src: 'https://acme.example/a.jpg', alt: 'Van'}],
    detectedEntities: {
      phones: ['021 152 6894'],
      emails: [],
      addresses: [],
      prices: [],
    },
  },
  {
    _id: 'page-about',
    path: '/about',
    url: 'https://acme.example/about',
    title: 'About',
    httpStatus: 200,
    contentHash: 'h2',
    meta: {description: 'About'},
    sections: [
      {
        kind: 'prose',
        text: 'About Acme. Call 09 555 0100 for quotes across the North Island region.',
      },
    ],
    images: [],
    detectedEntities: {
      phones: ['09 555 0100'],
      emails: [],
      addresses: [],
      prices: [],
    },
  },
]

describe('resolveAskModel', () => {
  const prev = {
    reasoning: process.env.NECRO_MODEL_REASONING,
    fast: process.env.NECRO_MODEL_FAST,
    flag: process.env.NECRO_INTERROGATE_FAST,
  }

  afterEach(() => {
    process.env.NECRO_MODEL_REASONING = prev.reasoning
    process.env.NECRO_MODEL_FAST = prev.fast
    process.env.NECRO_INTERROGATE_FAST = prev.flag
  })

  test('prefers REASONING by default', () => {
    process.env.NECRO_MODEL_REASONING = 'sonnet-test'
    process.env.NECRO_MODEL_FAST = 'haiku-test'
    delete process.env.NECRO_INTERROGATE_FAST
    expect(resolveAskModel()).toBe('sonnet-test')
  })
})

describe('runInterrogate', () => {
  test('merges deterministic + mocked Claude questions and validates evidence', async () => {
    process.env.NECRO_MODEL_REASONING = 'sonnet-test'

    const client = mockClient({
      questions: [
        {
          kind: 'mapping',
          prompt: 'Keep the low-confidence "widget" type?',
          evidence: [
            {
              pageId: 'page-home',
              url: 'https://acme.example/',
              excerpt: 'Welcome to Acme Plumbing',
            },
          ],
          options: ['Keep', 'Drop', 'Merge into page'],
          required: false,
          spawnsTasks: true,
          fingerprint: 'map-widget',
        },
        {
          kind: 'authenticity',
          prompt: 'Is this testimonial stock copy?',
          evidence: [
            {
              pageId: 'page-home',
              url: 'https://acme.example/',
              excerpt: 'Our clients say we are amazing always.',
            },
          ],
          options: ['Rewrite', 'Keep'],
          required: true,
          spawnsTasks: true,
        },
        {
          kind: 'mapping',
          prompt: 'Bad evidence should be dropped',
          evidence: [
            {
              pageId: 'page-home',
              url: 'https://acme.example/',
              excerpt: 'THIS EXCERPT IS NOT ON THE PAGE AT ALL',
            },
          ],
          options: ['Keep', 'Drop'],
          required: false,
          spawnsTasks: false,
        },
      ],
    })

    const result = await runInterrogate({
      pages,
      proposalTypes: [
        {
          name: 'widget',
          title: 'Widget',
          kind: 'document',
          confidence: 0.4,
          rationale: 'Unclear',
        },
      ],
      client,
    })

    expect(result.usage.model).toBe('sonnet-test')
    expect(result.usage.inputTokens).toBe(100)
    expect(result.questions.some((q) => q.kind === 'contradiction')).toBe(true)
    expect(result.questions.some((q) => q.fingerprint === 'map-widget')).toBe(true)
    expect(result.questions.some((q) => q.prompt.includes('testimonial'))).toBe(true)
    expect(result.questions.every((q) => q.evidence.length > 0)).toBe(true)
    expect(result.questions.some((q) => q.prompt.includes('NOT ON THE PAGE'))).toBe(false)
    expect(result.questions.length).toBeLessThanOrEqual(15)
  })

  test('skipClaude still returns deterministic findings', async () => {
    const result = await runInterrogate({pages, skipClaude: true})
    expect(result.usage.model).toBeNull()
    expect(result.questions.some((q) => q.kind === 'contradiction')).toBe(true)
  })
})
