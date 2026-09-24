/**
 * Zod mirror of ProposedType[] for Claude tool `propose_anatomy` (no free-text parsing).
 */
import {z} from 'zod'

const fieldTypeSchema = z.enum([
  'string',
  'text',
  'number',
  'boolean',
  'date',
  'datetime',
  'url',
  'slug',
  'image',
  'file',
  'array',
  'object',
  'reference',
  'portableText',
])

const proposedFieldSchema = z.object({
  name: z.string(),
  type: fieldTypeSchema,
  of: z.array(z.string()).optional(),
  to: z.array(z.string()).optional(),
  required: z.boolean().optional(),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      regex: z.string().optional(),
    })
    .optional(),
  description: z.string().optional(),
  evidenceCount: z.number(),
})

const evidenceSchema = z.object({
  pageId: z.string(),
  url: z.string(),
  excerpt: z.string(),
})

export const proposedTypeSchema = z.object({
  name: z.string(),
  title: z.string(),
  kind: z.enum(['document', 'object', 'singleton']),
  bonesMatch: z.string().nullable(),
  fields: z.array(proposedFieldSchema).min(1),
  rationale: z.string().min(1),
  evidence: z.array(evidenceSchema).min(1),
  confidence: z.number().min(0).max(1),
  decision: z.enum(['keep', 'merge', 'drop']),
  mergeInto: z.string().optional(),
})

/** Tool input is an object wrapping ProposedType[] (Anthropic requires object root). */
export const proposeAnatomyInputSchema = z.object({
  types: z.array(proposedTypeSchema).min(1),
})

export type ProposeAnatomyInput = z.infer<typeof proposeAnatomyInputSchema>

/** JSON Schema for Anthropic tool `input_schema` (hand-written mirror of the zod types). */
export const PROPOSE_ANATOMY_INPUT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['types'],
  properties: {
    types: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'name',
          'title',
          'kind',
          'bonesMatch',
          'fields',
          'rationale',
          'evidence',
          'confidence',
          'decision',
        ],
        properties: {
          name: {type: 'string'},
          title: {type: 'string'},
          kind: {type: 'string', enum: ['document', 'object', 'singleton']},
          bonesMatch: {type: ['string', 'null']},
          fields: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'type', 'evidenceCount'],
              properties: {
                name: {type: 'string'},
                type: {
                  type: 'string',
                  enum: [
                    'string',
                    'text',
                    'number',
                    'boolean',
                    'date',
                    'datetime',
                    'url',
                    'slug',
                    'image',
                    'file',
                    'array',
                    'object',
                    'reference',
                    'portableText',
                  ],
                },
                of: {type: 'array', items: {type: 'string'}},
                to: {type: 'array', items: {type: 'string'}},
                required: {type: 'boolean'},
                validation: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    min: {type: 'number'},
                    max: {type: 'number'},
                    regex: {type: 'string'},
                  },
                },
                description: {type: 'string'},
                evidenceCount: {type: 'number'},
              },
            },
          },
          rationale: {type: 'string'},
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
          confidence: {type: 'number', minimum: 0, maximum: 1},
          decision: {type: 'string', enum: ['keep', 'merge', 'drop']},
          mergeInto: {type: 'string'},
        },
      },
    },
  },
} as const
