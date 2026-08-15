Baseline written: **`/home/u1/iris-ui/docs/vxe-grid/batch-by-baseline.md`** (11 lines, the only new file — no source files touched).

## 核验摘要 (batch BY：展开状态持久化)

**设计** — `persistState include` 新增 `'expandedKeys'`，4 个源触点，镜像 pageSize 特例先例：

1. **types.ts** — `IrisTablePersistPiece` +`'expandedKeys'`（:49-57）；`IrisTablePersistedState` +`expandedKeys?: Array<string | number>`（:61-75）
2. **usePersistState.ts** — `ALL_PIECES` 尾 +1（:28-36）：三循环（read/restore/save）+ skip-first 挂载保护自动获得新块，零额外逻辑
3. **Table.tsx 收集器**（:2723）— `if (onExpandedRowsChange && (hasDetail || treeMode)) s.expandedKeys = expandedKeys`（「可恢复的才保存」，pageSize 无 proxy 跳过先例）
4. **Table.tsx restorePersistPiece**（:2764）— 新 case：`expansion.set(value.map(String))` 全量替换（快照是完整展开集；merge 只并集不适用），commit 路径经 :2649 `onChange` 触发 `onExpandedRowsChange(keys)` ——「恢复经 onExpandedRowsChange 回调」= 内部模型落地 + 父通知；展开无受控 prop，是 pageSize 之后第二个无 change 回调的特例
5. **applyViewSnapshot**（:2823）— 显式补块，保持 views 共享收集器的「存=恢复」对称

**文件地图** — types.ts×2 · usePersistState.ts×1 · Table.tsx×4 · props.ts doc×2 · NEW `test/persist-state-expanded.test.tsx`（persist-state.test.tsx 已 413 行，追加超 500 上限 → 独立新文件）· comparison doc×2 · manifest **165/31 不变**；core / 三框架 / styles.ts 零改动。

**测试计划** — 9 用例（react 2361 → ~2370）：保存（caret 展开落盘）→ 恢复（种子 → 回调 + DOM 实际展开）→ skip-first 不粘滞 → 挂载提交保护 → include 双向限制 → 无回调惰性 → 扁平表惰性 → 详情模式 parity → 陈旧键/损坏 JSON fail-inert。

**9 条 fiats** + 2 个开放问题（恢复=set 全量替换的解读；views 是否携带 expandedKeys）供 gate/review 仲裁，全部锚点已对当前代码逐行核验。
