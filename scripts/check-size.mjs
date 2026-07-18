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
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const UPDATE_BASELINE = process.argv.includes('--update-baseline')
const KB = 1024

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
  // Bumped 23→24 (v3 R19): the nested-path form engine — path.ts (parse/format/
  // get/set with structural sharing + rekeyByArrayMutation) plus the form
  // setters keying errors/touched/dirty/validating by full path and the array
  // helpers re-keying per-element state across insert/remove/move/swap. This is
  // the table-stakes capability that unblocks plugin-form-builder array/sub-form
  // field types; ~1.4KB for a genuinely new engine, not drift.
  // Bumped 24→25: Direction-4 statechart-timing primitives sunk to core —
  // createAutoDismiss (Toast auto-dismiss on the after-machine, replacing 4 hand-
  // rolled setTimeout maps) + createLongPress (press-hold gesture) + machine
  // Scheduler.now() + createColumnState pinned state. ~0.9KB of genuinely new
  // framework-agnostic timing/column logic, not drift.
  // Bumped 25→28 (2026-07-12): Plugin Token & Store Namespace Isolation —
  // namespaceTokenKey, namespaceStoreKey, validateNamespace,
  // detectNamespaceConflicts, createNamespacedRegistry helper functions,
  // IrisPlugin.namespace field, PluginRegistry.readStore method, plus
  // namespace-aware registry wrapping in runPlugins. ~3KB of genuinely new
  // plugin isolation logic.
  // Bumped 28→33 (2026-07-17): createGroupedView — a new independent
  // data-view controller (group-by-key + expand/collapse + per-group
  // aggregate sum/avg/min/max/count), sunk to core so all 4 adapters share
  // one implementation. ~4KB of genuinely new engine, not drift.
  // Bumped tokens 2→3, icons 4→6 (2026-07-02): tokens gained new semantic
  // slots (danger/muted/surface/primary variants, font family/mono/size scale,
  // masonry/breadcrumb gap) and icons grew from a handful of seed glyphs to a
  // 24-icon Feather-style set (navigation/actions/status/files coverage) —
  // real surface growth the components now consume, not drift.
  core: 33,
  tokens: 3,
  theme: 3.5,
  skins: 5,
  icons: 6,
  react: 80,
  vue: 88,
  // Bumped 85→87 (v3 R10): the adapters re-export core's new createVirtualizer
  // through their barrel; react/vue had headroom, solid sat at the edge.
  // Bumped 87→90 (2026-07-17): IrisTree gained lazy-loaded children
  // (`loadChildren`, matching React/Vue's existing feature — closes a real
  // cross-framework parity gap) + the barrel now re-exports the new
  // useUndoStack/useGroupedView bridges. Genuine new surface, not drift.
  solid: 90,
  svelte: 6,
  manifest: 2,
}

/**
 * Per-NAMED-EXPORT tree-shake cost table — the gzip cost a consumer ACTUALLY
 * pays to import a SINGLE symbol from an adapter barrel, which the whole-package
 * budget above is blind to. For each export we bundle a tiny entry that
 * re-exports ONLY that symbol (`export { X } from '@iris-ui/react'`) with
 * esbuild's tree-shaking + minify, externalize the framework + sibling
 * `@iris-ui/*` packages (so we measure the adapter's own payload, not React/Vue),
 * then gzip the result. The delta between a single export and its whole package
 * is the tree-shake-effectiveness signal: a cheap export tree-shakes cleanly; an
 * expensive one drags in a fat shared chunk and is the marker to split.
 *
 * Entirely ADVISORY: if esbuild's binary is unavailable or a bundle fails, the
 * probe records null and prints a note — it never fails the gate (matches the
 * whole-package delta behavior). Run after `pnpm build` (reads dist/).
 */
const ESBUILD_BIN = join(repoRoot, 'node_modules', '.bin', 'esbuild')

/** Externals so the probe measures the ADAPTER's payload, not its peer deps. */
const EXTERNALS = {
  react: ['react', 'react-dom', 'react/jsx-runtime', '@iris-ui/*'],
  vue: ['vue', '@iris-ui/*'],
  icons: [],
}

/**
 * Bundle a single re-exported symbol and return its gzipped KB, or null if the
 * dist entry / esbuild binary is missing or the bundle errors (advisory).
 */
function bundleExportGzipKb(pkg, exportName) {
  const entry = join(repoRoot, 'packages', pkg, 'dist', 'index.js')
  if (!existsSync(entry) || !existsSync(ESBUILD_BIN)) return null
  const dir = mkdtempSync(join(tmpdir(), 'iris-size-'))
  try {
    const src = join(dir, 'entry.js')
    writeFileSync(src, `export { ${exportName} } from ${JSON.stringify(entry)}\n`)
    const args = [
      src,
      '--bundle',
      '--format=esm',
      '--minify',
      '--tree-shaking=true',
      '--platform=browser',
      ...(EXTERNALS[pkg] ?? []).map((e) => `--external:${e}`),
    ]
    const out = execFileSync(ESBUILD_BIN, args, {
      encoding: 'buffer',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return gzipSync(out).length / KB
  } catch {
    return null
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * The representative export set. Each entry measures one named export from an
 * adapter barrel. `budgetKb` is advisory headroom (never fails the gate); the
 * committed baseline + printed Δ is the real regression signal.
 */
const EXPORT_PROBES = [
  { pkg: 'react', export: 'IrisButton', budgetKb: 30 },
  { pkg: 'react', export: 'useForm', budgetKb: 30 },
  { pkg: 'vue', export: 'IrisButton', budgetKb: 80 },
  { pkg: 'vue', export: 'useForm', budgetKb: 80 },
]

const IMPORT_PROBES = [
  // The whole-set cost: importing `defaultIcons` (what the Icon components use)
  // pulls every glyph. Bundled with esbuild tree-shaking + minify (icons has no
  // peer deps → no externals) so it is directly comparable to the single-icon
  // probe below. Falls back to a JSON gzip of the in-memory map if esbuild/dist
  // is unavailable (advisory — never fails the gate).
  {
    name: 'icons: import { defaultIcons } → whole set',
    budgetKb: 6,
    async measure() {
      const bundled = bundleExportGzipKb('icons', 'defaultIcons')
      if (bundled !== null) return { gzipKb: bundled, note: '24 icons (whole set)' }
      const entry = join(repoRoot, 'packages/icons/dist/index.js')
      if (!existsSync(entry)) return null
      const mod = await import(pathToFileURL(entry).href)
      const map = mod.defaultIcons?.icons ?? {}
      const count = Object.keys(map).length
      const gzipKb = gzipSync(Buffer.from(JSON.stringify(map))).length / KB
      return { gzipKb, note: `${count} icons (whole set, JSON fallback)` }
    },
  },
  // The WIN: icons are now per-icon tree-shakeable named exports, so importing a
  // single glyph drops the `defaultIcons` aggregation + the default registry it
  // feeds. Bundle `import { chevronDown }` the SAME way (esbuild tree-shaking +
  // minify, no externals) and gzip it, then report its share of the whole-set
  // cost. (esbuild keeps the sibling icon-data literals because it won't prove
  // the readable node-constructor helper calls pure; bundlers that honor
  // `sideEffects:false` with deeper purity analysis shake those too — the data
  // is genuinely per-icon independent.) Advisory: skips if esbuild/dist missing.
  {
    name: 'icons: import { chevronDown } → tree-shaken',
    budgetKb: 1,
    async measure() {
      const gzipKb = bundleExportGzipKb('icons', 'chevronDown')
      if (gzipKb === null) return null
      const whole = current['probe:icons: import { defaultIcons } → whole set']
      const share = whole ? ` (${Math.round((gzipKb / whole) * 100)}% of the whole set)` : ''
      return { gzipKb, note: `single icon${share}` }
    },
  },
  // Per-named-export tree-shake probes, generated from EXPORT_PROBES. Each one
  // reports the single-export cost AND its share of the whole-package gzip.
  ...EXPORT_PROBES.map((p) => ({
    name: `${p.pkg}: import { ${p.export} } → tree-shaken`,
    budgetKb: p.budgetKb,
    async measure() {
      const gzipKb = bundleExportGzipKb(p.pkg, p.export)
      if (gzipKb === null) return null
      const whole = current[p.pkg]
      const share = whole ? ` (${Math.round((gzipKb / whole) * 100)}% of @iris-ui/${p.pkg})` : ''
      return { gzipKb, note: `single-export bundle${share}` }
    },
  })),
]
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

// Per-export probes are ENTIRELY ADVISORY — they record baselines, print a Δ,
// and surface OVER as a warning, but never set `failed` (so `pnpm size` exits 0
// on the probe table alone). A probe that can't run (no dist / no esbuild) is
// reported as a skip, not a build failure.
for (const probe of IMPORT_PROBES) {
  const result = await probe.measure()
  if (!result) {
    rows.push({
      pkg: probe.name,
      status: 'skip',
      detail: 'unmeasurable (build first, or esbuild unavailable)',
    })
    continue
  }
  const key = `probe:${probe.name}`
  current[key] = Number(result.gzipKb.toFixed(2))
  const over = result.gzipKb > probe.budgetKb
  rows.push({
    pkg: probe.name,
    status: over ? 'WARN' : 'ok',
    detail: `${result.gzipKb.toFixed(1)}KB / ${probe.budgetKb}KB gzip${deltaOf(key, result.gzipKb)} — ${result.note}`,
  })
}

if (UPDATE_BASELINE) {
  writeFileSync(baselinePath, JSON.stringify(current, null, 2) + '\n')
  // eslint-disable-next-line no-console
  console.log(
    `\nWrote size baseline → scripts/size-baseline.json (${Object.keys(current).length} entries)\n`,
  )
}

const pad = (s, n) => String(s).padEnd(n)
const MARK = { ok: '✓', OVER: '✗', MISSING: '✗', WARN: '!', skip: '·' }
const printRow = (r) => {
  const mark = MARK[r.status] ?? '?'
  // Package rows get the @iris-ui/ prefix + aligned columns; probe rows (whose
  // name carries spaces) print as a free-form line.
  const label = r.pkg.includes(' ') ? r.pkg : '@iris-ui/' + r.pkg
  // eslint-disable-next-line no-console
  console.log(`${mark} ${pad(label, 20)} ${pad(r.status, 8)} ${r.detail}`)
}
// Probe rows carry a space in their name; everything else is a whole-package row.
const pkgRows = rows.filter((r) => !r.pkg.includes(' '))
const probeRows = rows.filter((r) => r.pkg.includes(' '))
// eslint-disable-next-line no-console
console.log('\nBundle size budget — whole package (gzip)\n' + '─'.repeat(48))
pkgRows.forEach(printRow)
// eslint-disable-next-line no-console
console.log('─'.repeat(48))
// eslint-disable-next-line no-console
console.log('\nPer-export tree-shake cost (gzip, ADVISORY — never fails)\n' + '─'.repeat(48))
probeRows.forEach(printRow)
// eslint-disable-next-line no-console
console.log('─'.repeat(48))

if (failed) {
  // eslint-disable-next-line no-console
  console.error('\n✗ size budget exceeded — trim the change or raise the budget deliberately.\n')
  process.exit(1)
}
// eslint-disable-next-line no-console
console.log('\n✓ all packages within budget\n')
