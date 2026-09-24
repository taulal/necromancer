import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {projectId: 'v9dl2xdi', dataset: 'hq'},
  typegen: {path: '../../packages/**/src/**/*.ts', generates: '../../packages/hq-schema/src/sanity.types.ts'},
})
