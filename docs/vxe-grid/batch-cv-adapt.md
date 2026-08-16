All done and verified. Final report:

## 批 CV：冻结边界拖拽（iris 独有）— Complete

**Commit**: `77e53bab` `feat(table): grid 批 CV——冻结边界拖拽（iris 独有）` (9 files, +833/−7)

### Files changed

| File                                                                                          | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/react/src/primitives/table/props.ts`                                                | +2 props: `pinnedDrag?: boolean` + `onPinnedCountChange?: (count: number) => void` (single-line function prop, named JSDoc — scanner hygiene clean)                                                                                                                                                                                                                                                                                                                                              |
| `packages/react/src/primitives/table/Table.tsx`                                               | destructure · `PinnedDragHandle` (useDrag + translateX ghost + Arrow ±1 + `stopPropagation` anti-arm-race) · 2 pure module helpers `leftPinnedCount`/`pinnedCountFromBudget` + `resolvedColumnWidth` · `firstRightPinnedIndex`/`pinnedBoundaryCol` memos · `resolvePinnedCount`/`commitPinnedCount` (rides the existing `setColumnPinned` throat, no-op → zero callbacks, controlled no-optimistic-flip) · flat + grouped header branches · boundary column's `resizableColumns` grip suppressed |
| `packages/react/src/primitives/table/test/pinned-drag.test.tsx`                               | **NEW, 17 tests, 493 lines** (≤500)                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `packages/manifest/{manifest.json,llms.txt}`                                                  | regenerated — `propCount 180→182` / `eventCount 31→32` (exact baseline prediction)                                                                                                                                                                                                                                                                                                                                                                                                               |
| `docs/vxe-grid-comparison.md` · `DECISIONS.md` · `batch-cv-adapt.md` · `batch-cv-baseline.md` | 构建状态 tail + test-count line + stage bookkeeping                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### Tests added (17)

① handle at boundary (role/line/fail-closed×2) ② drag right adjusts count (attrs + `onPinnedCountChange` once + per-column change) ③ drag left ④ all-pinned clamp ⑤ zero clamp (handle unmounts) ⑥ no-op fires nothing ⑦ ghost transform (active + translateX, reset on release) ⑧ right-block clamp ⑨ controlled no-optimistic-flip ⑩ static-declaration seed + explicit-null override ⑪ keyboard ±1 + clamps ⑫ grouped header ⑬ resizableColumns coexistence + boundary suppression ⑭ columnDrag arm-race ⑮ columnVirtualization ⑯ width-aware resolution (100/200 vs 140 discriminator) ⑰ lead-column exclusion (seq)；门禁 T18 gapped 回归独立文件 `pinned-drag-gapped.test.tsx`（filesize 门：pinned-drag.test.tsx 回 493 行 ≤500）

### Verification (all green)

- **core: 1559/1559** — framework-free invariant intact (zero core changes)
- **react typecheck** clean · **react test: 2636/2636** (2618 + 18)
- **lint: 0 errors** (1 pre-existing `IrisTable` complexity warning)
- **spec: 0 violations** (1416 files)
- **check:manifest** up to date · **check:docs-reference** up to date · prettier clean

### Gate-stage review fix（batch-cv-review.md Finding 1，MEDIUM）

`resolvePinnedCount` 原版求和**全部**左固定宽（含首个 gap 之后的列），而 `commitPinnedCount` 的 `current` = 前导**前缀**计数 —— gapped 态 `[A(left), B(null), C(left)]`（pin 菜单可达）下句柄在 C、零 dx 解析 2 ≠ 当前 1 → 误 pin B/unpin C + 触发 `onColumnPinnedChange` ×2 + `onPinnedCountChange(2)`，违反 spec 的 no-op 零回调。修复：预算改从**前导前缀**宽起算（`i < leftPinnedCount(...)`），`resolve(0) ≡ leftPinnedCount` 恒成立（非 gapped 态行为逐字节不变）；+ T18 回归测试（独立 `pinned-drag-gapped.test.tsx`，先验失败：还原旧实现 1 failed / 17 passed）。

### What's left

- The boundary width uses the `pinnedOffsets` approximation chain (non-numeric widths → 140px) — documented fiat; a precise DOM-measured boundary would need layout measurement.
- Left-only count per spec; no right-pinned boundary handle (spec doesn't ask).
- Prior-stage dirt remains untracked: `docs/vxe-grid/batch-cu-gate.md` (belongs to the CU gate stage, not this batch).
