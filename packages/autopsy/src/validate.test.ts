import {describe, expect, test} from 'vitest'
import {Schema} from '@sanity/schema'
import {fixtureExhumedPages, fixtureHappyProposalTypes} from './__fixtures__/site'
import {condense} from './condense'
import {compileToSchemaJson} from './compile'
import type {ProposedType} from './proposal'
import {RESERVED_TYPE_NAMES, validateProposal} from './validate'

describe('validateProposal', () => {
  const corpse = condense(fixtureExhumedPages)

  const withBones = (bonesMatch: string) =>
    fixtureHappyProposalTypes().concat({
      name: 'linkObject',
      title: 'Link',
      kind: 'object',
      bonesMatch,
      fields: [{name: 'label', type: 'string', evidenceCount: 1}],
      rationale: 'Buttons and nav links.',
      evidence: [],
      confidence: 0.6,
      decision: 'keep',
    } as ProposedType)

  test('accepts catalogue helper "link" as bonesMatch (cazskitchen 26 Sep)', () => {
    const {types, errors} = validateProposal(withBones('link'), corpse)
    expect(errors).toEqual([])
    expect(types.find((t) => t.name === 'linkObject')?.bonesMatch).toBe('link')
  })

  test('unknown bonesMatch becomes a custom type, not an error', () => {
    const {types, errors} = validateProposal(withBones('carousel'), corpse)
    expect(errors).toEqual([])
    const t = types.find((x) => x.name === 'linkObject')
    expect(t?.bonesMatch).toBeNull()
    expect(t?.rationale).toContain('"carousel" is not in the catalogue')
  })

  test('happy fixture compiles and passes', () => {
    const {types, errors} = validateProposal(fixtureHappyProposalTypes(), corpse)
    expect(errors).toEqual([])
    expect(types.some((t) => t.name === 'page')).toBe(true)
    expect(types.some((t) => t.name === 'siteSettings')).toBe(true)
    const json = compileToSchemaJson(types)
    expect(() => Schema.compile({name: 't', types: json})).not.toThrow()
  })

  test('drops bad evidence excerpts and lowers confidence when all lost', () => {
    const types: ProposedType[] = [
      {
        name: 'page',
        title: 'Page',
        kind: 'document',
        bonesMatch: null,
        fields: [{name: 'title', type: 'string', evidenceCount: 1}],
        rationale: 'Pages.',
        evidence: [
          {
            pageId: 'page-home',
            url: 'https://acme.example/',
            excerpt: 'THIS EXCERPT DOES NOT APPEAR ANYWHERE ON THE PAGE',
          },
        ],
        confidence: 0.9,
        decision: 'keep',
      },
    ]
    const {types: out} = validateProposal(types, corpse)
    const page = out.find((t) => t.name === 'page')!
    expect(page.evidence).toHaveLength(0)
    expect(page.confidence).toBeCloseTo(0.7)
  })

  test('flags reserved type names', () => {
    const types: ProposedType[] = [
      {
        name: 'image',
        title: 'Image',
        kind: 'document',
        bonesMatch: null,
        fields: [{name: 'title', type: 'string', evidenceCount: 0}],
        rationale: 'Bad name.',
        evidence: [
          {
            pageId: 'page-home',
            url: 'https://acme.example/',
            excerpt: 'Welcome to Acme Plumbing',
          },
        ],
        confidence: 0.5,
        decision: 'keep',
      },
    ]
    const {errors} = validateProposal(types, corpse)
    expect(errors.some((e) => e.includes('reserved'))).toBe(true)
    expect(RESERVED_TYPE_NAMES.has('image')).toBe(true)
  })

  test('flags dangling references', () => {
    const types: ProposedType[] = [
      {
        name: 'page',
        title: 'Page',
        kind: 'document',
        bonesMatch: null,
        fields: [
          {name: 'title', type: 'string', evidenceCount: 1},
          {
            name: 'related',
            type: 'reference',
            to: ['ghostType'],
            evidenceCount: 0,
          },
        ],
        rationale: 'Page with bad ref.',
        evidence: [
          {
            pageId: 'page-home',
            url: 'https://acme.example/',
            excerpt: 'Welcome to Acme Plumbing',
          },
        ],
        confidence: 0.8,
        decision: 'keep',
      },
    ]
    const {errors} = validateProposal(types, corpse)
    expect(errors.some((e) => e.includes('Dangling ref') && e.includes('ghostType'))).toBe(true)
  })
})
