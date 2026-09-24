/**
 * Deploy config for the `sanity-workflows` CLI (`bun run workflows:deploy`).
 * Definitions + instances live in the HQ dataset under the `necromancer` tag.
 * All @sanity/workflow-* packages are exact-version peers: bump them together.
 */
import {defineWorkflowConfig} from '@sanity/workflow-engine/define'
import {definitions} from './packages/rituals/src/definitions'

const PROJECT_ID = process.env.SANITY_PROJECT_ID ?? 'v9dl2xdi'
const DATASET = process.env.SANITY_HQ_DATASET ?? 'hq'

export default defineWorkflowConfig({
  deployments: [
    {
      name: 'necromancer',
      tag: 'necromancer',
      // TODO(NEC-06): confirm the reader-model floor required by engine 0.35 (was 4 on 0.28).
      expectedMinReaderModel: 4,
      workflowResource: {type: 'dataset', id: `${PROJECT_ID}.${DATASET}`},
      definitions,
    },
  ],
})
