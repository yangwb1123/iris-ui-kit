import { defineConfig } from 'tsup'
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { solidPlugin } from 'esbuild-plugin-solid'

// Babel-plugin-jsx-dom-expressions imports its DOM runtime helpers
// (template/insert/spread/…) from this specifier in every compiled
// component. It isn't a real package — `esbuildOptions.alias` below redirects
// it to `src/internal/lazyTemplate.ts`, which re-exports `solid-js/web`
// unchanged except for a lazy `template()` wrapper (see that file for why:
// solid-js/web's server build throws synchronously when its DOM helpers are
// *called*, and the compiler calls `template()` eagerly at module scope).
const DOM_RUNTIME_ALIAS = '@iris-ui-kit/solid-web-runtime'

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
  esbuildPlugins: [solidPlugin({ solid: { moduleName: DOM_RUNTIME_ALIAS } })],
  esbuildOptions(options) {
    options.alias = {
      ...options.alias,
      [DOM_RUNTIME_ALIAS]: resolve('src/internal/lazyTemplate.ts'),
    }
  },
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
