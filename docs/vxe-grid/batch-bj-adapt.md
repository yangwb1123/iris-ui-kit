All gates green on the committed state. Done.

## Report — grid 批 BJ: 单元格权限 `cellPermission`（iris 独有）

### Files changed (4, committed `a60ad3b6`)

| File                                                                 | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/types.ts`                       | `cellPermission?: (row: Row, column: IrisTableColumn<Row>) => 'readonly' \| 'editable'` — single-line function prop after `locked`, before `preset` (manifest-scanner hygiene)                                                                                                                                                                                                                                                                                                                    |
| `packages/react/src/primitives/table/Table.tsx`                      | `READONLY_CELL_DOTS` const · `[data-iris-cell-readonly]` CSS rule in `TABLE_ROW_CSS` · `isCellReadonly` helper · `lockedCellRender` → `cellPermissionRender(locked, readonly, editable, hasRange)` → `{lockedAttr, readonlyAttr, cursor, style}` · render site (attr + cursor + inline background-image re-assertion spread last, BE review-fix pattern) · **15 mechanical `\|\| isCellReadonly` guard sites** (beginRowEdit/Tab×2/beginEdit/F2/Delete/paste×2/fill/range clear/FNR×2/batch edit) |
| `packages/react/src/primitives/table/cell-permission.test.tsx` (NEW) | 485 lines ≤ 500 · **17 tests**                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `docs/vxe-grid-comparison.md`                                        | iris-only row + 构建状态 批 BJ + test count 2194                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### Design (per baseline fiats)

- **Dynamic** — predicate re-evaluates per render (unlike static `locked`); test proves a row-data change flips the same cell readonly↔editable without remount
- **Visual distinct from locked** — dotted 8pt radial-gradient texture + `data-iris-cell-readonly="true"` vs locked's 45° stripes; **locked wins when both**
- **Reads fail-inert** — selection/copy/export/FNR-find/`data-editable` untouched; zero-commit guards reused (all-readonly batch/range/paste/fill commit nothing)
- **Core/i18n/vue/solid/svelte: zero changes** — propCount stays 152 (column field, `locked` precedent)

### Tests added (17)

默认可编辑 dblclick · 只读不可编辑 no-op（无 editor/onEditStart）· 视觉区分（dots vs stripes + 注入样式表 + data-editable 保留）· locked 双设赢 · 行级 predicate · 列感知 · 动态重求值（双向翻转）· click 触发 · F2 · Delete/Backspace · 行模式 + Tab 跳过 · 批编辑跳过 + 全只读零提交 · 范围清除 · 粘贴 · 拖拽填充 · FNR 替换/替换全部跳过 + 查找仍命中

### Verification (all green)

- `core test`: **1475/1475** ✓ · `react test`: **2194/2194** (194 files, pre-BJ 2177 + 17) ✓
- `react typecheck` ✓ · `react lint`: **0 errors** (1 pre-existing `IrisTable` complexity warning, confirmed pre-existing via stash) ✓
- `iris-ui-spec.py --mode all --json`: **0 violations** ✓
- `gen:manifest`: regenerated, **zero diff** (155×4, manifest clean) ✓
- Prettier clean, file size 485/500, change budget 4 files/125 lines ✓

### What's left

- **BI-stage worktree leftovers untouched** (per baseline mandate): `chart-data.ts/.test.ts`, `sparkline.test.tsx`, `DECISIONS.md`, `batch-bi-adapt.md` — the BI gate's pending LOW fixes from its PASS review (its gate agent exited before committing); the BI gate re-run owns them. `Table.tsx` unavoidably carries one BI review-requested sparkline hunk (needed by the uncommitted BI tests to stay green)
- `batch-bj-baseline.md` stays untracked (baseline writer's record, BI precedent); the adapt/gate stage docs are written by the harness
