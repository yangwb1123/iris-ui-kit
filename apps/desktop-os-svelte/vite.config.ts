/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { fileURLToPath } from 'node:url'

/** Resolve a workspace package to its TS source entry (dev runs from source). */
const src = (name: string) =>
  fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url))

/** The window manager lives off the core path — alias its subpath to source too. */
const windowSrc = fileURLToPath(new URL('../../packages/core/src/window.ts', import.meta.url))

// `serve` (dev) aliases @iris-ui/* to source for instant HMR; `build`/`preview`
// bundle the real published dist artifacts. The `@iris-ui/core/window` subpath
// alias MUST come before the bare `@iris-ui/core` alias so it wins.
export default defineConfig(({ command }) => ({
  plugins: [svelte()],
  server: {
    port: 5183,
    strictPort: true,
  },
  resolve: {
    // Svelte exposes its client `mount`/`unmount` API under the `browser`
    // condition; needed so the vitest (jsdom) run picks the client build.
    conditions: ['browser'],
    alias:
      command === 'serve'
        ? {
            '@iris-ui/core/window': windowSrc,
            '@iris-ui/core': src('core'),
            '@iris-ui/tokens': src('tokens'),
            '@iris-ui/svelte': src('svelte'),
          }
        : {},
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
}))
