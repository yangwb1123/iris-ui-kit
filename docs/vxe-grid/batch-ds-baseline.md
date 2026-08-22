Baseline 完成 — 仅新建 `/home/u1/iris-ui/docs/vxe-grid/batch-ds-baseline.md`（`DECISIONS.md`、`batch-dr-gate.md` 为工作区既有改动，未触碰；零源码修改）。

## Baseline summary — 批 DS：列宽提示（iris 独有）

**Exact design** — spec（`widthHint?: boolean`——列宽拖拽时显示宽度数值提示（`data-iris-width-hint`，跟随指针）；测试（拖拽显示/隐藏））已在 HEAD `fedc213e` 完整提交（`61ec5418` DL–DT 批次内落地，DECISIONS.md:2754/2782 批记录在案），逐行锚定：

- **prop**：`props/layout.ts:163`，经 `props.ts:5,81-84` 交叉出口；`Table.tsx:311` 默认 `false`（opt-in，additive）
- **载体**：`Table.tsx:8753` 仅在 `resizableColumns` 且非 pinned 边界列的手柄上透传
- **生命周期**（`column-layout.tsx`）：`onStart:56-58` 显示初始列宽 → `onDrag:60-64` 实时 `clamp(start+dx)` 刷新并走既有 `onResize` 落盘 → `onEnd:65` 清空（pointercancel 同回路）
- **渲染**：`104-120` `position:fixed` 跟随指针（`+8/-32` 固定偏移）、`pointerEvents:none`、全 CSS token 样式（含 fallback）、`aria-hidden`；内容 `{hint.width}px`

**File map**：prop 1 + Table.tsx 2 点 + `column-layout.tsx` 实现 1 文件 + 测试 1（`test/batch-dl-dt.test.tsx:464-483`「DS shows and clears the live width hint」拖拽显示/隐藏两态断言）；零 core/其他框架/i18n/样式改动。

**Test plan**：实跑 3 档——DS 定向 1/1、batch-dl-dt 全套 **21/21**、React 全量 **2826/2826** 绿（246 files）。

**4 条 non-blocking 观察**：键盘 resize 不显示 hint（spec 只定义拖拽）；hint 依赖 resizableColumns/排除 pinned 边界列无负向测试；pointercancel/disabled 切换无断言；clamp 边界与 `aria-hidden` 语义无 a11y/视觉基线断言。
