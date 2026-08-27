import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

// The SSR fixture is produced with hydratable markers; this companion config
// uses the DOM compiler before calling Solid's real hydrate().
export default defineConfig({
  plugins: [solid({ solid: { generate: 'dom', hydratable: true } })],
  resolve: {
    conditions: ['development', 'browser'],
  },
  test: {
    environment: 'jsdom',
    include: ['src/primitives/table/batch-fade-solid.hydration.test.tsx'],
    globals: false,
    isolate: true,
  },
})
