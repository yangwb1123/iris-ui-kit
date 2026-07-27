import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { fileURLToPath } from 'node:url'

/** Resolve a workspace package to its TS source entry (dev runs from source). */
const src = (name: string) =>
  fileURLToPath(
    new URL(`../../packages/${name}/src/index.${name === 'solid' ? 'tsx' : 'ts'}`, import.meta.url),
  )

// `serve` (dev) aliases @iris-ui-kit/* to source for instant HMR; `build`/`preview`
// bundle the real published dist artifacts. Each `@iris-ui-kit/core/*` subpath needs
// its OWN alias (listed BEFORE the bare `@iris-ui-kit/core` alias) because the
// bare-specifier alias maps to a file, not a directory.
export default defineConfig(({ command }) => ({
  plugins: [solid()],
  server: {
    port: 5182,
    strictPort: true,
  },
  resolve:
    command === 'serve'
      ? {
          alias: {
            '@iris-ui-kit/core/window': fileURLToPath(
              new URL('../../packages/core/src/window.ts', import.meta.url),
            ),
            '@iris-ui-kit/core/profile': fileURLToPath(
              new URL('../../packages/core/src/profile.ts', import.meta.url),
            ),
            '@iris-ui-kit/core/commands': fileURLToPath(
              new URL('../../packages/core/src/commands.ts', import.meta.url),
            ),
            '@iris-ui-kit/core/notifications': fileURLToPath(
              new URL('../../packages/core/src/notifications.ts', import.meta.url),
            ),
            '@iris-ui-kit/core/clipboard-history': fileURLToPath(
              new URL('../../packages/core/src/clipboard-history.ts', import.meta.url),
            ),
            '@iris-ui-kit/core/fs': fileURLToPath(
              new URL('../../packages/core/src/fs.ts', import.meta.url),
            ),
            '@iris-ui-kit/core/undo': fileURLToPath(
              new URL('../../packages/core/src/undo.ts', import.meta.url),
            ),
            '@iris-ui-kit/core': src('core'),
            '@iris-ui-kit/tokens': src('tokens'),
            '@iris-ui-kit/solid': src('solid'),
          },
        }
      : {},
  test: {
    environment: 'jsdom',
    globals: true,
    // The filename contains "jest-dom", which makes vite-plugin-solid skip
    // auto-injecting `@testing-library/jest-dom/vitest` (not a dep here).
    setupFiles: ['./vitest.setup.no-jest-dom.ts'],
  },
}))
