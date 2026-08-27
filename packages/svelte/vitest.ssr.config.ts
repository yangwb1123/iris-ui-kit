import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Dedicated SSR config for the server-render / hydration-safety test ONLY
// (`src/hydration.test.ts`). It is intentionally separate from the default
// `vitest.config.ts` and from the production build (`svelte-package` via
// `svelte.config.js`) — it changes NEITHER.
//
// Why a second config is unavoidable:
//   * `render` from `svelte/server` requires the component to be compiled to
//     Svelte 5's *server* output (string templates with hydration markers).
//   * The default `vitest.config.ts` adds `svelteTesting()`, which puts the
//     `browser` resolve condition first and runs in jsdom — so `.svelte` files
//     compile to the *client* (DOM) build. Feeding a client-compiled component
//     to `svelte/server`'s `render()` throws ("Cannot read properties of null
//     (reading 'nodes')"), because the server renderer is handed client output.
//   * Here we drop `svelteTesting()` and run in the `node` environment. Vitest
//     then loads `.svelte` through its SSR module graph, so vite-plugin-svelte
//     compiles them to the server build and `render()` works.
//
// See the header note in `src/hydration.test.ts` for why a *real* in-process
// `hydrate()` onto this SSR markup is not achievable in this harness without
// changing the production build (it needs the mutually-exclusive client build
// + DOM compilation in the same module graph) and what this test asserts
// instead. The `@iris-ui-kit/*` workspace deps are inlined so they are transformed
// by the SSR pipeline rather than leaking a pre-bundled copy.
export default defineConfig({
  plugins: [svelte()],
  test: {
    environment: 'node',
    include: [
      'src/hydration.test.ts',
      'src/primitives/table/formula-tables.ssr.test.ts',
      'src/primitives/table/undo.ssr.test.ts',
      'src/primitives/table/grid-columns.ssr.test.ts',
    ],
    server: { deps: { inline: [/@iris-ui-kit/] } },
  },
})
