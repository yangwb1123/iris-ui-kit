Batch EM complete and committed (`5ff37fee`).

## Report

**SPEC**: svelte IrisTable 公式列同步——`column formula?: string`（core `evaluateFormula`/`memoizedFormulaValue` 桥接：计算值渲染 + 参与排序/过滤），react AO / vue EK / solid EL 语义逐字镜像、薄桥（2 参 `memoizedFormulaValue`）。**这是四框架公式列对齐的最后一段收口。**

### Files changed（5 源 + 1 测试 + 3 docs，+441/−18）

| File                                                            | Change                                                                                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/svelte/src/primitives/table/types.ts`                 | `IrisTableColumn` + 单行字段 `formula?: string`（多行 JSDoc，同名契约）                                                               |
| `packages/svelte/src/primitives/table/tableUtils.ts`            | `getCellValue` 咽喉公式分支（渲染/排序单多列/筛选双通道/汇总/草稿/pattern 免费继承）+ `isEditableColumn` + `withComputedFormulaCells` |
| `packages/svelte/src/primitives/table/IrisTable.svelte`         | `tableDisplayText(row,col,getCellValue)` 解析器；inline 5 编辑守卫；handle 导出 ×2 物化；autoDetectTypes cast 清理；净 +7 行          |
| `packages/svelte/src/primitives/table/table-row-edit.svelte.ts` | **svelte 专有**：行模式 3 守卫（begin 会话过滤 / reopen / Tab），模块内 import 零循环依赖                                             |
| `packages/svelte/src/primitives/table/table-keyboard.ts`        | 范围 Ctrl+C 剪贴板物化                                                                                                                |
| **NEW** `formula.test.ts`                                       | 15 例 / 289 行（≤500）：渲染 ×3 / formatter / 排序 ×2 / 筛选 ×2 / 汇总 / 导出 ×2 / 编辑纪律 ×3 / 剪贴板 TSV                           |
| 3 docs                                                          | comparison（批 EM 行 + 构建状态 + 计数）+ `batch-em-adapt.md` + `batch-em-baseline.md` 随批入库                                       |

### Verification（全绿）

- svelte **typecheck 0 errors** · **test 1003/1003**（147 files，+15）+ hydration **35/35** · **lint 0 errors**
- iris-ui-spec `--mode all` **0 violations**（1540 files）
- `gen:manifest` 重新生成 + `check:manifest`：**零 diff**（155×4、86 tokens，unavailable=0 — formula 是列字段非 prop）
- core 零改动（framework-free grep 0）；prettier clean；`git diff --check` clean
- arch-check `--ratchet`：exit-1 三条为 **HEAD 既有**（svelte IrisTable.svelte HEAD 1606 vs baseline 1493 批 EJ 已超、react Table.tsx、vue Table.ts——本批 +7 不改变 pre-existing 状态，EK F1 先例）

### Counts

svelte 988 → **1003 tests**（+15 公式列）· hydration 35 不变 · manifest 155×4 / 86 tokens 不变。

### What's left

- **四框架公式列对齐收口完成**（react AO → vue EK → solid EL → svelte EM）
- `formulaTables` 跨表引用（react 批 BC 特性）其余三端未同步（分批 fiat）
- 会话前既有 dirty（aero-platform-console / pnpm-lock / DECISIONS.md / batch-el-gate.md）未卷入提交
