import {useWorkflowEngine} from '@sanity/workflow-sdk'
import {WORKFLOW_RESOURCE, WORKFLOW_TAG} from './config'

/**
 * App-side engine for starting/firing resurrection with the signed-in user.
 * No tokens — the SDK client carries the Dashboard session.
 */
export function useNecroEngine() {
  return useWorkflowEngine({
    workflowResource: WORKFLOW_RESOURCE,
    tag: WORKFLOW_TAG,
  })
}
