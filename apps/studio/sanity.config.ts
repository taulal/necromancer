import {hqSchemaTypes} from '@necro/hq-schema'
import {visionTool} from '@sanity/vision'
import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'

export default defineConfig({
  name: 'hq',
  title: 'Necromancer HQ',
  projectId: 'v9dl2xdi',
  dataset: 'hq',
  plugins: [structureTool(), visionTool()],
  schema: {types: hqSchemaTypes},
})
