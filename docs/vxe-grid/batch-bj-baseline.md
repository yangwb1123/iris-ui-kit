Baseline written: **`/home/u1/iris-ui/docs/vxe-grid/batch-bj-baseline.md`** (17 lines) — the only file created (`git status` confirms the pre-existing BI-stage `M`/`??` entries untouched; zero source files modified).

## What's in the baseline

**Exact design** (every anchor verified against current code):

- **Prop** — `cellPermission?: (row, column) => 'readonly' | 'editable'` on `IrisTableColumn`, types.ts **after `locked` (:241), before `preset` (:248)**. Absent → editable (default); `'readonly'` → read-only through every editing entry point.
- **Core (DRY)** — module-level `isCellReadonly(row, col)` beside `isCellLocked` (:995): `col.cellPermission?.(row, col) === 'readonly'`; `lockedCellRender` (:1005) extended → `cellPermissionRender(locked, readonly, editable, hasRange)` returning `{ lockedAttr, readonlyAttr, cursor, style }`.
- **15 guard sites** (mechanical `|| isCellReadonly` next to each `isCellLocked`): beginRowEdit :2689, row-mode Tab :2754, pendingNav :2796, beginEdit :3302, cell-mode Tab :3374, row-mode reopen :3460, F2 :4466, Delete/Backspace :4473, paste rect :4548 / single :4568, fill :4840, range clear :4911, FNR replace :5060 / replace-all :5082, batch edit :6284.
- **Visual (与 locked 区分)** — `data-iris-cell-readonly="true"` + **dotted** texture (`radial-gradient(var(--iris-muted-subtle) 1px, …)` on the 8pt grid) vs locked's 45° stripes — dynamic vs permanent; background-**image** + inline re-assertion spread last (BE review-fix pattern verbatim); TABLE_ROW_CSS rule after :261-267.
- **8 fiats** for gate arbitration: OR-guard, locked wins visual when both, reads fail-inert (selection/copy/export/FNR-find/`data-editable` untouched), zero-commit guards reused, dynamic re-eval per render, absent = editable, no core/i18n/manifest change (propCount stays 152), attr renders regardless of `editable`.

**File map**: types.ts +1 field · Table.tsx (const :194 + CSS :267 + helper :1000 + render :5662/:5706/:5797/:5805 + 15 edits) · **NEW** `cell-permission.test.tsx` · `docs/vxe-grid-comparison.md` (iris-only row :63 + 构建状态 :278 + test count :336) · zero: props.ts/index.ts/styles.ts/core/vue/solid/svelte/i18n.

**Test plan**: 15 cases — the two spec-mandatory (默认可编辑 / 只读不可编辑 via dblclick no-op), visual distinctness, dynamic per-row/column-aware predicates, click-trigger/F2/Delete, row mode + Tab, batch edit, range clear, paste, fill, FNR replace, locked-vs-cellPermission precedence.
