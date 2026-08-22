Baseline 已写入 `/home/u1/iris-ui/docs/vxe-grid/batch-dt-baseline.md`（仅此文件改动；DECISIONS.md / batch-ds-gate.md 为工作区既有改动未触碰；**零源码修改**）。

## 结论：批 DT（表格导出选择，iris 独有）已在 HEAD 完整提交

Spec（`exportSelectionCsv` 增强：`exportRowsCsv?(keys: Array<string | number>)`——按指定 keys 导出；测试（指定行导出））于 DL–DT 批次 `61ec5418` 落地，`batch-dt-gate.md` PASS 在案。基线逐行锚定：

**实现锚点**

- Handle 契约：`types/handle.ts:38` — `exportRowsCsv: (keys: Array<string | number>) => string`，纯 handle 可选方法（非 prop，props.ts 零改动，渲染无需 `selectable`）
- 实现：`Table.tsx:3464-3472` — `new Set(keys)` → `bodyDataRef.current.filter((row, i) => wanted.has(rowKeyOf(row, i)))` → 空结果 `''` → 与 `exportSelectionCsv`（Table.tsx:3453-3461，批 AP）字节同形的 `exportCsv(withComputedFormulaCells(...), viewColumnsRef.current)`（公式物化 + mask + 隐藏列剔除）
- 行序 = bodyData 顺序（keys 顺序无关）；key 解析 `rowKeyOf`（:3177-3183：rowKey → rowId → index 兜底）；未知 key silently skipped

**File map**：handle 1 处 + Table.tsx 1 处 + 测试 1（`test/batch-dl-dt.test.tsx:485-489`）+ 相邻回归（AP 5 用例 / mask / 跨表公式）；core、其他框架、`exportCsv.ts` 零改动

**Test plan**：DT 定向 1/1、batch-dl-dt 全套 21/21、React 全量 2826/2826（246 files）· core 1597 · turbo 180/180（均引自最近 gate 记录）

**4 条 non-blocking 观察**：无负向用例（空数组/未知 key）；隐藏列/公式/mask 走 AP 同管线代理未逐线锁定；string keys 与 rowId 兜底无断言；跨页 proxy keys 行为无显式文档。
