Baseline written — the only new file; zero source files touched (the two pre-existing modifications to `DECISIONS.md`/`batch-by-gate.md` are from the BY gate stage, not this task).

## 核验摘要 (batch BZ：表格状态导出导入，iris 独有)

**Output**: `/home/u1/iris-ui/docs/vxe-grid/batch-bz-baseline.md`

**设计** — `IrisTableHandle` +2 方法（handle-only，BF/BV 先例，manifest 165/31 不变）：

- **`exportStateJson(): string`** — 序列化批 AG 同一收集器（`persistSnapshot` memo `Table.tsx:2728`）的全部状态 JSON，spec 9 块：sort / filters / filterValues / columnVisibility / columnOrder / columnWidths / pageSize / expandedKeys / query
- **`importStateJson(json): boolean`** — 解析 + 复用 `applyViewSnapshot`（`:2853`）逐项经回调应用（资格门 + 类型守卫 + query 先行 + pageSize `onPageChange(1,size)`+恰一次 request 复现 + expandedKeys 全量替换）；非法 JSON / 非纯对象 → `false`，有效 JSON 逐块惰性仍 `true`

**三个收集器放宽**（本批唯一行为面，均已核验消费者安全）：① memo 的 `persistState || views` 门移除（裸表可导出；usePersistState `hasConfig` / useTableViews config 门双兜底）② query 收集改无条件（persist 保存循环无 `query` 键，字节不变）③ multiSortState 刻意不导出（spec 无此项；导入超集接受）——开放问题 ① 交 gate 仲裁。

**文件地图** — `types.ts` handle +2 方法（:626 后）· `Table.tsx` 4 触点 + 2 个 ref 镜像（挂载闭包读最新快照）· `props.ts` tableRef JSDoc · `usePersistState.ts` 注释勘误 · NEW `test/state-export-import.test.tsx`（persist-state.test.tsx 413 行超 500 上限 → 独立新文件）· comparison doc 新行+构建状态追加。core / 三框架 / styles.ts 零改动。

**测试计划** — 12 用例（react 2373 → 2385），spec 三块全覆盖：导出结构（全通道 9 键 / 门控惰性 / 裸表 / 空态 `'{}'`）、导入应用（逐回调原值 / query 先行 / pageSize 单请求 / 展开 DOM / 往返字节相等）、非法（5 种坏输入 → false 零回调 / 损坏块惰性）。

**8 fiats + 2 开放问题**（multiSortState 取舍、收集器门放宽 vs 独立收集器），全部锚点已逐行核验。
