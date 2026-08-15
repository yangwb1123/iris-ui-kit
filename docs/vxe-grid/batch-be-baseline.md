Baseline complete. Deliverable: **`/home/u1/iris-ui/docs/vxe-grid/batch-be-baseline.md`** (161 lines) — the only file created; zero source files modified (the `M` entries in git status are pre-existing BC/BD-stage files, untouched).

## What's in the baseline

**Exact design** (every anchor verified against current code):

- **Type**: `IrisTableColumn.locked?: boolean | ((row, column) => boolean)` in types.ts (edit cluster, after `editor`) — `true` = 整列锁, predicate 忽略 column 即行级锁, 列/行两级同一字段. Column-level → manifest propCount stays 148 (batch-AY precedent), no docs/manifest regen, no i18n, no core.
- **Single chokepoint**: module-level `isCellLocked(row, col)` (next to `isEditableColumn` :832) + `beginEdit` guard at :3101 (`|| isCellLocked(row, col)`) — covers dblclick/click-trigger/F2/Tab-nav/pendingNav in one edit, early-returns before `onEditStart` (zero event pollution).
- **Row mode (batch K)**: `beginRowEdit` filter (:2490), row re-open branch (:3256), `moveRowEditOnTab` (:2553) — locked cells open no editor.
- **Bulk funnels**: `applyBatchEdit` (:5903) skips locked rows (all-locked → `next === rows` → no commit, panel still closes — covers 全选+批量应用 via the shared selection); paste/fill/range-clear/FNR-replace/Delete-shortcut get the same write guard (flagged fiat 4).
- **Visual**: `data-iris-cell-locked="true"` attr + cursor drop in renderRow (:5374/:5469); 45° stripes in `TABLE_ROW_CSS` via `--iris-muted-subtle` (both themes define it; skeleton-gradient + dirty-dot precedent) — no inline style, RTL-symmetric.
- **Fail-inert**: selection, cellRange, copy/export, FNR find all still work — locking guards writes only (fiat 1).

**File map**: 3 files (types.ts, Table.tsx ~16 small edits, styles.ts) + 1 new test file (`locked-cells.test.tsx`); props.ts/index.ts/core untouched.

**Test plan**: 10 cases — 整列/行级/组合锁 attr, dblclick/click/F2 no-op, Delete skip, 批量编辑跳过 (含全选路径 + 全锁零提交), row-mode skip, paste consistency, visual attrs — directly covering spec's 锁定不可编辑/批量跳过/视觉属性.

**10 numbered fiats** for gate arbitration (write-only guard scope, dual-guard split, row-mode inclusion, full-funnel write protection, FNR-find keeps locked matches, `data-editable` unchanged, panel keeps locked columns, stylesheet stripes, predicate contract, react-only scope).
