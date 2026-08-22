Baseline 完成。只读核查零源码改动——本次会话唯一新增是 `/home/u1/iris-ui/docs/vxe-grid/batch-ek-baseline.md`（93 行）；git status 中其余 dirty（aero-platform-console/*、DECISIONS.md、batch-ej-gate.md、pnpm-lock.yaml）均为会话前已存在。

**核查结论**（HEAD `e7cd8ad6`，批 EJ 已合入）：

- **公式列目前 react-only**（批 AO `formula?: string` + 批 BC `formulaTables`），vue/solid/svelte 零命中——vue 仅有 `Table.ts:246-248` autoDetectTypes 的 `& { formula?: unknown }` cast 跳过公式列（反应了 react 语义但类型未入）。AO adapt 文档明确预留「vue/solid/svelte wiring… one thin bridge per adapter」。
- **core `evaluateFormula`/`memoizedFormulaValue` 框架无关、零改动复用**（24 核心测试已存在）。
- **vue 数据管道全部经 `getCellValue` 单一咽喉**（`table-helpers.ts:17-24`）：排序（`useTableSort.buildSorter`）、筛选两通道（`:523/:530`）、cellSlot、编辑当前值、汇总（`:2424` 注入）——咽喉加公式分支即全部按计算值。

**设计**：镜像 react AO——getCellValue 公式分支（2 参 `memoizedFormulaValue`，无 tables 槽 = react BC 前字节语义）+ `tableDisplayText(row, col, getCellValue)` 显示解析器 + 编辑 display-only 四守卫（beginEdit `:660` / beginRowEdit `:784` / row-mode reopen `:907` / `data-editable` `:2193`）+ `withComputedFormulaCells` 影子行物化（导出 `:1450/:1455` + 剪贴板 `table-keyboard.ts:107`）+ autoDetectTypes cast 清理。

**文件地图**：vue 包 4 改 + 1 新测试 + comparison 文档行；零 prop/事件/i18n/样式/core 改动，manifest 无 diff。

**测试计划**：~14 例（渲染×3 / 排序×2 / 筛选×2 / 汇总×1 / 导出×1 / 编辑纪律×3 / 求值器桥契约×1 / 剪贴板×1），镜像 react AO 用例按 vue 惯例。

**8 条 fiat 供 gate 仲裁**：范围裁定（渲染+排序/过滤 vs 咽喉免费继承的汇总）、导出/剪贴板物化是否在 scope、`formulaTables`/`showCellRefs` 分批、独立导出保持裸序列化器、sortType 既有差异、TS 逆变 cast、记忆契约。
