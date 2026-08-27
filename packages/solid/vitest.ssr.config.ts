import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

// Dedicated SSR config for the hydration / server-render tests
// (`src/hydration.test.tsx` and focused table SSR fixtures). It is intentionally separate from the default
// `vitest.config.ts` and from the production `tsup.config.ts` — it changes
// NEITHER.
//
// Why a second config is unavoidable:
//   * `renderToString` (Solid's SSR entry) lives in `solid-js/web`'s *server*
//     build, reachable only via the `node` resolve condition. The default
//     config resolves the `browser` condition, where `renderToString` is a stub
//     that returns `undefined` ("not supported in the browser").
//   * Components must be compiled with `generate: 'ssr'` + `hydratable: true`
//     to emit string templates with hydration keys; the default config compiles
//     `generate: 'dom'`.
// So SSR rendering needs its own module graph: `ssr: true`, the server
// condition, and a `node` environment. See the header note in
// `src/hydration.test.tsx` for why *real* `hydrate()` cannot run in the same
// in-process harness (it needs the mutually-exclusive client build + DOM
// compilation) and what this test asserts instead.
export default defineConfig({
  plugins: [solid({ ssr: true, solid: { generate: 'ssr', hydratable: true } })],
  resolve: {
    // Resolve the server build of solid-js/web (exposes a working
    // `renderToString`) and a single solid-js instance per worker.
    conditions: ['node'],
  },
  test: {
    environment: 'node',
    include: [
      'src/hydration.test.tsx',
      'src/primitives/table/batch-ft.ssr.test.tsx',
      'src/primitives/table/formula-tables.ssr.test.tsx',
    ],
    globals: false,
    isolate: true,
    // Inline solid + workspace deps so they are transformed by the SSR
    // pipeline (otherwise pre-bundled DOM copies leak in).
    server: { deps: { inline: [/solid-js/, /@solidjs/, /@iris-ui-kit/] } },
  },
})
