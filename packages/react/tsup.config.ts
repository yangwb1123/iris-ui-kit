import { defineConfig } from 'tsup'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Build the full barrel (`index`) plus a flattened entry per top-level group
 * (`form`, `theme`, `async`, `behaviors`, `layouts`, …) so consumers can
 * deep-import an area: `@iris-ui-kit/react/form`. Enumerated from the source tree
 * so it never drifts. Granularity is per-group rather than per-primitive
 * because bundling .d.ts for all ~60 component entries exhausts the dts worker;
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
    'react',
    'react-dom',
    '@iris-ui-kit/core',
    '@iris-ui-kit/skins',
    '@iris-ui-kit/theme',
    '@iris-ui-kit/tokens',
    '@iris-ui-kit/icons',
  ],
  // Every entry is interactive (hooks/state/effects), so each emitted module is
  // a React Server Components client boundary: prepend `'use client'` to every
  // .js/.cjs entry & chunk, so any import path (`@iris-ui-kit/react`,
  // `@iris-ui-kit/react/form`, …) can be used directly inside a Next.js App Router
  // Server Component without a manual client wrapper.
  //
  // We can't use esbuild's `banner` here: with `treeshake: true` tsup re-bundles
  // each chunk through Rollup, whose tree-shaker drops a bare `'use client'`
  // string as side-effect-free dead code. So we inject post-build (idempotent),
  // shifting each sourcemap down one line to stay accurate. Verified in CI by
  // scripts/check-rsc-directive.mjs (`pnpm check:rsc`).
  onSuccess: async () => {
    const dir = 'dist'
    for (const file of readdirSync(dir)) {
      if (!/\.(js|cjs)$/.test(file)) continue
      const path = join(dir, file)
      const code = readFileSync(path, 'utf8')
      if (/^['"]use client['"]/.test(code)) continue
      writeFileSync(path, "'use client'\n" + code)
      const mapPath = path + '.map'
      if (!existsSync(mapPath)) continue
      try {
        const map = JSON.parse(readFileSync(mapPath, 'utf8'))
        if (typeof map.mappings === 'string') {
          map.mappings = ';' + map.mappings
          writeFileSync(mapPath, JSON.stringify(map))
        }
      } catch {
        // Leave the map untouched (one-line offset) rather than risk corruption.
      }
    }
  },
})
