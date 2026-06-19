import { fileURLToPath } from 'node:url'
import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

// App-level SSR + real-hydrate test config for ssr-solidstart.
//
// The test (`src/hydration.test.tsx`) runs in jsdom and does the genuine
// renderToString -> hydrate round-trip on the app's iris composition:
//   * the CLIENT side (this config) runs in jsdom; vite-plugin-solid is given
//     `ssr:true` so the *non-ssr* transform emits `generate:'dom'` +
//     `hydratable:true` — the build `hydrate()` needs to reconcile against
//     server markup. `solid-js/web` resolves to its client build here, so
//     `hydrate` is real.
//   * the SERVER side is produced inside the test by spinning a short-lived
//     Vite SSR server and `ssrLoadModule`-ing `src/iris-tree.ssr.tsx`, which
//     is compiled `generate:'ssr'` against the server `solid-js/web`
//     (the only build with a working `renderToString`). See the test header.
//
// `@iris-ui/solid` is aliased to its SOURCE so the iris primitives are compiled
// fresh in each target (dom-hydratable / ssr-hydratable). The published dist is
// compiled `hydratable:false`, which cannot reconcile with SSR markers — hence
// the source alias, the same way the package-level SSR test imports source.
const irisSolidSrc = fileURLToPath(new URL('../../packages/solid/src/index.tsx', import.meta.url))

export default defineConfig({
  plugins: [solid({ ssr: true })],
  resolve: {
    alias: { '@iris-ui/solid': irisSolidSrc },
    // Client (browser) build of solid-js/web so the test's own `hydrate`
    // import is the real DOM hydrator. The in-test SSR server overrides this
    // with the node condition for its own (server) module graph.
    conditions: ['browser', 'development'],
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // Filename contains "jest-dom" so vite-plugin-solid skips auto-injecting
    // an unresolvable @testing-library/jest-dom setup file (not a dependency).
    setupFiles: ['./vitest.setup.no-jest-dom.ts'],
    globals: false,
    isolate: true,
    // Inline solid + workspace deps so the solid-js singleton + iris source are
    // transformed by this pipeline (no pre-bundled DOM copies leaking in).
    server: { deps: { inline: [/solid-js/, /@solidjs/, /@iris-ui/] } },
  },
})
