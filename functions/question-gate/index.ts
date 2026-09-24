/**
 * Recompute openRequiredQuestions whenever a required question changes (review F4).
 * Blueprint deploy stays NO-GO until Vessel/drain F1–F3 land; this Function is ready.
 */
import {createClient} from '@sanity/client'
import {documentEventHandler} from '@sanity/functions'
import {createEngine, ENGINE_API_VERSION} from '@sanity/workflow-engine'

const PROJECT_ID = process.env.SANITY_PROJECT_ID ?? 'v9dl2xdi'
const DATASET = process.env.SANITY_HQ_DATASET ?? 'hq'
const TAG = process.env.SANITY_WORKFLOW_TAG ?? 'necromancer'

type QuestionDoc = {
  seance?: {_ref?: string}
  required?: boolean
}

function client() {
  const token = process.env.SANITY_HQ_WRITE_TOKEN?.trim()
  if (!token) throw new Error('SANITY_HQ_WRITE_TOKEN required')
  return createClient({
    projectId: PROJECT_ID,
    dataset: DATASET,
    apiVersion: ENGINE_API_VERSION,
    token,
    useCdn: false,
    perspective: 'raw',
  })
}

export async function syncOpenRequiredQuestions(seanceId: string): Promise<number> {
  const c = client()
  const published = seanceId.replace(/^drafts\./, '')
  const count = await c.fetch<number>(
    `count(*[_type == "question" && seance._ref in [$published, $draft] && required == true && !defined(answer)])`,
    {published, draft: `drafts.${published}`},
  )

  const instanceId = (await c.fetch(
    `*[
      _type == "sanity.workflow.instance" &&
      tag == $tag &&
      definition.name == "resurrection" &&
      status == "active" &&
      count(fields[name == "subject" && (
        value.id == $published ||
        value.id == $draft ||
        string(value.id) match "*" + $published
      )]) > 0
    ][0]._id`,
    {tag: TAG, published, draft: `drafts.${published}`} as Record<string, string>,
  )) as string | null

  if (typeof instanceId !== 'string' || !instanceId) {
    console.log(`[question-gate] no active resurrection for ${published}; count=${count}`)
    return count
  }

  const engine = createEngine({
    client: c,
    workflowResource: {type: 'dataset', id: `${PROJECT_ID}.${DATASET}`},
    tag: TAG,
    effects: {handlers: {}, missingHandler: 'fail'},
    executionContext: {kind: 'server', id: 'question-gate'},
  })

  // Actor is derived from the client token (EngineScopeArgs), not passed here.
  await engine.editField({
    instanceId,
    target: {scope: 'workflow', field: 'openRequiredQuestions'},
    mode: 'set',
    value: count,
  })
  console.log(`[question-gate] ${instanceId} openRequiredQuestions=${count}`)
  return count
}

export const handler = documentEventHandler(async ({event}) => {
  const after = (event as {data?: {after?: QuestionDoc; before?: QuestionDoc}}).data?.after
  const before = (event as {data?: {after?: QuestionDoc; before?: QuestionDoc}}).data?.before
  const seanceId = after?.seance?._ref ?? before?.seance?._ref
  if (!seanceId) {
    console.warn('[question-gate] question event without seance ref — skip')
    return
  }
  if (after?.required === false && before?.required === false) return
  await syncOpenRequiredQuestions(seanceId)
})
