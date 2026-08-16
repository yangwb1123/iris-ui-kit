All verification green. Final report:

## Batch BY — 展开状态持久化（`expandedKeys`）complete

**Commit `131ee713`** — `feat(table): grid 批 BY——展开状态持久化（iris 独有）`

### Files changed (committed)

| File                                                     | Change                                                                                                                                                                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/types.ts`           | `IrisTablePersistPiece` +`'expandedKeys'`（:55 区段）；`IrisTablePersistedState` +`expandedKeys?: Array<string \| number>`（:71 区段，JSDoc：字符串化/全量替换/陈旧键 fail-inert）                                        |
| `packages/react/src/primitives/table/usePersistState.ts` | `ALL_PIECES` 尾 +1 — read/restore/save 三循环 + skip-first 挂载保护自动获得新块，零额外逻辑                                                                                                                               |
| `packages/react/src/primitives/table/Table.tsx`          | 4 触点：`expandableMode` 前置探针 · 收集器门 `onExpandedRowsChange && expandableMode` · `restorePersistPiece` 新 case `expansion.set(value.map(String))`（commit → `onExpandedRowsChange`）· `applyViewSnapshot` 对称补块 |
| `packages/react/src/primitives/table/props.ts`           | 2 doc：`persistState` 片段清单 +`expandedKeys`；`onExpandedRowsChange` 标注恢复通道                                                                                                                                       |
| `test/persist-state-expanded.test.tsx` (NEW)             | **9 tests, 301 lines** (≤500)                                                                                                                                                                                             |
| `packages/manifest/manifest.json`                        | regenerated — 结构零 diff（IrisTable 165 props / 31 events 不变）                                                                                                                                                         |
| `docs/vxe-grid-comparison.md`                            | 2 places（persistState 行 + 构建状态）                                                                                                                                                                                    |
| `docs/vxe-grid/batch-by-adapt.md` (NEW)                  | adapt report                                                                                                                                                                                                              |
| + BX review-fix leftovers folded in                      | DECISIONS.md · batch-bx-adapt.md · batch-bx-review.md · pin-column-menu.test.tsx（同文件同 manifest，单提交）                                                                                                             |

### Tests added (9)

保存（caret 落盘）→ 恢复（种子 → `onExpandedRowsChange(['2'])` + DOM 实际展开 + 全量替换）→ skip-first 不粘滞 → 挂载提交保护（存储保持恢复值非空集）→ include 双向限制 → 无回调惰性（内部展开照常、永不持久化）→ 扁平表惰性（不存不播）→ 树模式 parity（save + remount restore → 子行渲染）→ 陈旧键/损坏 JSON fail-inert。

### Verification (all ✅)

- core test **1517/1517** · react typecheck **clean** · react test **2373/2373**（BY +9，前置工作树 2364 含 BX 修复 3 例）· react lint **0 errors**（1 既有 complexity warning）
- `iris-ui-spec.py --mode all` → **0 violations**（1415 files）· `gen:manifest` 重生成 + `check:manifest` up-to-date · prettier clean
- Constraints held：core 零改动（framework-free 验证隐式满足）· react-only · additive · ≤4 source files · test ≤500 lines

### Deviations from baseline (documented)

- Baseline 锚点 `:2723` 收集器直接引 `treeMode` —— `treeMode` 在组件体 ~4646 才声明，useMemo 回调同步执行会 TDZ ReferenceError；实现改为在 `hasDetail` 后前置 `expandableMode = hasDetail || getSubRows !== undefined || lazyLoad !== undefined`（与 `treeMode` 逐字同义），收集器与 restore case 共用。
- 2 个开放问题按实现仲裁：恢复 = `set` 全量替换（merge 永不 collapse）；views 携带 `expandedKeys`（共享收集器 + `applyViewSnapshot` 对称补块，测试覆盖树/详情两模式）。

### What is left

- Runner 的 **review/gate** 阶段（DECISIONS.md 为 runner 管理）。
- vue/solid/svelte 对齐延后 — react-only scope（persistState 桥为各框架薄实现，core 零改动，留待后续批）。
