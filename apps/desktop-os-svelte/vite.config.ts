/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { fileURLToPath } from 'node:url'

/** Resolve a workspace package to its TS source entry (dev runs from source). */
const src = (name: string) =>
  fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url))

/** The core off-path subpaths (window/profile/commands) — alias each to source too. */
const coreSubpath = (name: string) =>
  fileURLToPath(new URL(`../../packages/core/src/${name}.ts`, import.meta.url))

// `serve` (dev) aliases @iris-ui-kit/* to source for instant HMR; `build`/`preview`
// bundle the real published dist artifacts. The `@iris-ui-kit/core/*` subpath aliases
// MUST come before the bare `@iris-ui-kit/core` alias so they win.
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
            '@iris-ui-kit/core/window': coreSubpath('window'),
            '@iris-ui-kit/core/profile': coreSubpath('profile'),
            '@iris-ui-kit/core/commands': coreSubpath('commands'),
            '@iris-ui-kit/core/notifications': coreSubpath('notifications'),
            '@iris-ui-kit/core/clipboard-history': coreSubpath('clipboard-history'),
            '@iris-ui-kit/core/fs': coreSubpath('fs'),
            '@iris-ui-kit/core/undo': coreSubpath('undo'),
            '@iris-ui-kit/core/grid': coreSubpath('grid'),
            '@iris-ui-kit/core': src('core'),
            '@iris-ui-kit/tokens': src('tokens'),
            '@iris-ui-kit/svelte': src('svelte'),
          }
        : {},
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
}))
