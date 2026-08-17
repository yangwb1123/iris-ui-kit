Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-dh-baseline.md`. Only the new doc was created — the working tree shows just the pre-existing dirt (`DECISIONS.md` M, `batch-dg-gate.md` M) plus the new untracked baseline; HEAD `2566d78f` unchanged. No source files modified.

## Summary for 批 DH：单元格图案填充（iris 独有）

**Spec**：`pattern?: boolean` — 编辑 draft 时整列匹配值轻微高亮（`data-iris-input-hint`，与其他匹配行对照提示——数据一致性辅助）；测试（高亮匹配行）。

**核心发现（逐行复核 Table.tsx / props.ts / types.ts / core `cell-edit.ts`）**：

- 逐键实时高亮的**免费通道**已存在：inline 单元格模式 `const editTarget = useStore(cellEdit.store)`（Table.tsx:4267）组件级订阅，`setDraft → store` 更新即重渲染整个正文——draft/activity 可在正文 cell（:8362）直接读取，零新增状态。
- 正文 cell 渲染在组件作用域，`editing`、`raw = getCellValue(row, col)`、`col.key` 全部就位，可单点注入 `data-iris-input-hint` + `background-image`。
- 匹配须对**原始已提交值**做 `String(raw) === String(draft)`，与 `EditorSurface`/`beginEdit` 的 draft 口径一致（非掩码/格式化展示值）。
- 样式纪律（BE）：新高亮用 `background-image` 长写，spread 在 `conditionalCellStyle` 之后、`lockedRender.style` 之前（lock 斜纹末尾获胜）。
- 空 draft fail-closed（清空不误标整列空值）。

**精确设计**：新 `pattern?: boolean`（props.ts，默认 false）；`patternEdit` 活动列+draft 解析；模块级 `patternHintStyle(active)` 助手；正文 per-cell `patternHint` + `data-iris-input-hint` 属性 + 样式 spread；排除编辑 cell 自身。CSS 变体 `--iris-input-hint` 行内带默认回退，无需改主题。

**文件地图**：`props.ts`（+1 prop）· `Table.tsx`（+解构、+助手、+解析、+属性/spread）· 新增 `pattern-fill.test.tsx`。不动 types.ts / core / styles.ts / i18n / 其它框架。

**测试计划**（~11 用例）：gating×2、happy path、逐键实时、raw 匹配、空 draft fail-closed、仅编辑列、locked 列属性保留、row 模式快照、与 cellRange 共存、提交即清。

**Fiats**：row 模式逐键不实时（seed 快照，inline 默认路径完全实时）；locked 视觉在斜纹后；单活动列；纯视觉+属性、零状态/回调/核心改动。
