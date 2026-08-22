# 批 EL adapt 报告——solid 同步：公式列（四框架对齐）

## SPEC

solid IrisTable 公式列同步：`column formula?: string`（core `evaluateFormula` 桥接——计算值渲染 + 参与排序/过滤），react 批 AO / vue 批 EK 语义逐字镜像、薄桥（react BC 前 2 参 `memoizedFormulaValue` 字节语义）。

## Files changed（4 源 + 1 测试 + 2 docs）

| File                                                  | Change                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/solid/src/primitives/table/types.ts`        | `IrisTableColumn` + 单行字段 `formula?: string`（多行 JSDoc，react AO / vue EK 同名契约）                                                                                                                                                                                                                                                                                                  |
| `packages/solid/src/primitives/table/utils.ts`        | `getCellValue` 咽喉加公式分支（排序/筛选双通道/汇总/cellSlot 显示/编辑草稿/pattern 提示全免费继承）；新 `isEditableColumn`（同名薄桥）；新 `withComputedFormulaCells` 影子行物化（与咽喉同文件内聚）                                                                                                                                                                                       |
| `packages/solid/src/primitives/table/useTableSort.ts` | **solid 专有去重**：单列排序的逐字局部 `getCellValue` 副本删除，归并咽喉 import（react 显式接线 vs solid 咽喉继承的架构差异归档）                                                                                                                                                                                                                                                          |
| `packages/solid/src/primitives/table/IrisTable.tsx`   | 显示解析器 `tableDisplayText(row, col, getTableCellValue)`；编辑守卫 8 触点（beginEdit / beginRowEdit / row-mode reopen / row Tab / data-editable attr / dblclick / click-trigger / cursor）；`materializedRows` 影子行物化 3 消费点（exportCurrentViewCsv / exportMultiCsv / 范围 Ctrl+C）；autoDetectTypes cast 清理（公式列仍跳过检测）；**净行数 +1**，守住 grandfathered ratchet 2340 |
| **NEW** `formula.test.tsx`                            | 15 例 ≤500 行（273）：渲染 ×3 / formatter 显示链 / 排序 ×2 / 筛选 ×2（text + checked sets）/ 汇总 / 导出 ×2 / 编辑纪律 ×3 / 剪贴板 TSV                                                                                                                                                                                                                                                     |
| `docs/vxe-grid-comparison.md`                         | 构建状态长行 + 批 EL 表格行 + solid 测试计数（1013→1028）                                                                                                                                                                                                                                                                                                                                  |
| **NEW** `batch-el-adapt.md`                           | 本报告                                                                                                                                                                                                                                                                                                                                                                                     |

## Verification（全绿）

- solid **typecheck** 0 errors
- solid **test 1028/1028**（143 files，+15）+ hydration **38/38**
- solid **lint 0 errors**
- `arch-check --ratchet`：**IrisTable.tsx 已豁免（2340 = baseline，null 增长）**；exit 1 的三条（react Table.tsx / svelte IrisTable.svelte / vue Table.ts）为 **HEAD 既有**——stash 前后逐字相同，本批零新增
- iris-ui-spec `--mode all` **0 violations**（1540 files）
- `gen:manifest` 重新生成：**零 diff**（155×4 / 86 tokens，`formula` 是列字段非 prop，unavailable=0）
- core framework-free grep clean（零 core/三框架改动）；prettier clean

## Constraints honored

Core untouched；solid bridge only（react/vue/svelte 零触碰）；additive props only；单行字段声明 / 具名导出接口卫生；CSS 零改动（零 token 风险）；4 源 + 1 测试；test 273 行 ≤ 500。

## Fiats（baseline 8 条裁定，含 solid 专有两条）

| Fiat                                                 | 裁定                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 渲染+排序/过滤走咽喉免费获得                         | 采纳——`utils.getCellValue` 公式分支，单列（useTableSort）/多列（createMultiSortComparator）/双筛选通道/汇总/显示全继承    |
| 导出+剪贴板物化一并交付（mirror react）              | 采纳——`withComputedFormulaCells` + 组件级 `materializedRows` 3 消费点，原行不动                                           |
| `formulaTables`/`showCellRefs`/`sortType` 分批留后续 | 采纳——本批不越界（2 参 `memoizedFormulaValue` 无 tables 槽）                                                              |
| 独立导出保持裸序列化器                               | 采纳——`exportCsv` 不动，物化在 Table 侧                                                                                   |
| **useTableSort 去重归并**（solid 专有）              | 采纳——本地副本删除、import 咽喉；单列排序因此自动按计算值排序（react 显式接线 vs solid 咽喉继承，均为同一核心语义）       |
| **IrisTable.tsx 净行数 ≤ +2 守 2340**（solid 专有）  | 达成——净 +1（autoDetectTypes -2 / import +1 / materializedRows +1 / displayText +1），grandfathered 豁免；prettier 不回流 |

## What's left

- **svelte 是最后一段**：公式列四框架对齐只剩 svelte（react AO → vue EK → solid EL 已完成三端）
- `formulaTables` 跨表引用（react 批 BC 特性）在另三端未同步
- 会话前既有 dirty（aero-platform-console / pnpm-lock / DECISIONS.md / batch-ek-gate.md）保持不动，未卷入提交

## 提交

`feat(solid): grid 批 EL——公式列同步（formula 四框架对齐）`
