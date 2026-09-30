import { defineConfig } from 'tsup'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, isAbsolute, join, relative } from 'node:path'

/**
 * Build the full barrel (`index`) plus a flattened entry per top-level group
 * (`form`, `theme`, `async`, `behaviors`, `layouts`, …) so consumers can
 * deep-import an area: `@iris-ui-kit/vue/form`. Enumerated from the source tree so
 * it never drifts. Granularity is per-group rather than per-primitive because
 * bundling .d.ts for all ~60 component entries exhausts the dts worker;
 * per-group keeps the build robust while still enabling area-scoped imports.
 */
function buildEntries(): Record<string, string> {
  const entries: Record<string, string> = { index: 'src/index.ts' }
  for (const dir of readdirSync('src', { withFileTypes: true })) {
    if (dir.isDirectory() && dir.name !== 'primitives') {
      const path = join('src', dir.name, 'index.ts')
      if (existsSync(path)) entries[dir.name] = path
    }
  }
  // `floating` + `modal-utils` live under primitives/ in the Vue tree but are
  // framework utilities (hooks), not components. Surface them as flat deep
  // entries so consumers get the same `@iris-ui-kit/vue/floating` /
  // `@iris-ui-kit/vue/modal-utils` paths the React adapter already exposes
  // (consumer import-path parity).
  for (const name of ['floating', 'modal-utils']) {
    const path = join('src', 'primitives', name, 'index.ts')
    if (existsSync(path)) entries[name] = path
  }
  return entries
}

/**
 * Vue's defineComponent is a type-inference helper with no call-time effects;
 * annotate it so consumer bundlers can remove unused siblings from the barrel.
 * Keep this transform scoped to Vue source because purity is framework-specific.
 */
const vuePureDefineComponentPlugin = {
  name: 'vue-define-component-purity',
  setup(build: import('esbuild').PluginBuild) {
    const sourceRoot = join(process.cwd(), 'src')
    build.onLoad({ filter: /\.[jt]sx?$/ }, ({ path }) => {
      const relativePath = relative(sourceRoot, path)
      if (relativePath.startsWith('..') || isAbsolute(relativePath)) return
      const source = readFileSync(path, 'utf8')
      const contents = source.replace(/\bdefineComponent\s*\(/g, '/* @__PURE__ */ defineComponent(')
      if (contents === source) return
      return {
        contents,
        loader: path.endsWith('.tsx') ? 'tsx' : 'ts',
        resolveDir: dirname(path),
      }
    })
  },
}

export default defineConfig({
  entry: buildEntries(),
  esbuildPlugins: [vuePureDefineComponentPlugin],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
  external: [
    'vue',
    '@iris-ui-kit/core',
    '@iris-ui-kit/skins',
    '@iris-ui-kit/theme',
    '@iris-ui-kit/tokens',
    '@iris-ui-kit/icons',
  ],
})
