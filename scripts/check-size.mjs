#!/usr/bin/env node
// Bundle-size budget gate (ROADMAP #5). Gzips each library's built ESM entry
// and fails if it exceeds its budget — a tripwire against the "components keep
// getting fatter" regression. Zero dependencies (node:zlib); run after build:
//
//   pnpm turbo run build && pnpm size
//
// Budgets are gzipped KB of dist/index.js, set with headroom above the current
// size. Raise a budget deliberately (in a reviewed commit) when a real feature
// grows a package — that visibility is the point.
import { gzipSync } from 'node:zlib'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const UPDATE_BASELINE = process.argv.includes('--update-baseline')

/** Gzipped-KB budget per package entry. */
const BUDGETS = {
  // Bumped 13→14 (R33): the dir-3 a11y/i18n sweep adds component-facing default
  // copy to defaultMessages (calendar/select/table/commandPalette/alert/banner/
  // chip/toast …) so labels are localizable via t(). Real feature surface, not
  // drift; headroom left for the remaining keys in the sweep.
  // Bumped 14→15 (R45): admin/errorBoundary i18n keys + the dir-1 data engine
  // additions (memoized filterSort, debounce, aggregate/summarize/groupRows).
  // Genuine shared logic — core is the framework-agnostic logic home by design.
  // Bumped 15→16 (R54): more dir-1 engine material (subscribeWith, 2D virtual
  // primitive, nextGridCell grid-roving) + plugin dependency-ordering topo sort.
  // Bumped 16→18 (R69): the dir-1 keystone — createDataSource (the unified data
  // engine: multi-sort, typed filters, paged+infinite, per-row pending/error,
  // optimistic mutate) + createCellEdit + column accessors. The convergence
  // round (pro-table/resource → createDataSource) is expected to reclaim some of
  // this by replacing their duplicated logic with thin wrappers.
  // Bumped 18→21 (v3 R10): createVirtualizer — the stateful measurement-feedback
  // virtualizer (keyed measured-size cache + a Fenwick/BIT tree for O(log n)
  // incremental offsets and lower-bound, scroll-anchoring, scrollToIndex). This
  // is the scale engine that removes the flagship grid's 100k-row cliff; the
  // Fenwick math is the bytes. Wiring it into pro-table/base Table (R12/R13) is
  // expected to reclaim some by deleting their bespoke row rendering.
  // Bumped 21→23 (v3 R11): createColumnState — the resize/pin/reorder/visibility
  // controller that defines an enterprise grid, sunk to core so the 4 adapters +
  // pro-table share one implementation instead of re-coding drag-reorder each.
  core: 23,
  tokens: 2,
  theme: 3.5,
  skins: 5,
  icons: 4,
  react: 80,
  vue: 88,
  // Bumped 85→87 (v3 R10): the adapters re-export core's new createVirtualizer
  // through their barrel; react/vue had headroom, solid sat at the edge.
  solid: 87,
  svelte: 6,
  manifest: 2,
}

/**
 * Per-EXPORT import-cost tripwires — the gzip cost a consumer pays to import a
 * SINGLE thing, which the whole-bundle budget above is blind to. Today icons
 * ship as one `defaultIcons` object literal (no per-icon exports), so importing
 * ANY icon pulls the entire set: this measures + caps that unavoidable payload so
 * it can't silently bloat, and stands as the explicit marker of a known
 * non-tree-shakeable export (a future round can split icons into per-icon
 * modules and shrink this dramatically).
 */
const IMPORT_PROBES = [
  {
    name: 'icons: import any → full defaultIcons map',
    budgetKb: 6,
    async measure() {
      const entry = join(repoRoot, 'packages/icons/dist/index.js')
      if (!existsSync(entry)) return null
      const mod = await import(pathToFileURL(entry).href)
      const map = mod.defaultIcons ?? {}
      const count = Object.keys(map).length
      const gzipKb = gzipSync(Buffer.from(JSON.stringify(map))).length / KB
      return { gzipKb, note: `${count} icons, non-tree-shakeable` }
    },
  },
]

const KB = 1024
const baselinePath = join(repoRoot, 'scripts', 'size-baseline.json')
const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : {}
const current = {}
let failed = false
const rows = []

/** Format the delta vs the committed baseline (advisory — never fails). */
const deltaOf = (key, kb) => {
  const prev = baseline[key]
  if (prev === undefined) return ''
  const d = kb - prev
  if (Math.abs(d) < 0.05) return ' (Δ ~0)'
  return ` (Δ ${d > 0 ? '+' : ''}${d.toFixed(1)}KB)`
}

for (const [pkg, budgetKb] of Object.entries(BUDGETS)) {
  const entry = join(repoRoot, 'packages', pkg, 'dist', 'index.js')
  if (!existsSync(entry)) {
    rows.push({ pkg, status: 'MISSING', detail: 'dist/index.js not found — run build first' })
    failed = true
    continue
  }
  const gzipKb = gzipSync(readFileSync(entry)).length / KB
  current[pkg] = Number(gzipKb.toFixed(2))
  const over = gzipKb > budgetKb
  if (over) failed = true
  rows.push({
    pkg,
    status: over ? 'OVER' : 'ok',
    detail: `${gzipKb.toFixed(1)}KB / ${budgetKb}KB gzip${deltaOf(pkg, gzipKb)}`,
  })
}

for (const probe of IMPORT_PROBES) {
  const result = await probe.measure()
  if (!result) {
    rows.push({ pkg: probe.name, status: 'MISSING', detail: 'build first' })
    failed = true
    continue
  }
  const key = `probe:${probe.name}`
  current[key] = Number(result.gzipKb.toFixed(2))
  const over = result.gzipKb > probe.budgetKb
  if (over) failed = true
  rows.push({
    pkg: probe.name,
    status: over ? 'OVER' : 'ok',
    detail: `${result.gzipKb.toFixed(1)}KB / ${probe.budgetKb}KB gzip${deltaOf(key, result.gzipKb)} — ${result.note}`,
  })
}

if (UPDATE_BASELINE) {
  writeFileSync(baselinePath, JSON.stringify(current, null, 2) + '\n')
  // eslint-disable-next-line no-console
  console.log(`\nWrote size baseline → scripts/size-baseline.json (${Object.keys(current).length} entries)\n`)
}

const pad = (s, n) => String(s).padEnd(n)
// eslint-disable-next-line no-console
console.log('\nBundle size budget (gzip)\n' + '─'.repeat(48))
for (const r of rows) {
  const mark = r.status === 'ok' ? '✓' : '✗'
  // Package rows get the @iris-ui/ prefix + aligned columns; probe rows (whose
  // name carries spaces) print as a free-form line.
  const label = r.pkg.includes(' ') ? r.pkg : '@iris-ui/' + r.pkg
  // eslint-disable-next-line no-console
  console.log(`${mark} ${pad(label, 20)} ${pad(r.status, 8)} ${r.detail}`)
}
// eslint-disable-next-line no-console
console.log('─'.repeat(48))

if (failed) {
  // eslint-disable-next-line no-console
  console.error('\n✗ size budget exceeded — trim the change or raise the budget deliberately.\n')
  process.exit(1)
}
// eslint-disable-next-line no-console
console.log('\n✓ all packages within budget\n')
