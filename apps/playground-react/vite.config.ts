import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Resolve a workspace package to its TypeScript source entry.
 * Used in dev so the playground runs the libraries straight from source —
 * no build step, and edits to any `@iris-ui-kit/*` package hot-reload instantly.
 */
const src = (name: string) =>
  fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url))

/** Resolve a workspace package's subpath entry (e.g. `core/undo`) to its source file. */
const srcSubpath = (name: string, subpath: string) =>
  fileURLToPath(new URL(`../../packages/${name}/src/${subpath}.ts`, import.meta.url))

/**
 * Alias every group subpath of a package (`@iris-ui-kit/react/form`, …) to its
 * source entry. The bare alias below is a string PREFIX match, so without these
 * entries first a deep import like `@iris-ui-kit/react/provider` (used inside
 * published plugin dist files) would resolve to `src/index.ts/provider` and
 * fail to load. Mirrors the package's own `tsup` entry enumeration so it never
 * drifts.
 */
function subpathAliases(pkg: string, bare: string): Record<string, string> {
  const aliases: Record<string, string> = {}
  const srcDir = fileURLToPath(new URL(`../../packages/${pkg}/src`, import.meta.url))
  for (const dir of readdirSync(srcDir, { withFileTypes: true })) {
    if (dir.isDirectory() && existsSync(join(srcDir, dir.name, 'index.ts'))) {
      // Group dirs are directories (`src/provider/index.ts`), not bare files.
      aliases[`${bare}/${dir.name}`] = fileURLToPath(
        new URL(`../../packages/${pkg}/src/${dir.name}/index.ts`, import.meta.url),
      )
    }
  }
  return aliases
}

// In `serve` (dev) we alias to source; in `build` (and the `preview` that
// serves it) we leave the aliases off so the app bundles the real published
// `dist` artifacts.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
  },
  resolve:
    command === 'serve'
      ? {
          alias: {
            // Subpath aliases must precede the bare `@iris-ui-kit/core` alias below —
            // the bare alias maps to a single file (`src/index.ts`), so without a
            // more specific entry first, a deep import like `@iris-ui-kit/core/undo`
            // (used internally by `@iris-ui-kit/react`'s undo module) would resolve
            // against that file instead of `src/undo.ts` and fail to load.
            '@iris-ui-kit/core/undo': srcSubpath('core', 'undo'),
            '@iris-ui-kit/core': src('core'),
            '@iris-ui-kit/tokens': src('tokens'),
            '@iris-ui-kit/theme': src('theme'),
            '@iris-ui-kit/skins': src('skins'),
            '@iris-ui-kit/icons': src('icons'),
            ...subpathAliases('react', '@iris-ui-kit/react'),
            '@iris-ui-kit/react': src('react'),
          },
        }
      : {},
}))
