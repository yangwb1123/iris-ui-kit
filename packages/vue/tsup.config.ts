import { defineConfig } from 'tsup'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Build the full barrel (`index`) plus a flattened entry per top-level group
 * (`form`, `theme`, `async`, `behaviors`, `layouts`, …) so consumers can
 * deep-import an area: `@iris-ui/vue/form`. Enumerated from the source tree so
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
  external: [
    'vue',
    '@iris-ui/core',
    '@iris-ui/skins',
    '@iris-ui/theme',
    '@iris-ui/tokens',
    '@iris-ui/icons',
  ],
})
