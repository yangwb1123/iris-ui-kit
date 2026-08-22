Batch EL complete and committed (`ccae9436`).

## Report

**SPEC**: solid IrisTable 公式列同步——`column formula?: string`（core `evaluateFormula`/`memoizedFormulaValue` 桥接：计算值渲染 + 参与排序/过滤），react AO / vue EK 语义逐字镜像、薄桥（2 参 `memoizedFormulaValue` = react BC 前字节语义）。

### Files changed（4 源 + 1 测试 + 3 docs，+402/−27）

| File                                                  | Change                                                                                                                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/solid/src/primitives/table/types.ts`        | `IrisTableColumn` + 单行字段 `formula?: string`（多行 JSDoc，同名契约）                                                                                                               |
| `packages/solid/src/primitives/table/utils.ts`        | `getCellValue` 咽喉公式分支（渲染/排序/筛选双通道/汇总/草稿/pattern 全免费继承）+ `isEditableColumn` + `withComputedFormulaCells`                                                     |
| `packages/solid/src/primitives/table/useTableSort.ts` | **solid 专有去重**：单列排序的逐字局部 `getCellValue` 副本删除、归并咽喉（fiat 裁定）                                                                                                 |
| `packages/solid/src/primitives/table/IrisTable.tsx`   | 显示解析器 `tableDisplayText(row, col, getTableCellValue)`；编辑守卫 8 触点；`materializedRows` 影子行物化 3 消费点；autoDetectTypes cast 清理；**净 +1 行**，grandfathered 2340 守住 |
| **NEW** `formula.test.tsx`                            | 15 例 / 263 行（≤500）：渲染×3 / formatter / 排序×2 / 筛选×2 / 汇总 / 导出×2 / 编辑纪律×3 / 剪贴板 TSV                                                                                |
| 3 docs                                                | comparison 长行+表格行+计数（solid 1013→1028）；`batch-el-adapt.md`；`batch-el-baseline.md` 随批入库                                                                                  |

### Verification（全绿）

- solid **typecheck 0 errors**；**test 1028/1028**（143 files，+15）+ hydration **38/38**；**lint 0 errors**
- `arch-check --ratchet`：IrisTable.tsx 已豁免（2340=baseline，零增长）；exit-1 三条为 **HEAD 既有**（stash 前后逐字相同）
- iris-ui-spec `--mode all` **0 violations**（1540 files）
- `gen:manifest` + `check:manifest`：**零 diff**（155×4、86 tokens、unavailable=0 — formula 是列字段非 prop）
- core 零改动（framework-free grep clean）；prettier clean

### Counts

solid 1013 → **1028 tests**（15 新增）· IrisTable.tsx 净 +1 行（ratchet 2340 不变）。

### What's left

- **svelte 是最后一段**：四框架公式列对齐只剩 svelte（react AO → vue EK → solid EL 已完成）
- `formulaTables` 跨表引用（react 批 BC 特性）其余三端未同步
- 会话前既有 dirty（aero-platform-console / pnpm-lock / DECISIONS.md / batch-ek-gate.md）未卷入提交
