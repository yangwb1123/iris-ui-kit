# 批 EK 完成报告 — vue 同步：公式列（四框架对齐）

**SPEC**: vue IrisTable 同步公式列：`column formula?: string`（core `evaluateFormula` 桥接——计算值渲染 + 参与排序/过滤）；测试（公式渲染/求值器）。react 批 AO 语义逐字镜像、薄桥（react BC 前 2 参 `memoizedFormulaValue` 字节语义）。

## 文件变更（4 源 + 1 测试 + comparison 文档）

| 文件                                                        | 变更                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/vue/src/primitives/table/types.ts`                | `IrisTableColumn` + 单行字段 `formula?: string`（多行 JSDoc 文档，react AO 同名契约——vxe 无计算列概念）                                                                                                                                                                                                                                                                                                                                                                                              |
| `packages/vue/src/primitives/table/table-helpers.ts`        | `getCellValue` 咽喉加公式分支（`column.formula → memoizedFormulaValue(formula, row)` 2 参 = react BC 前语义）——排序 `useTableSort.buildSorter`（单/多列）、筛选两通道（text + filterValues checked sets）、汇总 `renderTableSummaryRow`、cellSlot、编辑草稿、pattern 提示全免费继承计算值；**新 `isEditableColumn`**（`!!editable && !formula`，react 同名薄桥）——全部编辑入口同一守卫；**新 `withComputedFormulaCells`** 影子行物化（无公式列返回原数组引用，react table-value-helpers 逐字节语义） |
| `packages/vue/src/primitives/table/Table.ts`                | 导入 `isEditableColumn`/`withComputedFormulaCells`；autoDetectTypes cast 清理（`& { formula?: unknown }` 删——类型已入列，公式列仍跳过检测）；单元格显示解析器 `tableDisplayText(row, col, getCellValue)`（mask → formatter → String 链消费计算值）；编辑守卫 5 触点（beginEdit / beginRowEdit 会话表 filter / row-mode reopen / `data-editable` attr / dblclick+click-trigger / 光标）；导出物化 2 消费点（`exportCurrentViewCsv`、`exportMultiCsv` 当前段——影子行先行）                             |
| `packages/vue/src/primitives/table/table-keyboard.ts`       | 范围 Ctrl+C 剪贴板物化：`copyActiveRange` 先 `withComputedFormulaCells` 再 `serializeTableRange`（core 序列化器直读 `row[dataIndex]`，计算值落影子行）                                                                                                                                                                                                                                                                                                                                               |
| **NEW** `packages/vue/src/primitives/table/formula.test.ts` | 14 例（≤500 行）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `docs/vxe-grid-comparison.md`                               | 「iris 独有」表 + 批 EK 行 + 构建状态行追加 + vue 测试计数更新                                                                                                                                                                                                                                                                                                                                                                                                                                       |

零 prop/事件/i18n/样式/core 改动，manifest 无 diff（`formula` 是列字段，不在 props 流）。

## 验证结果（全绿）

| 门                      | 结果                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| vue typecheck           | 0 errors 0 warnings                                                                               |
| vue test                | **1588/1588**（+14 新，166 files）                                                                |
| vue lint                | **0 errors**（1 条既有 renderRow 复杂度 warning 76 = HEAD 原值，`isEditableColumn` 抽取后未增长） |
| iris-ui-spec --mode all | **0 violations**（1540 files，零样式改动）                                                        |
| gen:manifest            | 已重新生成——vue 契约零 diff（`formula` 列字段不入 manifest；155×4/86 tokens，unavailable=0）      |

## Fiat（baseline 8 条，已裁定）

- **F1 范围**：渲染 + 排序/过滤/汇总全部走 `getCellValue` 咽喉免费获得；导出（exportCurrentViewCsv/exportMultiCsv）+ 剪贴板（Ctrl+C）影子行物化一并交付（mirror react 语义）。`exportCell`/`exportExcel` 无 handle 入口，不接。
- **F2 `formulaTables`/`showCellRefs`**：分批——本批仅 2 参 `memoizedFormulaValue`（react BC 前字节语义）；跨表引用留给后续批。
- **F3 独立导出保持裸序列化器**：`exportCsv.ts`/`exportExcel.ts` 零改动（物化在 Table/键盘侧调用点，react 同构）。
- **F4 sortType**：既有 vue sort 差异（无 sortType 概念）不碰。
- **F5 TS 逆变 cast**：autoDetectTypes 原 `& { formula?: unknown }` cast 随类型入列删除（类型收窄后自然通过，无残留 cast）。
- **F6 记忆契约**：`memoizedFormulaValue` WeakMap 按 (row 同一性, formula) 记忆，沿用表格不可变行契约。

## 剩余

- solid/svelte 的公式列对齐仍待后续批（本次仅 vue；react 批 BC `formulaTables` 跨表引用也仍未同步）
- `formulaTables`/`showCellRefs`/`sortType` 等 AO 家族成员按批 BC 等既有分批留后续
- 会话前既有未提交改动（aero-platform-console / pnpm-lock / DECISIONS.md）保持不动
