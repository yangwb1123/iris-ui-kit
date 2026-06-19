import { defineConfig } from 'vitest/config'
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte'

// PASS 2 (jsdom env): compiles `.svelte` to Svelte 5's CLIENT (DOM) build so
// `mount(…, { hydrate:true })` can hydrate the SSR HTML produced by PASS 1.
//
//   * Same `configFile:false` + `style:false` preprocessing rationale as
//     `vitest.ssr.config.ts`.
//   * `resolve.conditions` puts `browser` before `node` so `svelte` resolves to
//     its CLIENT entry (the one that exposes `mount`/`hydrate`; the node entry
//     only has the server stubs that throw "mount is not available on the
//     server"). This is exactly what `@testing-library/svelte`'s
//     `svelteTesting()` plugin does, inlined so the app needs no new dependency.
export default defineConfig({
  plugins: [
    svelte({ configFile: false, preprocess: vitePreprocess({ script: true, style: false }) }),
  ],
  resolve: { conditions: ['browser', 'development', 'module', 'default'] },
  test: {
    environment: 'jsdom',
    include: ['src/__ssr_test__/hydrate.test.ts'],
  },
})
