import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { fileURLToPath } from 'node:url'

/** Resolve a workspace package to its TS source entry (dev runs from source). */
const src = (name: string) =>
  fileURLToPath(
    new URL(`../../packages/${name}/src/index.${name === 'solid' ? 'tsx' : 'ts'}`, import.meta.url),
  )

// `serve` (dev) aliases @iris-ui/* to source for instant HMR; `build`/`preview`
// bundle the real published dist artifacts. The `@iris-ui/core/window` subpath
// needs its own alias (listed BEFORE the bare `@iris-ui/core` alias) because the
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
            '@iris-ui/core/window': fileURLToPath(
              new URL('../../packages/core/src/window.ts', import.meta.url),
            ),
            '@iris-ui/core': src('core'),
            '@iris-ui/tokens': src('tokens'),
            '@iris-ui/solid': src('solid'),
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
