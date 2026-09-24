import {hqSchemaTypes} from '@necro/hq-schema'
import {visionTool} from '@sanity/vision'
import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {workflowDefaultDocumentNode, workflowStudioPlugin} from '@sanity/workflow-studio-plugin'

/**
 * Internal HQ Studio — schema deploy + raw doc inspection.
 * Workflows plugin (0.35.0) peers sanity ^6.15; we are on ^6.16.
 * Tag matches sanity.workflow.ts / App WORKFLOW_TAG.
 */
export default defineConfig({
  name: 'hq',
  title: 'Necromancer HQ',
  projectId: 'v9dl2xdi',
  dataset: 'hq',
  plugins: [
    structureTool({
      defaultDocumentNode: workflowDefaultDocumentNode(),
    }),
    visionTool(),
    workflowStudioPlugin({
      tag: 'necromancer',
      mappings: [
        // App / summon starts resurrection — do not auto-start from Studio.
        {
          docType: 'seance',
          definition: 'resurrection',
          label: 'Resurrection',
          autoStart: false,
        },
        // Child runs for inspection (lifecycle: child — started by fan-out).
        {
          docType: 'exhumedPage',
          definition: 'page-ritual',
          label: 'Page ritual',
          autoStart: false,
        },
      ],
    }),
  ],
  schema: {types: hqSchemaTypes},
})
