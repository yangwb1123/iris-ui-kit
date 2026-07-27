import { defineConfig } from 'tsup'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { solidSsrSafeBuild } from '../../scripts/solid-ssr-build.ts'

/**
 * Build the full barrel (`index`) plus a flattened entry per top-level group
 * (`theme`, `skins`, `admin`, …) so consumers can deep-import an area:
 * `@iris-ui-kit/solid/admin`. Enumerated from the source tree so it never drifts.
 *
 * Solid JSX cannot be compiled by esbuild alone — `esbuild-plugin-solid` runs
 * babel-preset-solid so the output is real Solid reactivity (not React-style
 * createElement). Output is pre-compiled-for-DOM, which works in any Solid app.
 */
function buildEntries(): Record<string, string> {
  const entries: Record<string, string> = { index: 'src/index.tsx' }
  for (const dir of readdirSync('src', { withFileTypes: true })) {
    if (dir.isDirectory() && dir.name !== 'primitives') {
      const ts = join('src', dir.name, 'index.ts')
      const tsx = join('src', dir.name, 'index.tsx')
      const entry = existsSync(tsx) ? tsx : existsSync(ts) ? ts : undefined
      if (entry) entries[dir.name] = entry
    }
  }
  return entries
}

export default defineConfig({
  entry: buildEntries(),
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
  ...solidSsrSafeBuild(),
  external: [
    'solid-js',
    'solid-js/web',
    'solid-js/store',
    '@iris-ui-kit/core',
    '@iris-ui-kit/skins',
    '@iris-ui-kit/theme',
    '@iris-ui-kit/tokens',
    '@iris-ui-kit/icons',
    '@floating-ui/dom',
  ],
})
