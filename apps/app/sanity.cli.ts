import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  app: {
    organizationId: 'oEouFCZpW',
    entry: './src/App.tsx',
    title: 'Necromancer',
  },
  // First deploy: `bun run deploy -- --create --title "Necromancer" --yes --json`,
  // then save application.id here as deployment.appId and drop --create.
  // deployment: {appId: ''},
})
