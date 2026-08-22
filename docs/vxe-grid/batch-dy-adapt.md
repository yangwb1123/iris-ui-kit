Done. Batch DY committed as `01f9ab26` (`feat(table): grid 批 DY——列显隐动画（iris 独有）`, 8 files +692/−5).

## Report

**Files changed (4 source + 1 test + manifest + adapt doc):**

- `props/layout.ts` — `columnFade?: boolean` (+JSDoc) after `onColumnVisibilityChange` → manifest **202→203 props / 33 events unchanged**
- `table-css.ts` — 3 new `TABLE_ROW_CSS` rules: per-cell opacity transition + per-row `grid-template-columns` transition (both `var(--iris-duration-md, 200ms)`), both scoped by `[data-iris-column-fade-active]` so later resizes never lag; reduced-motion freeze gate
- `Table.tsx` — two-phase per-column fade machine (layout-effect diff on `columnVisibility`, mount-hidden never animates, `effectiveColumnVisibility` overlay passed to `useTableColumns` — no signature change, double-rAF pending→run flip, ONE 200ms commit timer, SSR/reduced-motion fail-closed) · `fadeByLeaf` grouped-parent expansion · track `Wpx↔0px` in `gridTemplateColumns` · `data-iris-column-fade="in|out"` + inline `opacity: 0` on body/grouped+flat header/totals cells · root `data-iris-column-fade-active`
- `summary-row.tsx` — `columnFadeAttr`/`columnFadeStyle` props (single-line fn props, named exported interface) on summary cells
- `test/batch-dy.test.tsx` (NEW) — **17 tests / 402 lines** (≤500 ✓)
- `manifest.json`/`llms.txt` — regenerated via `gen:manifest` (committed)

**Tests added (17):** fail-closed x2 · hide/show full phase walks (pending→run→commit incl. track/opacity/attr) · multi-column single commit window · 2 mid-fade reversals · opacity-key absence · template string-identity restore · non-numeric `1fr` degrade · header/summary/totals surfaces · grouped-parent leaf expansion · stylesheet token rules + no hardcoded duration · reduced-motion JS skip (matchMedia stub) · settle invariants (1 pending timer → 0, re-toggle re-bases).

**Verification (all green):**

- core: 106 files / **1641/1641** ✓
- react typecheck ✓ · react test: 252 files / **2907/2907** ✓
- react lint: **0 errors** (2 pre-existing complexity warnings, untouched)
- `iris-ui-spec.py --mode all --json`: **0 violations / 1546 files** ✓
- `gen:manifest` regenerated (202→203) · `check:manifest` up to date ✓ · manifest tests 69 ✓ · prettier clean ✓ · commit hooks: filesize PASS, change-budget core 240≤300 (6-files warning, non-blocking precedent)

**What is left:** nothing in scope. Documented fiats in `batch-dy-adapt.md`: footerMethod/footerData rows (footer-stack.tsx) not per-cell faded (row grid-template still animates; kept out of the 4-file budget) · spanMethod-covered cells collapse with origin · non-numeric track interpolation is CSS-level · skin `--iris-duration-md` overrides stretch past the JS commit window. `check:docs-reference` stale `apps/docs/components.md` is pre-existing (file is gitignored/untracked; verified failing on HEAD-clean stash too — unrelated). Pre-existing working-tree dirt (grid-refactor, docs, core/plugin exports, aero console) left untouched.
