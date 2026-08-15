All verification green. Final report:

## Batch BY complete

**`feat(table): grid 批 BY——展开状态持久化（iris 独有）`** — `persistState include` 新增 `'expandedKeys'`：展开行键纳入一键持久化，恢复经 `onExpandedRowsChange` 回调。

### Files changed (4 source + tests + docs, 9 files)

| File                                                       | Change                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/types.ts`             | `IrisTablePersistPiece` +`'expandedKeys'`（:49-57 区段尾）；`IrisTablePersistedState` +`expandedKeys?: Array<string                                                                                                                                                                                                                                                                                        | number>`（:61-75 区段尾，JSDoc：模型边界字符串化 / 恢复全量替换 / 陈旧键 fail-inert） |
| `packages/react/src/primitives/table/usePersistState.ts`   | `ALL_PIECES` 尾 +1：read/restore/save 三循环 + skip-first 挂载保护自动获得新块，零额外逻辑                                                                                                                                                                                                                                                                                                                 |
| `packages/react/src/primitives/table/Table.tsx`            | 4 触点：`expandableMode` 探针（`hasDetail \|\| getSubRows \|\| lazyLoad`，镜像后文 `treeMode` 使收集器免 TDZ）· 收集器门 `onExpandedRowsChange && expandableMode`（「可恢复的才保存」，pageSize 无代理跳过先例）· `restorePersistPiece` 新 case `expansion.set(value.map(String))` 全量替换（commit 路径触发 `onExpandedRowsChange(keys)`）· `applyViewSnapshot` 显式补块（views 共享收集器的存=恢复对称） |
| `packages/react/src/primitives/table/props.ts`             | 2 doc：`persistState` 片段清单 +`expandedKeys`（含门与恢复通道）；`onExpandedRowsChange` 标注为 batch BY 恢复通道                                                                                                                                                                                                                                                                                          |
| `test/persist-state-expanded.test.tsx` (new)               | **9 tests, 301 lines** (≤500；persist-state.test.tsx 已 413 行，追加超限 → 独立新文件)                                                                                                                                                                                                                                                                                                                     |
| `docs/vxe-grid-comparison.md`                              | 2 places: persistState 独有表行 +`expandedKeys`（批 BY 段）；构建状态尾 +批 BY（react 2364→2373）                                                                                                                                                                                                                                                                                                          |
| `docs/vxe-grid/batch-by-adapt.md` (new)                    | adapt report                                                                                                                                                                                                                                                                                                                                                                                               |
| `docs/vxe-grid/batch-by-baseline.md` (new)                 | baseline（先前 stage 产物）                                                                                                                                                                                                                                                                                                                                                                                |
| `packages/manifest/manifest.json` (+`llms.txt` 由脚本同写) | regenerated — 结构零 diff（IrisTable propCount **165** / eventCount **31** 不变）；仅 `persistState`/`onExpandedRowsChange` 提取描述行更新                                                                                                                                                                                                                                                                 |

### Implementation highlights

- **收集器门**：`if (onExpandedRowsChange && expandableMode) s.expandedKeys = expandedKeys`——「可恢复的才保存」；`expandableMode` 在 `hasDetail` 后定义（`hasDetail || getSubRows !== undefined || lazyLoad !== undefined`），与 flatten-tree 区的 `treeMode` 同义但前置，避免收集器对后声明 const 的 TDZ 引用（baseline 锚点 :2723 直接引 `treeMode` 有 TDZ 风险，实现改为前置探针，语义逐字等价）。
- **恢复 = 全量替换**：`expansion.set(value.map(String))`——快照是完整展开集，merge 只并集不适用（永不 collapse）；`set` 的 commit 路径经模型 `onChange` 触发 `onExpandedRowsChange(keys)` = 内部模型落地 + 父通知；展开无受控 prop，是 `pageSize` 之后第二个无 change 回调的特例（但比 pageSize 多一个真实提交——恢复即生效，不依赖代理 effect）。
- **扁平表 / 无回调双向惰性**：收集器不存、restore case 不播（`expandableMode` 门同时进 restore，种子里有展开键也不会在扁平表上回放）；无 `onExpandedRowsChange` 时内部展开照常工作但永不持久化。
- **skip-first 挂载保护自动获得**：restore 走既有逐通道 skip-first，挂载提交永不把恢复前（空集）写回存储；JSON 去重保证幂等。
- **陈旧键 fail-inert**：未知键进入模型但不匹配任何行（无崩溃、无 DOM 变化）；代理惰性语义——行到达即展开。
- **views 对称**：共享收集器（同门捕获）→ `applyViewSnapshot` 显式补块经同一 restore 门回放。
- core / 三框架 / styles.ts **零改动**；CSS 零新增（无样式触点）。

### Verification (all ✅)

- core test **1517/1517** · react typecheck **clean** · react test **2373/2373**（+9，前置工作树 2364 含 BX review 修复的 3 个测试）· react lint **0 errors**（1 既有 IrisTable complexity warning）
- `iris-ui-spec.py --mode all` → **0 violations**（1415 files）· `gen:manifest` regenerated + `check:manifest` up-to-date
- Constraints held: core framework-free、react-only、additive、≤4 source files、test file ≤500 lines（301）。

### What is left

- Runner's pending **review/gate** stage（DECISIONS.md 为 runner 管理，按既有模式）。
- vue/solid/svelte 对齐延后——react-only scope（纯 react 侧持久化扩展，core 零改动；三框架的 `persistState` 桥是各自薄实现，留待后续批）。
