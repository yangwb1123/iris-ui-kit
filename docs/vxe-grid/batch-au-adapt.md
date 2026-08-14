Both commits landed, working tree clean. All verification gates green.

## Report — batch AU (compare view) ✅

**Commits:** `db4afc33` (feat) · `7df7ea09` (chore: adapt 报告)

### Files changed (2 new source + 7 edits + 1 new test + docs + manifest)

| File                                                              | Change                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NEW** `packages/core/src/diff-rows.ts`                          | Pure framework-free `diffRows(before, after, rowKeyField)` — added/removed/changed keyed by rowKeyField; per-column `Object.is` (NaN≡NaN, +0≠−0 — deliberately ≠ batch-AT's `!==`); changed columns in after's key order; null-key rows skipped; O(1) `status` + nested `cellChanges` Maps + key arrays                                                                                                                       |
| **NEW** `packages/core/src/diff-rows.test.ts`                     | 19 tests (three-way classification, old→new values, keyed-not-positional, Object.is semantics, empty sides, key order, before-only key → undefined, distinct number/string keys, purity…)                                                                                                                                                                                                                                     |
| `core/src/index.ts` · `i18n.ts` · `plugin-locale-zh`              | barrel export · en `table.compare.tooltip` `Old: {old} → New: {new}` · zh `旧值: {old} → 新值: {new}`                                                                                                                                                                                                                                                                                                                         |
| `props.ts`                                                        | `compareWith?: Row[]` single-line prop (manifest-scanner hygiene) after `auditLog`                                                                                                                                                                                                                                                                                                                                            |
| `Table.tsx`                                                       | import + single memo `diffRows(liveData, compareWith, rowKey)` (null → fully inert; direction per baseline: before=liveData, after=compareWith) · row attrs `data-iris-row-added/-removed/-changed` · cell `data-iris-cell-changed` + title where compare tooltip (old→new) overrides tooltipConfig (documented) · helpers (`cellChangeOf`/`compareCellAttr`/`cellTitle`) keep the cell-render arrow at pre-change complexity |
| `styles.ts`                                                       | Token-only tints in `TABLE_ROW_CSS`: changed → `--iris-surface-selected`; added → `color-mix(success 12%, background)`; removed → `color-mix(danger 12%, background)` — `background` (full row) + `--iris-cell-bg` (gutter cells, same mechanism as hover/selected)                                                                                                                                                           |
| **NEW** `compare.test.tsx`                                        | 13 react tests (changed/removed attrs, changed-cell attr + tooltip, tooltipConfig override + unchanged-cell retention, no-prop inert, identical-snapshot inert, keyless rows inert, dataIndex resolution, multi-change row, null values, attr teardown)                                                                                                                                                                       |
| `docs/vxe-grid-comparison.md` + `docs/vxe-grid/batch-au-adapt.md` | iris 独有 section +1 row, build-status + 批 AU row, test counts; adapt report                                                                                                                                                                                                                                                                                                                                                 |
| `manifest/{manifest.json,llms.txt}`                               | regenerated — **propCount 138→139**, 155×4 stable, zero unavailable                                                                                                                                                                                                                                                                                                                                                           |

### Verification (all green)

- **core test: 1396 passed** (+19) · **react typecheck: clean** · **react test: 2027 passed** (+13, 0 regressions) · **react lint: 0 errors** (single pre-existing complexity warning, unchanged at 240) · **iris-ui-spec.py --mode all: 0 violations** · `check:manifest` up to date · zh locale parity 6 passed · prettier clean · core framework-free invariant holds · core dist rebuilt for typecheck

### Documented decisions

- **Direction per baseline**: `diffRows(liveData, compareWith, rowKey)` — live rows absent from the snapshot → `data-iris-row-removed`; in both with diffs → `changed` (+ cell attr + tooltip live→snapshot values). Snapshot-only rows (`added`) are in the core diff but have **no rendered slot** (compare renders the live dataset).
- **Compare tooltip wins** over tooltipConfig on changed cells; tooltipConfig still applies to unchanged cells.
- **Formula columns** are computed display values — own diffs not flagged (referenced field cells are); documented.
- **color-mix** degradation documented (engines without it fall back to inherited background).

### What is left

- vue/solid/svelte wiring for `compareWith` (core material ready; "react only" scope)
- Gate stage (turbo run, E2E/visual regression, size, RSC) per the workflow's review/gate stages
