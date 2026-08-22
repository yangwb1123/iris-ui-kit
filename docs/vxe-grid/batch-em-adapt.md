Done. Batch EM complete.

## Report

**SPEC**: svelte IrisTable 公式列同步——`column formula?: string`（core `evaluateFormula`/`memoizedFormulaValue` 桥接：计算值渲染 + 参与排序/过滤），react AO / vue EK / solid EL 语义逐字镜像、薄桥（2 参 `memoizedFormulaValue` = react BC 前字节语义）。这是四框架公式列对齐的**最后一段收口**。

### Files changed（5 源 + 1 测试 + 2 docs，基线文件地图逐字执行）

| File                                                            | Change                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/svelte/src/primitives/table/types.ts`                 | `IrisTableColumn` + 单行字段 `formula?: string`（多行 JSDoc，react/vue/solid 同名契约）                                                                                                                                                                    |
| `packages/svelte/src/primitives/table/tableUtils.ts`            | `getCellValue` 咽喉公式分支（渲染/排序单多列/筛选双通道/汇总/草稿/pattern 全免费继承）+ 新 `isEditableColumn` + 新 `withComputedFormulaCells` 影子行物化                                                                                                   |
| `packages/svelte/src/primitives/table/IrisTable.svelte`         | `tableDisplayText(row, col, getCellValue)` 显示解析器；编辑守卫 inline 5 触点（beginEdit / data-editable / click-trigger / dblclick / 光标）；handle 导出 ×2 物化；autoDetectTypes cast 清理（`& { formula?: unknown }` 删除，公式列仍跳过）；**净 +8 行** |
| `packages/svelte/src/primitives/table/table-row-edit.svelte.ts` | **svelte 专有**：行模式守卫 3 触点（begin 会话表过滤 / row-mode reopen / row Tab）——模块内 import `isEditableColumn`（tableUtils 无回引，零循环依赖；vue/solid 同守卫在 Table 内，svelte 行模式控制器独立文件是其架构差异）                                |
| `packages/svelte/src/primitives/table/table-keyboard.ts`        | 范围 Ctrl+C `copyActiveRange` 剪贴板物化（shadow rows 先行再 `serializeTableRange`，vue :107 逐字先例）                                                                                                                                                    |
| **NEW** `formula.test.ts`                                       | 15 例 / 289 行（≤500）：渲染 ×3 / formatter 显示链 / 排序 ×2 / 筛选 ×2 / 汇总 / 导出 ×2 / 编辑纪律 ×3 / 剪贴板 TSV                                                                                                                                         |
| `docs/vxe-grid-comparison.md`                                   | +批 EM 行、构建状态行、svelte 测试计数 988→1003                                                                                                                                                                                                            |
| **NEW** `batch-em-adapt.md`                                     | 本报告                                                                                                                                                                                                                                                     |

### Verification（全绿）

- svelte **typecheck 0 errors**（svelte-check）；**test 1003/1003**（147 files，+15）+ hydration **35/35**
- svelte **lint 0 errors**；prettier clean（IrisTable.svelte cursor 表达式收口为 Prettier 规范多行）
- iris-ui-spec `--mode all` **0 violations**（1540 files）
- `gen:manifest` 重新生成 + `check:manifest` up-to-date：**零 diff**（155×4、86 tokens、unavailable=0 —— formula 是列字段非 prop）
- core 零改动（framework-free grep `from '(vue|react|solid|svelte)'` = 0）
- arch-check `--ratchet`：exit-1 三条为 **HEAD 既有**（`IrisTable.svelte` HEAD 1606 vs baseline 1493 批 EJ 已超、react Table.tsx 9137→10232、vue Table.ts 2539→2546；本批仅 svelte +8 → 1614，不改变 pre-existing 状态，按 EK F1 先例接受）

### Constraints honored

Core untouched（零 framework import）；svelte-bridge only（其余三框架零触碰）；additive props only（无 prop/事件/i18n/样式改动）；≤500 行测试（289）；manifest 卫生——`formula?: string` 单行字段、`IrisTableColumn` 既有具名导出接口、无新类型；CSS 零改动（无 token 风险）。

### Fiats（baseline 7 条裁定）

- 渲染+排序/筛选/汇总走咽喉免费获得；`tableDisplayText` 3 参 resolver 传咽喉
- 导出+剪贴板物化一并交付（mirror react/vue/solid）；原行不动（不可变行契约）
- **行模式守卫注入方式**：`table-row-edit.svelte.ts` 模块内 import `isEditableColumn`——tableUtils 无回引、零循环依赖（裁定）
- autoDetectTypes cast 清理；`col.sorter` 优先级保留
- `formulaTables`（批 BC）/`showCellRefs`/`sortType` 分批留后续（与 EK/EL 同 fiat）
- 独立导出 `exportCsv` 保持裸序列化器（物化在 Table 侧）
- SSR 安全（无 window 依赖，hydration 35/35 全绿）

### Counts

svelte 988 → **1003 tests**（+15 公式列）· hydration 35 不变· IrisTable.svelte 净 +8 行（pre-existing 超限状态不变）。

### What's left

- **四框架公式列对齐收口完成**（react AO → vue EK → solid EL → svelte EM）
- `formulaTables` 跨表引用（react 批 BC 特性）其余三端未同步
- 会话前既有 dirty（aero-platform-console / pnpm-lock / DECISIONS.md / batch-el-gate.md）未卷入提交
