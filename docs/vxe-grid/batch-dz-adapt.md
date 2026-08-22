# 批 DZ — 单元格拖拽复制（iris 独有） adapt

Done. Implementation ready for review/gate (not yet committed to `main`; source + test + manifest staged in the working tree).

## Report

### Files changed (4 source + 1 test + manifest regen)

| File                                                         | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props/query.ts`         | `cellDragCopy?: boolean` (+JSDoc) immediately after `cellDrag` → manifest **203→204 props / 33 events unchanged**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `packages/react/src/primitives/table/styles.ts`              | `RANGE_COPY_STYLE` (12×4 primary pill, `cursor: copy`, `bottom: 2` — the BOTTOM edge, RTL-neutral left/right 0 + auto margin, z 3) + `RANGE_COPY_TARGET_OUTLINE` (`2px solid var(--iris-primary, #6366f1)` — token + verified fallback, iris-ui-spec clean)                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `packages/react/src/primitives/table/cell-helpers.tsx`       | 7 module-scope helpers (`isRangeCopyGripCell` / `rangeCopyCellStyle` / `renderRangeCopyGrip` / `resolveCopyTarget` / `isCopyTargetCell` / `copyTargetAttr` / `copyTargetCellStyle`) + exported named interface `IrisRangeCopyTarget` — co-located with the presence outline precedent, keeping the row-render arrow's eslint complexity budget untouched                                                                                                                                                                                                                                                                                                                                                      |
| `packages/react/src/primitives/table/Table.tsx`              | +155/−6: import · destructure `cellDragCopy = false` · `cellDragCopyArmRef` + `cellDragCopyRect` state (stores the resolved target RECTANGLE directly, per baseline) · down/move/up handlers (CN's elementFromPoint → closest hit-test mold; keep-last outside body; pointerup re-arms dismissal; pointercancel zero-commit) · `copyRangeFromHandle` (CN commit minus phase 2 — source block NEVER touched; ONE `commitRowList(next, 'edit')`; selection stays on source) · `data-iris-copy-target` attr + token outline on the dest rect · 3 root-gate widen points (onPointerMove/onPointerUp/onPointerCancel) + suppress selector `[data-iris-range-fill], [data-iris-range-move], [data-iris-range-copy]` |
| `packages/react/src/primitives/table/test/batch-dz.test.tsx` | **NEW — 21 tests / 500 lines** (≤500 ✓, prettier clean)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `packages/manifest/{manifest.json,llms.txt}`                 | regenerated via `gen:manifest` — 204 props / 33 events / 155×4 / 86 tokens; `check:manifest` up to date ✓                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### Tests added (21)

- **fail-closed ×2** — no `cellDragCopy` → no grip; prop without a live range → no grip
- **grip 渲染 + press 存活** — top-left cell bottom edge (12×4 / copy cursor / bottom 2px / top unset, zero collision with the CN move pill) · grip press is not a click (range survives)
- **复制 ×3** — single cell (source untouched, selection stays) · 2×2 block whole in one commit · overlapping slide snapshots ORIGINAL values (Excel parity — never reads its own writes)
- **越界忽略 ×3** — beyond last row/col · before first row/col (no `data-iris-copy-target` mid-drag + zero-commit release) · 2×2 block just past the row boundary ignored + row-2 fit contrast
- **outline ×2** — dest rect cells get `data-iris-copy-target="true"` + inline `2px solid var(--iris-primary, #6366f1)`, source cells never marked, cleared on release · keep-last: a move outside the body keeps the last resolved rect
- **纪律 ×3** — formula columns never read/written · locked/readonly dest cells survive · keyless rows no-op
- **回归 ×5** — press+release without a move zero-commit · drop on the source block zero-commit · pointercancel drops + clears outline · move+copy grips coexist (copy commits a COPY, not a move) · fill handle + copy grip coexist · undoable (one commitRowList step)

### 显式 fiat（9，对齐 baseline）

1. **越界忽略**（与 CN 的 clamp 刻意分歧）: 整块放不下 → 无 outline、松手零提交
2. grip 在左上格 **bottom 边缘**（top 边缘属于 CN move pill，零碰撞）
3. state 直接存目标矩形 `cellDragCopyRect`（null = 未拖拽 OR 放不下）+ arm ref 区分"未拖拽"
4. drop 在源块自身 = 零提交（`resolveCopyTarget` 命中源矩形即 return）
5. 复制不改选区（留在源块）；源块永不写
6. formula 永不读写、locked/readonly 目的格存活、keyless 跳过（批 BE 沿用）
7. 单次 `commitRowList(next, 'edit')`（undo/audit/onDataChange 闭环）
8. 提交前重跑 `resolveCopyTarget` 防竞态（拖动中表格缩水 → 零提交）
9. outline 为 token `--iris-primary`（带校验过的 fallback，spec 0 违规）；填充走 background、presence 走数据色 inline outline 的双先例汇合

### Verification (all green)

- core: 106 files / **1641/1641** ✓（零 core 改动 —— framework-free invariant 保持）
- react typecheck ✓ · react test: 253 files / **2928/2928** ✓（252→253，+21）
- react lint: **0 errors**（2 条既有 complexity warning，未动）
- `iris-ui-spec.py --mode all --json`: **0 violations / 1546 files** ✓
- `gen:manifest` 再生成（203→204 props）· `check:manifest` up to date ✓ · manifest tests 69/69 ✓
- prettier clean（5 个改动文件）· `check:docs-reference` stale `apps/docs/components.md` 为既有问题（gitignored/untracked，HEAD-clean stash 上同样失败，与本批无关）

### What is left

- review/gate 阶段（harness）
- 批量对比文档行/DECISIONS 记录（gate 阶段惯例）
- 工作树既有 dirt（grid-refactor、docs、core/plugin exports、aero console）未动
