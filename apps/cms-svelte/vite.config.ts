import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Resolve a workspace package to its TS source entry (dev runs from source). */
const src = (name: string) =>
  fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url))

/** Resolve a workspace package's subpath entry (e.g. `core/undo`) to its source file. */
const srcSubpath = (name: string, subpath: string) =>
  fileURLToPath(new URL(`../../packages/${name}/src/${subpath}.ts`, import.meta.url))

/**
 * Alias every group subpath of a package (`@iris-ui-kit/svelte/form`, …) to its
 * source entry. The bare alias below is a string PREFIX match, so without these
 * entries first a deep import like `@iris-ui-kit/svelte/provider` (used inside
 * published plugin dist files) would resolve to `src/index.ts/provider` and
 * fail to load. Group dirs are directories (`src/provider/index.ts`), not bare
 * files — mirrors the package's own tsup entry enumeration.
 */
function subpathAliases(pkg: string, bare: string): Record<string, string> {
  const aliases: Record<string, string> = {}
  const srcDir = fileURLToPath(new URL(`../../packages/${pkg}/src`, import.meta.url))
  for (const dir of readdirSync(srcDir, { withFileTypes: true })) {
    if (dir.isDirectory() && existsSync(join(srcDir, dir.name, 'index.ts'))) {
      aliases[`${bare}/${dir.name}`] = fileURLToPath(
        new URL(`../../packages/${pkg}/src/${dir.name}/index.ts`, import.meta.url),
      )
    }
  }
  return aliases
}

// `serve` (dev) aliases @iris-ui-kit/* to source for instant HMR; `build`/`preview`
// bundle the real published dist artifacts.
export default defineConfig(({ command }) => ({
  plugins: [svelte()],
  server: {
    port: 5178,
    strictPort: true,
  },
  test: {
    // Playwright specs have their own runner and must not be collected by
    // Vitest's default `*.spec.ts` discovery.
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
  resolve: {
    // Svelte 5's package exports default to its server entry. Vite dev needs
    // the browser condition explicitly or `mount()` resolves to the SSR stub
    // and the application renders a blank page at runtime.
    conditions: ['browser'],
    ...(command === 'serve'
      ? {
          alias: {
            // Subpath aliases must precede the bare `@iris-ui-kit/core` alias below —
            // the bare alias maps to a single file (`src/index.ts`), so without a
            // more specific entry first, a deep import like `@iris-ui-kit/core/undo`
            // (used internally by `@iris-ui-kit/svelte`'s undo module) would resolve
            // against that file instead of `src/undo.ts` and fail to load.
            '@iris-ui-kit/core/undo': srcSubpath('core', 'undo'),
            '@iris-ui-kit/core': src('core'),
            '@iris-ui-kit/tokens': src('tokens'),
            '@iris-ui-kit/theme': src('theme'),
            '@iris-ui-kit/skins': src('skins'),
            '@iris-ui-kit/icons': src('icons'),
            '@iris-ui-kit/svelte/form': srcSubpath('svelte', 'form/index'),
            ...subpathAliases('svelte', '@iris-ui-kit/svelte'),
            '@iris-ui-kit/svelte': src('svelte'),
          },
        }
      : {}),
  },
}))
