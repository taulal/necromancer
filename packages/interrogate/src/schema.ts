/**
 * Zod + JSON Schema for Claude tool `ask_questions`.
 */
import {z} from 'zod'

const evidenceSchema = z.object({
  pageId: z.string().min(1),
  url: z.string().min(1),
  excerpt: z.string().min(1),
})

const questionSchema = z.object({
  kind: z.enum(['authenticity', 'keep-or-kill', 'mapping']),
  prompt: z.string().min(1),
  evidence: z.array(evidenceSchema).min(1),
  options: z.array(z.string().min(1)).min(2),
  required: z.boolean(),
  spawnsTasks: z.boolean(),
  /** Stable key for idempotent ids (e.g. type name for mapping). */
  fingerprint: z.string().min(1).optional(),
})

export const askQuestionsInputSchema = z.object({
  questions: z.array(questionSchema).max(10),
})

export type AskQuestionsInput = z.infer<typeof askQuestionsInputSchema>

export const ASK_QUESTIONS_INPUT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'prompt', 'evidence', 'options', 'required', 'spawnsTasks'],
        properties: {
          kind: {
            type: 'string',
            enum: ['authenticity', 'keep-or-kill', 'mapping'],
          },
          prompt: {type: 'string'},
          evidence: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['pageId', 'url', 'excerpt'],
              properties: {
                pageId: {type: 'string'},
                url: {type: 'string'},
                excerpt: {type: 'string'},
              },
            },
          },
          options: {
            type: 'array',
            minItems: 2,
            items: {type: 'string'},
          },
          required: {type: 'boolean'},
          spawnsTasks: {type: 'boolean'},
          fingerprint: {type: 'string'},
        },
      },
    },
  },
} as const
