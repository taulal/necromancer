import {definitions} from './index'
import {EFFECTS} from '../effects/names'
import {StartNotAllowedError, type Actor} from '@sanity/workflow-engine'
import {createBench, subjectField} from '@sanity/workflow-engine-test'
import {expect, test} from 'vitest'

const T0 = '2026-09-24T10:00:00.000Z'
const HOUR_MS = 60 * 60 * 1000

const editor: Actor = {kind: 'person', id: 'gTaylor', roles: ['editor', 'administrator']}
const system: Actor = {kind: 'system', id: 'p-drain'}

function seedDocuments() {
  return [
    {
      _id: 'seance-1',
      _type: 'seance',
      url: 'https://example-dead.site',
      slug: {current: 'example-dead'},
      status: 'alive',
      pageCap: 50,
      targetMode: 'dataset',
      visibility: 'private',
    },
    pageDoc('page-1', '/'),
    pageDoc('page-2', '/about'),
    {
      _id: 'question-required-1',
      _type: 'question',
      seance: {_ref: 'seance-1', _type: 'reference'},
      kind: 'contradiction',
      prompt: 'Which phone number is correct?',
      required: true,
      source: 'claude',
    },
    {
      _id: 'question-optional-1',
      _type: 'question',
      seance: {_ref: 'seance-1', _type: 'reference'},
      kind: 'missing-info',
      prompt: 'Any other notes?',
      required: false,
      source: 'claude',
    },
  ]
}

function pageDoc(id: string, path: string) {
  return {
    _id: id,
    _type: 'exhumedPage',
    seance: {_ref: 'seance-1', _type: 'reference'},
    url: `https://example-dead.site${path}`,
    path,
    httpStatus: 200,
    title: path === '/' ? 'Home' : path.slice(1),
    contentHash: `hash-${id}`,
  }
}

async function startResurrection() {
  const bench = createBench({now: T0, documents: seedDocuments()})
  await bench.deployDefinitions({definitions: [...definitions], expectedMinReaderModel: 10})
  const {instance} = await bench.startInstance({
    definition: 'resurrection',
    initialFields: [subjectField('seance-1', {type: 'seance'})],
  })
  return {bench, instance}
}

async function beginExhumation(bench: {fireAction: Function}, instanceId: string) {
  await bench.fireAction({
    instanceId,
    activity: 'confirm',
    action: 'begin-exhumation',
    actor: editor,
  })
}

async function completeEffect(
  bench: any,
  instanceId: string,
  effect: string,
  status: 'done' | 'failed' = 'done',
  extra: Record<string, unknown> = {},
) {
  await bench.completePendingEffect({
    instanceId,
    effect,
    status,
    actor: system,
    ...extra,
  })
}

async function throughAutopsyInference(bench: any, instanceId: string) {
  await beginExhumation(bench, instanceId)
  await completeEffect(bench, instanceId, EFFECTS.exhume)
  await completeEffect(bench, instanceId, EFFECTS.autopsy)
}

async function acceptAnatomy(bench: any, instanceId: string) {
  await bench.fireAction({
    instanceId,
    activity: 'accept',
    action: 'accept-anatomy',
    actor: editor,
  })
  await bench.tick({instanceId})
}

async function answerRequiredQuestions(bench: any) {
  await bench.editDocument({
    documentId: 'question-required-1',
    patch: {set: {answer: '021 152 6894', answeredBy: editor.id}},
  })
}

async function setOpenRequired(bench: any, instanceId: string, count: number) {
  await bench.editField({
    instanceId,
    target: {scope: 'workflow', field: 'openRequiredQuestions'},
    mode: 'set',
    value: count,
    actor: editor,
  })
}

/** Through interrogation with the required-question gate cleared. */
async function throughInterrogation(bench: any, instanceId: string) {
  await throughAutopsyInference(bench, instanceId)
  await acceptAnatomy(bench, instanceId)
  await completeEffect(bench, instanceId, EFFECTS.interrogate, 'done', {
    ops: [
      {
        type: 'field.set',
        target: {scope: 'workflow', field: 'interrogationDeadline'},
        value: {type: 'literal', value: '2026-09-26T10:00:00.000Z'},
      },
      {
        type: 'field.set',
        target: {scope: 'workflow', field: 'openRequiredQuestions'},
        value: {type: 'literal', value: 0},
      },
    ],
  })
  await answerRequiredQuestions(bench)
  await bench.tick({instanceId})
}

async function throughReanimating(bench: any, instanceId: string) {
  await throughInterrogation(bench, instanceId)
  await completeEffect(bench, instanceId, EFFECTS.reanimate)
  await completeEffect(bench, instanceId, EFFECTS.planRitual)
}

async function blessAllChildren(bench: any, parentId: string) {
  const children = await bench.children({instanceId: parentId, activity: 'page-rituals'})
  for (const child of children) {
    await completeEffect(bench, child._id, EFFECTS.cast)
    await bench.fireAction({
      instanceId: child._id,
      activity: 'review',
      action: 'approve',
      actor: editor,
    })
  }
  await bench.tick({instanceId: parentId})
}

test('resurrection starts in summoned', async () => {
  const {instance} = await startResurrection()
  expect(instance.currentStage).toBe('summoned')
})

test('happy path: summoned → … → risen after Rise', async () => {
  const {bench, instance} = await startResurrection()
  await throughReanimating(bench, instance._id)
  expect(await bench.currentStage(instance._id)).toBe('ritual')

  const children = await bench.children({instanceId: instance._id, activity: 'page-rituals'})
  expect(children).toHaveLength(2)

  await blessAllChildren(bench, instance._id)
  expect(await bench.currentStage(instance._id)).toBe('rising')

  await bench.fireAction({
    instanceId: instance._id,
    activity: 'publish',
    action: 'rise',
    actor: editor,
  })
  await completeEffect(bench, instance._id, EFFECTS.rise)
  expect(await bench.currentStage(instance._id)).toBe('risen')
})

test('exhume failed moves to entombed', async () => {
  const {bench, instance} = await startResurrection()
  await beginExhumation(bench, instance._id)
  await completeEffect(bench, instance._id, EFFECTS.exhume, 'failed')
  expect(await bench.currentStage(instance._id)).toBe('entombed')
})

test('autopsy can be re-run before Accept anatomy', async () => {
  const {bench, instance} = await startResurrection()
  await throughAutopsyInference(bench, instance._id)
  expect(await bench.currentStage(instance._id)).toBe('autopsy')

  await bench.fireAction({
    instanceId: instance._id,
    activity: 'accept',
    action: 'rerun-autopsy',
    actor: editor,
  })
  const pending = await bench.listPendingEffects({instanceId: instance._id})
  expect(pending.map((e: {name: string}) => e.name)).toContain(EFFECTS.autopsyRerun)

  await completeEffect(bench, instance._id, EFFECTS.autopsyRerun)
  expect(await bench.currentStage(instance._id)).toBe('autopsy')

  await acceptAnatomy(bench, instance._id)
  expect(await bench.currentStage(instance._id)).toBe('interrogation')
})

test('interrogation does not advance until required questions are answered', async () => {
  const {bench, instance} = await startResurrection()
  await throughAutopsyInference(bench, instance._id)
  await acceptAnatomy(bench, instance._id)
  await completeEffect(bench, instance._id, EFFECTS.interrogate, 'done', {
    ops: [
      {
        type: 'field.set',
        target: {scope: 'workflow', field: 'openRequiredQuestions'},
        value: {type: 'literal', value: 1},
      },
    ],
  })
  await bench.tick({instanceId: instance._id})
  expect(await bench.currentStage(instance._id)).toBe('interrogation')

  await answerRequiredQuestions(bench)
  await setOpenRequired(bench, instance._id, 0)
  await bench.tick({instanceId: instance._id})
  expect(await bench.currentStage(instance._id)).toBe('reanimating')
})

test('ritual waits until every page-ritual child is settled', async () => {
  const {bench, instance} = await startResurrection()
  await throughReanimating(bench, instance._id)

  const children = await bench.children({instanceId: instance._id, activity: 'page-rituals'})
  expect(children).toHaveLength(2)

  await completeEffect(bench, children[0]!._id, EFFECTS.cast)
  await bench.fireAction({
    instanceId: children[0]!._id,
    activity: 'review',
    action: 'approve',
    actor: editor,
  })
  await bench.tick({instanceId: instance._id})
  expect(await bench.currentStage(instance._id)).toBe('ritual')

  await completeEffect(bench, children[1]!._id, EFFECTS.cast)
  await bench.fireAction({
    instanceId: children[1]!._id,
    activity: 'review',
    action: 'approve',
    actor: editor,
  })
  await bench.tick({instanceId: instance._id})
  expect(await bench.currentStage(instance._id)).toBe('rising')
})

test('page-ritual recast returns to casting then can be blessed', async () => {
  const {bench, instance} = await startResurrection()
  await throughReanimating(bench, instance._id)
  const [child] = await bench.children({instanceId: instance._id, activity: 'page-rituals'})
  expect(child).toBeTruthy()

  await completeEffect(bench, child!._id, EFFECTS.cast)
  expect(await bench.currentStage(child!._id)).toBe('reviewing')

  await bench.fireAction({
    instanceId: child!._id,
    activity: 'review',
    action: 'recast',
    actor: editor,
  })
  expect(await bench.currentStage(child!._id)).toBe('casting')

  await completeEffect(bench, child!._id, EFFECTS.cast)
  await bench.fireAction({
    instanceId: child!._id,
    activity: 'review',
    action: 'approve',
    actor: editor,
  })
  expect(await bench.currentStage(child!._id)).toBe('blessed')
})

test('interrogation SLA sets haunted without leaving the stage', async () => {
  const {bench, instance} = await startResurrection()
  await throughAutopsyInference(bench, instance._id)
  await acceptAnatomy(bench, instance._id)
  await completeEffect(bench, instance._id, EFFECTS.interrogate, 'done', {
    ops: [
      {
        type: 'field.set',
        target: {scope: 'workflow', field: 'interrogationDeadline'},
        value: {type: 'literal', value: '2026-09-26T10:00:00.000Z'},
      },
      {
        type: 'field.set',
        target: {scope: 'workflow', field: 'openRequiredQuestions'},
        value: {type: 'literal', value: 1},
      },
    ],
  })
  expect(await bench.currentStage(instance._id)).toBe('interrogation')

  bench.advance(49 * HOUR_MS)
  const after = await bench.tick({instanceId: instance._id})
  expect(after.instance.currentStage).toBe('interrogation')

  const haunted = after.instance.fields?.find((f: {name: string}) => f.name === 'haunted')
  expect(haunted?.value).toBe(true)
})

test('page-ritual cast failure still reaches reviewing with castFailed', async () => {
  const {bench, instance} = await startResurrection()
  await throughReanimating(bench, instance._id)
  const [child] = await bench.children({instanceId: instance._id, activity: 'page-rituals'})
  expect(child).toBeTruthy()

  await completeEffect(bench, child!._id, EFFECTS.cast, 'failed')
  expect(await bench.currentStage(child!._id)).toBe('reviewing')
  const after = await bench.getInstance({instanceId: child!._id})
  const flag = after.fields?.find((f: {name: string}) => f.name === 'castFailed')
  expect(flag?.value).toBe(true)
})

test('ritual settles immediately when there are zero pages to fan out', async () => {
  const bench = createBench({
    now: T0,
    documents: [
      {
        _id: 'seance-empty',
        _type: 'seance',
        url: 'https://empty.example',
        slug: {current: 'empty'},
        status: 'alive',
        pageCap: 50,
        targetMode: 'dataset',
        visibility: 'private',
      },
    ],
  })
  await bench.deployDefinitions({definitions: [...definitions], expectedMinReaderModel: 10})
  const {instance} = await bench.startInstance({
    definition: 'resurrection',
    initialFields: [subjectField('seance-empty', {type: 'seance'})],
  })
  await beginExhumation(bench, instance._id)
  await completeEffect(bench, instance._id, EFFECTS.exhume)
  await completeEffect(bench, instance._id, EFFECTS.autopsy)
  await acceptAnatomy(bench, instance._id)
  await completeEffect(bench, instance._id, EFFECTS.interrogate, 'done', {
    ops: [
      {
        type: 'field.set',
        target: {scope: 'workflow', field: 'openRequiredQuestions'},
        value: {type: 'literal', value: 0},
      },
    ],
  })
  await completeEffect(bench, instance._id, EFFECTS.reanimate)
  await completeEffect(bench, instance._id, EFFECTS.planRitual)
  expect(await bench.currentStage(instance._id)).toBe('rising')
})

test('accept-anatomy waits for pending autopsy-rerun before leaving autopsy', async () => {
  const {bench, instance} = await startResurrection()
  await throughAutopsyInference(bench, instance._id)
  await bench.fireAction({
    instanceId: instance._id,
    activity: 'accept',
    action: 'rerun-autopsy',
    actor: editor,
  })
  // Accept while rerun is pending — flag set, but stage stays autopsy.
  await bench.fireAction({
    instanceId: instance._id,
    activity: 'accept',
    action: 'accept-anatomy',
    actor: editor,
  })
  await bench.tick({instanceId: instance._id})
  expect(await bench.currentStage(instance._id)).toBe('autopsy')

  await completeEffect(bench, instance._id, EFFECTS.autopsyRerun)
  await bench.tick({instanceId: instance._id})
  expect(await bench.currentStage(instance._id)).toBe('interrogation')
})

test('rise failure can retry or entomb', async () => {
  const {bench, instance} = await startResurrection()
  await throughReanimating(bench, instance._id)
  await blessAllChildren(bench, instance._id)
  expect(await bench.currentStage(instance._id)).toBe('rising')

  await bench.fireAction({
    instanceId: instance._id,
    activity: 'publish',
    action: 'rise',
    actor: editor,
  })
  await completeEffect(bench, instance._id, EFFECTS.rise, 'failed')
  expect(await bench.currentStage(instance._id)).toBe('rising')

  await bench.fireAction({
    instanceId: instance._id,
    activity: 'publish',
    action: 'retry-rise',
    actor: editor,
  })
  await completeEffect(bench, instance._id, EFFECTS.riseRetry, 'failed')

  await bench.fireAction({
    instanceId: instance._id,
    activity: 'publish',
    action: 'entomb-rise',
    actor: editor,
  })
  expect(await bench.currentStage(instance._id)).toBe('entombed')
})

test('failed child does not satisfy all-settled (must be blessed)', async () => {
  const {bench, instance} = await startResurrection()
  await throughReanimating(bench, instance._id)
  const children = await bench.children({instanceId: instance._id, activity: 'page-rituals'})

  // Bless one; leave the other in reviewing with castFailed — not blessed.
  await completeEffect(bench, children[0]!._id, EFFECTS.cast)
  await bench.fireAction({
    instanceId: children[0]!._id,
    activity: 'review',
    action: 'approve',
    actor: editor,
  })
  await completeEffect(bench, children[1]!._id, EFFECTS.cast, 'failed')
  await bench.tick({instanceId: instance._id})
  expect(await bench.currentStage(instance._id)).toBe('ritual')

  await bench.fireAction({
    instanceId: children[1]!._id,
    activity: 'review',
    action: 'approve',
    actor: editor,
  })
  await bench.tick({instanceId: instance._id})
  expect(await bench.currentStage(instance._id)).toBe('rising')
})

test('duplicate start of the same seance is rejected', async () => {
  const {bench} = await startResurrection()
  await expect(
    bench.startInstance({
      definition: 'resurrection',
      initialFields: [subjectField('seance-1', {type: 'seance'})],
    }),
  ).rejects.toBeInstanceOf(StartNotAllowedError)
})
