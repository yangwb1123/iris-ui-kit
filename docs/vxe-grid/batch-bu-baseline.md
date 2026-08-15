Baseline complete. **`/home/u1/iris-ui/docs/vxe-grid/batch-bu-baseline.md`** written (11 lines, the only new file from this task — `DECISIONS.md`/`batch-bt-gate.md` are pre-existing pipeline state; zero source files touched).

## 核验摘要

**设计** — 新表级 prop `watermark?: string`（props.ts 接口尾，`showFooterOverflow` 后 / `style` 前）：**绝对定位旋转层** `data-iris-watermark` 嵌入根内（`renderTableWatermark` 模块 helper，presence 门控零成本），插在 `{renderFooterStack()}`（:8619）后、浮动面板块前——72 个平铺 tile（`data-iris-watermark-tile`，独立 IrisWatermark 原语 TILE_COUNT/attr 先例）、`rotate(-22deg)`、`color: var(--iris-muted)`（**token 色**）、opacity 0.15、gap/fontSize token 值（24/16，uispacing 干净）、`aria-hidden` + pointer-events/user-select none。**根锚定**：`...style` 后强制 `position: relative`（zoom 健壮性先例，caller style 不能拆锚；zoom fixed 仍赢）。**关键决定**：层嵌入根内而非包裹根——原语 wrap 会破坏 fixed-height 滚动容器/sticky 表头（文档化分歧，attr/视觉复用）。绘制序已实测核验：盖静态行/表尾/分页器，低于 sticky 表头 z2、固定列 z1、浮动面板 popover 1000；fixed-height 下锚视口、随行滚动不动。

**文件地图**：props.ts +1 · Table.tsx 4 触点（destructure :1740、helper+常量 :540、根 style :8094、overlay JSX :8619）· styles.ts +2 常量 · NEW `test/watermark.test.tsx` · comparison doc 3 处 · manifest（propCount 160→161、eventCount 30 不变）· 零改动：types.ts/core/i18n/三框架（独立水印原语四框架已有，本批只做 react 表格适配器）。

**测试计划**（规格强制「渲染」打头，10 用例）：无 prop 零节点 → watermark 渲染含文本 → aria-hidden/不可交互 → rotate(-22deg) → token 色 → 锚定相对（含 caller style 覆盖）→ 空串 presence 门控 → rerender 更新 → zoom 共存 → fixed-height 共存。

**10 条 fiats** 覆盖 gate 仲裁面；全部锚点已逐一对当前代码核验。
