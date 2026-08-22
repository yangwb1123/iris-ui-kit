Baseline complete — the only change is the new deliverable.

## 交付：`/home/u1/iris-ui/docs/vxe-grid/batch-el-baseline.md`（109 行，只读核查零源码改动）

**核查结论**（HEAD `fcb7d3c1`，批 EK 已合入）：公式列目前 **react + vue**，solid 零命中——仅 `IrisTable.tsx:258` 有 `& { formula?: unknown }` cast 跳过公式列；vue 批 EK（`949ddecd`）是四框架对齐的直接先例。core `evaluateFormula`/`memoizedFormulaValue` 框架无关、24 核心测试已存，**零改动复用**。

**关键架构发现**：solid 数据管道全部经 `utils.ts getCellValue` 单一咽喉（多列排序/筛选两通道/汇总/对齐/patternHint），唯 `useTableSort.ts:90` 有一个逐字相同的局部副本喂单列排序。core `tableDisplayText(row, col, resolveValue?)` 已带可选第 3 参 resolver——3 参传咽喉即得计算值显示，零 core 改动。

**设计**（镜像 react AO / vue EK，薄桥）：`utils.getCellValue` 公式分支（2 参 `memoizedFormulaValue`，AO 字节语义）→ 渲染/排序/筛选/汇总全免费继承；`isEditableColumn` 守卫 8 编辑触点；`withComputedFormulaCells` 影子行物化（导出 ×2 + 范围剪贴板）；useTableSort 局部副本去重归并咽喉。

**文件地图**：solid 包 5 改（types/utils/useTableSort/table-helpers/IrisTable）+ 1 新测试 + comparison 行；零 core/prop/i18n/样式改动，manifest 零 diff。

**测试计划**：14 例镜像 vue EK（渲染×3、排序×2、筛选×2、汇总、导出×2、编辑纪律×3、剪贴板 TSV）。

**8 条 fiat** 留 gate 仲裁，含 solid 专属两条：useTableSort 去重归并（react 显式接线 vs solid 咽喉继承的架构差异）、IrisTable.tsx 净行数 ≤ +2 以守住 ratchet baseline 2340（超限按 EK F1 先例接受 LOW 或刷新 baseline）。
