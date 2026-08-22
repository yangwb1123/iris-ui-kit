EC 批 baseline 已完成，输出 `/home/u1/iris-ui/docs/vxe-grid/batch-ec-baseline.md`（12 行，零源码改动）。

**核实的事实**（实测，非推测）：

- **HEAD** `701b77a3`（批 EB 已合入）；manifest **206 props** / 33 events，EC → **207 props**
- **当前验证快照**：react 255 files **2968/2968** ✓、core **1641/1641** ✓（本基线已跑 vitest 实测）
- **批 BN 单咽喉** `effectiveRowHeight = rowHeight ?? virtualScroll.itemHeight`（Table.tsx:677）→ `adaptiveOn = adaptiveRowHeight === true && effectiveRowHeight == null` **三态 inert 天然成立**：rowHeight 已设 / virtual（itemHeight 必填）都自动 inert，只有「无固定 rowHeight」才激活——正好对上 spec「无固定 rowHeight 时」
- **动机面**：baseCellStyle（:6561）nowrap+ellipsis+hidden——多行内容今天被单行裁切；批 CC `editAutoHeight` 是编辑态自增（EditorSurface），EC 是展示态行高，正交

**设计骨架**：

1. `adaptiveRowHeight?: boolean` — `props/editing.ts` 在 `rowHeight` 之后（manifest 206→207）
2. 换行开关走 **TABLE_ROW_CSS 数据属性规则**（`data-iris-adaptive-height="true"` 根标记 + `:not(header/summary/loading/empty/error)` 只放开数据行 `white-space: normal + word-break: break-word`）——零单元格渲染点改动，表头/汇总仍 nowrap
3. 测量 = 两个模块 helper（`adaptiveHeightStyleOf` + `measureAdaptiveRowHeights`）：依赖无关 layout effect 每 commit 读 `offsetHeight`、整体 diff 一次 setState、同值 bail 无回路；`≤0`（jsdom/SSR）跳过保留自然高——永不 0px 塌陷；window resize + ResizeObserver 重测，数据/编辑/字体/density 变化经重渲自愈
4. 零外围：无 i18n/core/types/styles/VirtualScroll/其余框架改动

**文件图** 6 项、**测试计划 19 例**（门控 5 + 行高差异/自愈 9 + helper 单测 2 + 契约 3）、**10 条显式 fiat**（virtual/rowHeight 双 inert、行键=attr 碰撞预存在接受、显式高=测得自然高无压缩、rowStyle escape hatch 赢、不做 virtual+adaptive 联合等克制）。
