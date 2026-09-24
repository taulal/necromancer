import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/app/src/**/*.test.ts'],
  },
})
