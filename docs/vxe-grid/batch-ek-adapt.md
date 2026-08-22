Done. Batch EK complete and committed (`949ddecd`).

## Report

**SPEC**: vue IrisTable 公式列同步——`column formula?: string`（core `evaluateFormula` 桥接，计算值渲染 + 参与排序/过滤），react 批 AO 语义逐字镜像、薄桥（react BC 前 2 参 `memoizedFormulaValue` 字节语义）。

### Files changed（4 源 + 1 测试 + 2 docs）

| File                                                  | Change                                                                                                                                                                                                                                                               |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/vue/src/primitives/table/types.ts`          | `IrisTableColumn` + 单行字段 `formula?: string`（多行 JSDoc，react AO 同名契约）                                                                                                                                                                                     |
| `packages/vue/src/primitives/table/table-helpers.ts`  | `getCellValue` 咽喉加公式分支（排序/筛选双通道/汇总/cellSlot/编辑草稿/pattern 提示全免费继承）；新 `isEditableColumn`（react 同名薄桥）；新 `withComputedFormulaCells` 影子行物化                                                                                    |
| `packages/vue/src/primitives/table/Table.ts`          | 显示解析器 `tableDisplayText(row, col, getCellValue)`；编辑守卫 6 触点（beginEdit / beginRowEdit / row-mode reopen / data-editable attr / dblclick+click-trigger / cursor）；导出物化 2 消费点（`exportCurrentViewCsv`/`exportMultiCsv`）；autoDetectTypes cast 清理 |
| `packages/vue/src/primitives/table/table-keyboard.ts` | 范围 Ctrl+C 剪贴板物化（shadow rows 先行再 `serializeTableRange`）                                                                                                                                                                                                   |
| **NEW** `formula.test.ts`                             | 14 例 ≤500 行：渲染 ×3 / formatter 显示链 / 排序 ×2 / 筛选 ×2（text + checked sets）/ 汇总 / 导出 ×2 / 编辑纪律 ×3（dblclick、click-trigger、row-mode）/ 剪贴板 TSV                                                                                                  |
| `docs/vxe-grid-comparison.md`                         | +批 EK 行、构建状态行、vue 测试计数                                                                                                                                                                                                                                  |
| **NEW** `batch-ek-adapt.md`                           | 完成报告（含 fiats 裁定）                                                                                                                                                                                                                                            |

### Verification（全绿）

- vue **typecheck** 0 errors
- vue **test 1588/1588**（166 files，+14）
- vue **lint 0 errors**（1 条既有 renderRow 复杂度 warning 76 = HEAD 原值——`isEditableColumn` 抽取后零增长，react 同款纪律）
- iris-ui-spec `--mode all` **0 violations**（1540 files）
- `gen:manifest` 重新生成 + `check:manifest` up-to-date — vue 契约零 diff（`formula` 是列字段非 prop，155×4/86 tokens，unavailable=0）
- core framework-free grep clean；prettier clean

### Constraints honored

Core untouched（零 framework import）；vue-bridge only；additive props only；单行函数/命名接口/类型卫生；CSS 零改动（无 token 风险）；≤4 changed files + tests；test ≤500 行。

### Fiats（baseline 8 条裁定）

渲染+排序/过滤/汇总走咽喉免费获得；导出+剪贴板物化一并交付（mirror react）；`formulaTables`/`showCellRefs`/`sortType` 分批留后续；独立导出 `exportCsv`/`exportExcel` 保持裸序列化器（物化在 Table 侧）；SSR 安全（无 window 依赖）。

### What's left

- solid/svelte 的公式列对齐（react→vue 已完成，另两端待后续批）
- `formulaTables` 跨表引用（react 批 BC 特性）未同步
- 会话前既有 dirty（aero-platform-console / pnpm-lock / DECISIONS.md / batch-ej-gate.md）保持不动，未卷入提交
