import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { fileURLToPath } from 'node:url'

/** Resolve a workspace package to its TS source entry (dev runs from source). */
const src = (name: string) =>
  fileURLToPath(
    new URL(`../../packages/${name}/src/index.${name === 'solid' ? 'tsx' : 'ts'}`, import.meta.url),
  )

/** Resolve a workspace package's subpath entry (e.g. `core/undo`) to its source file. */
const srcSubpath = (name: string, subpath: string) =>
  fileURLToPath(new URL(`../../packages/${name}/src/${subpath}.ts`, import.meta.url))

// `serve` (dev) aliases @iris-ui-kit/* to source for instant HMR; `build`/`preview`
// bundle the real published dist artifacts.
export default defineConfig(({ command }) => ({
  plugins: [solid()],
  server: {
    port: 5177,
    strictPort: true,
  },
  resolve:
    command === 'serve'
      ? {
          alias: {
            // Subpath aliases must precede the bare `@iris-ui-kit/core` alias below —
            // the bare alias maps to a single file (`src/index.tsx`), so without a
            // more specific entry first, a deep import like `@iris-ui-kit/core/undo`
            // (used internally by `@iris-ui-kit/solid`'s undo module) would resolve
            // against that file instead of `src/undo.ts` and fail to load.
            '@iris-ui-kit/core/undo': srcSubpath('core', 'undo'),
            '@iris-ui-kit/core': src('core'),
            '@iris-ui-kit/tokens': src('tokens'),
            '@iris-ui-kit/theme': src('theme'),
            '@iris-ui-kit/skins': src('skins'),
            '@iris-ui-kit/icons': src('icons'),
            '@iris-ui-kit/solid/form': srcSubpath('solid', 'form/index'),
            '@iris-ui-kit/solid': src('solid'),
          },
        }
      : {},
}))
