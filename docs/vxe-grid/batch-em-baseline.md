Baseline complete — 只读核查零源码改动，唯一新增交付品：

## 交付：`/home/u1/iris-ui/docs/vxe-grid/batch-em-baseline.md`（101 行）

**核查结论**（HEAD `1a56c3f1`，批 EL solid 已合入）：公式列目前 **react + vue + solid**，svelte 零命中——仅 `IrisTable.svelte:375-376` 有 `& { formula?: unknown }` cast 跳过公式列。vue 批 EK / solid 批 EL 是四框架对齐的直接先例。core `evaluateFormula`/`memoizedFormulaValue` 框架无关、24 核心测试已存，**零改动复用**。

**关键架构发现**：svelte 数据管道全部经 `tableUtils.ts getCellValue` 单一咽喉（排序两态 :262/:389、筛选两通道 :158/:167、汇总注入、col.render、编辑草稿、patternHint、对齐、row-edit 控制器）。与 solid 不同，svelte **无局部 getCellValue 副本**，零去重动作。唯二绕过咽喉的路径：纯文本格 `tableDisplayText(row, col)`（core 已带可选第 3 参 resolver，传咽喉即得计算值显示）和 core `toCsv`/`serializeTableRange` 直读 dataIndex（需影子行物化）。

**设计**（镜像 react AO / vue EK / solid EL 薄桥）：

- `getCellValue` 公式分支（2 参 `memoizedFormulaValue`，BC 前字节语义）→ 渲染/排序/筛选/汇总免费继承
- 纯文本格 3 参 resolver + 编辑纪律 `isEditableColumn` 守卫 **8 触点**（inline 5 + 行模式 3）→ display-only
- `withComputedFormulaCells` 影子行物化 → handle 导出 ×2 + 范围剪贴板（vue :107 逐字先例）
- autoDetectTypes cast 清理

**文件地图**：svelte 包 5 改（types/tableUtils/IrisTable/table-row-edit/table-keyboard）+ 1 新测试 `formula.test.ts` + comparison 行；零 core/prop/i18n/样式/manifest 改动。

**测试计划**：15 例镜像 vue EK/solid EL（渲染×4、排序×2、筛选×2、汇总、导出×2、编辑纪律×3、剪贴板 TSV），svelte 惯例（@testing-library/svelte）。

**7 条 fiat** 留 gate 仲裁，含 svelte 专属两条：行模式守卫注入方式（options 注入 vs 模块内 import，无循环依赖）与 arch ratchet 已 stale（IrisTable.svelte 1606 行 vs baseline 1493，批 EJ 已超——本批净 +3 行不改变 pre-existing 状态，按 EK F1 先例接受）。
