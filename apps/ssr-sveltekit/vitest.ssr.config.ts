import { defineConfig } from 'vitest/config'
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte'

// PASS 1 (node env): compiles `.svelte` to Svelte 5's SERVER build so
// `svelte/server`'s `render()` can produce real SSR HTML for the app's iris
// composition. See `src/__ssr_test__/hydrate.test.ts` for why server + client
// builds need two separate configs.
//
//   * `configFile: false` skips the app's `svelte.config.js` (whose
//     `vitePreprocess()` runs Vite's `preprocessCSS`, which crashes under
//     Vitest's lightweight transform — `PartialEnvironment` proxy error).
//   * `vitePreprocess({ script: true, style: false })` keeps the TS→JS script
//     transform (the published `@iris-ui-kit/svelte` `.svelte` files still carry
//     `lang="ts"`) but skips CSS preprocessing — the dist `<style>` blocks are
//     already plain CSS (svelte-package preprocessed them), so the svelte
//     compiler handles them natively.
export default defineConfig({
  plugins: [
    svelte({ configFile: false, preprocess: vitePreprocess({ script: true, style: false }) }),
  ],
  test: {
    environment: 'node',
    include: ['src/__ssr_test__/ssr-generate.test.ts'],
  },
})
