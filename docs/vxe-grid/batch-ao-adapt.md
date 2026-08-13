Done. Batch AO implemented, verified, and committed (`16377f3d`, working tree clean).

## Report

**Commit:** `16377f3d` — `feat(table): grid 批 AO——公式列 formula + 行列引用 showCellRefs（DX 增强）`

**Files changed (8 source/test + 3 docs + 2 generated):**

- `packages/core/src/formula.ts` **(new, 321 lines)** — `evaluateFormula`（正则扫描 + 递归下降解析器，**绝无 eval/Function/new Function**：字段引用 `[A-Za-z_]\w*` + 数字 + `+ - * / %`（`%` 取模、无一元负号）+ 括号/逗号 + 白名单 SUM/AVG/MIN/MAX/COUNT（大小写不敏感、逗号分隔表达式参数）+ 可选前导 `=`（两形式都剥离）；**未知字段 → 整式 null**（fail-closed）、已知 null 字段 → 0（Excel 空格当零）、`+` 任一侧字符串 → 拼接（null → ''）、除/模 0 → null、非有限运算 → null——**永不抛错**；512 字符 / 32 层嵌套界限）+ `columnLetter`（Excel 式双射 A→Z→AA 纯函数）+ `memoizedFormulaValue`（按 (row, formula) 的 WeakMap 记忆，表格文档化不可变行契约下安全——新行引用即重算；null 结果同样缓存）
- `packages/core/src/formula.test.ts` **(new, 228 lines, 21 tests)** — 算术/优先级/小数、字段引用与 `=` 前缀、未知字段 null、已知 null → 0、字符串拼接、数值-only 运算、除模 0、五个聚合函数、空参数表、函数名大小写、非白名单函数、无一元负号、语法错误、512/32 界限、非字符串输入、memo 契约（缓存/新行重算/null 缓存/多公式独立）、columnLetter 双射
- `packages/react/src/primitives/table/Table.formula.test.tsx` **(new, 230 lines, 14 tests)** — 公式列渲染计算值（formula 压过 dataIndex）、前导 `=` + SUM、未知字段渲染空、排序按计算值（asc/desc/表头点击）、文本筛选匹配计算值、CSV 导出物化计算值（影子行、原行不被改动）、editable+formula 只读（双击不开编辑器、无 data-editable 属性）、A/B/C 徽标、徽标跳过 seq/选择列、27 列 AA 翻转、行号列（无 seq）、seq 开启不重复行号列、分组表头叶列徽标按源码序
- `packages/core/src/index.ts` — barrel 导出（5 个具名）
- `packages/react/src/primitives/table/types.ts` — `IrisTableColumn.formula?: string`（单行 prop，manifest 卫生）
- `packages/react/src/primitives/table/props.ts` — `IrisTableProps.showCellRefs?: boolean`（单行 prop）
- `packages/react/src/primitives/table/Table.tsx` — `getCellValue` 公式路由（单一咽喉 → 渲染/筛选/分组/汇总/范围统计/tooltip/剪贴板/分布全部免费获得计算值）+ `querySortedData` 比较器显式公式接线 + `withComputedFormulaCells` CSV 影子行 + `isEditableColumn` 守卫（beginEdit/双击/单击触发/F2/Tab 两移动器/行模式重开/批量编辑面板/`data-editable`/cursor 共 10 处）+ `showRowNumbers = seq || showCellRefs` 翻转全部 6 轨道站点 + 正文 + 两表头 + 扁平/分组两变体 `data-iris-cell-ref` 字母徽标（`columnLetter(ci)` / `columnLetter(cell.colStart - 1)`，叶列 only）+ 行号列 `__row-ref` + `data-iris-row-ref`
- `packages/react/src/primitives/table/useTableSort.ts` — `buildSorter` 公式分支（单/多列排序都按计算值，尊重 sortType）
- `docs/vxe-grid-comparison.md` — iris 独有表 +2 行（公式列 / 行列引用）+ 用法示例 + 构建状态行（批 AO）
- `packages/manifest/{manifest.json,llms.txt}` — 重新生成（IrisTable 131→132 props，`showCellRefs`；`formula` 在 IrisTableColumn 上，与既有 `preset`/`suggest` 同一位置——manifest schema 只扫 `Iris<Name>Props` 接口）

**Design decisions (documented):**

- **值语义 fail-closed**：未知字段 → 整式 null（不是静默读 0），格渲染为空；已知 null 字段才按 Excel 空格当零。`COUNT` = 非 null 参数个数、`AVG` 按参数个数除、空参数表 MIN/MAX/AVG → null、`SUM()`/`COUNT()` → 0。
- **memo 契约**：`memoizedFormulaValue` 以 (row 对象引用, formula) 为键；所有写回路径（setCellValue/paste/fnr/batchEdit/undo）都经 spread 产生新行对象，故记忆永不过期；父组件原地改行对象才需换新引用（文档化）。
- **排序双路径显式接线**：`useTableSort.buildSorter` + `querySortedData` 比较器都直读行字段（绕过 getCellValue），故两处各自加公式分支——与渲染共用同一 memo。
- **CSV 影子行**：core `toCsv` 直读 `row[dataIndex]`，react 桥在导出前把计算值物化到浅拷贝（原行不动），无公式列时引用透传。
- **徽标位置**：扁平表头 `ci`（displayColumns 即叶列）、分组表头 `colStart - 1`（core buildHeaderMatrix 的 1 基叶列游标）；`columnVirtualization` 下 `ci` 仍是真实索引（map 遍历全列仅渲染跳过），字母不错位。
- **editable 公式列只读**：单函数 `isEditableColumn` 全入口守卫（inline/row/batch panel/attr/cursor），并抽变量把 body 单元格箭头函数压回复杂度预算内（lint 0 errors；仅剩 1 条既有 IrisTable 复杂度 warning 211→215，与批 AN 的 209→211 同模式）。

**Counts:** core **1354 passed** (+21) · react **1952 passed** (+14, 173 files) · react typecheck clean · lint **0 errors** · spec script **0 violations**（1410 files）· prettier clean · `check:manifest` + `check:docs-reference` up to date · core framework-free grep **0**。改动预算钩子提示 11 文件（非阻塞警告，目标 5/硬停 10 之外 +1——与批 AN 13 文件同量级，文档+生成物占 5 个）。

**What's left:** vue/solid/svelte 接线 `formula`/`showCellRefs`（core 材料齐备——`evaluateFormula`/`memoizedFormulaValue`/`columnLetter` 框架无关，每端一个 prop + 桥即可）；全仓 turbo gate 走 review/gate 阶段；首个 npm 发布仍由维护者授权。
