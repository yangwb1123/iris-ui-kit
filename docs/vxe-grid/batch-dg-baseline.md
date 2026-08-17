Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-dg-baseline.md`. No source files were modified — only the new doc was created.

## 批 DG：列宽自适应增强 — 基线摘要

**规格**：`autoResizeColumns?: boolean` — 双击列边界按内容自动适配列宽（测量最大内容宽度 + padding，clamp min/max），经 `onColumnWidthsChange` 写回；测试（双击适配）。

**核心发现（逐行复核）**：

- 写回通道已存在且单一：`setColumnWidth(key, width)`（Table.tsx:2865）合并进 columnWidths 映射并在受控/非受控两种模式下都触发 `onColumnWidthsChange`——正是"经 onColumnWidthsChange 写回"契约（无受控乐观翻转，BO/BX 先例）。
- clamp 默认值在**本地** `ColumnResizeHandle`（Table.tsx:1623：`minWidth ?? 60` / `maxWidth ?? Infinity`，`Math.round`）——它是活扁平表头渲染（:11075）实际接入的那个；`ColumnResizeHandle.tsx` 仅被遗留的 `TableHeader.tsx` 引用（Table.tsx 从不 import 它，死路径不动）。
- 单元格 padding 对称 `12px×2`（`BASE_CELL_STYLE`, styles.ts:14），且单元格为 `nowrap + overflow:hidden`——因此已渲染单元格的 `scrollWidth` **已含双侧 padding**，"最大内容宽度 + padding" 直接取 `max(scrollWidth)` 即满足，无需额外加项。
- DOM 查询键已有：表头 `data-iris-table-header={col.key}`、正文 `data-iris-table-cell={col.key}`（`findTableRowEl` CZ 先例）。

**精确设计**：新布尔 prop（props.ts，贴近 `resizableColumns`）；本地 `ColumnResizeHandle` 增可选 `onAutoFit` + span `onDoubleClick`；纯 `measureColumnContentWidth(root, colKey)` 模块级助手取 `max(scrollWidth)`；消费点（:11075）用与拖拽完全相同的 clamp 算出宽并走 `setColumnWidth` → `onColumnWidthsChange`。`autoResizeColumns` 无 `resizableColumns` 则无手柄、天然失效（fail-closed）。

**文件地图**：`props.ts`（+1 prop）· `Table.tsx`（+onAutoFit、+measure helper、+wire、+默认 false）· 新增 `auto-resize-columns.test.tsx`。不动 types.ts / ColumnResizeHandle.tsx / TableHeader.tsx / styles / i18n / core / 其它框架。

**测试计划**（~11 用例，render 直查 gridTemplateColumns + handle，jsdom 用 `Object.defineProperty` 打桩 scrollWidth）：gating×2、happy path、跨单元格取 max、padding 计入、min/max clamp、rounding、受控/非受控写回、拖拽与双击不串扰。

**Fiats**：虚拟滚动只测量已渲染窗口（vxe autoResize 同行为）；分组表头用同一扁平叶节点查询；摘要/页脚/合计行不纳入测量；`'auto'`/字符串声明宽度不触碰（始终写像素值）；对现有拖拽/键盘调整零改动。
