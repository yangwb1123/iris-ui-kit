# Batch CV — 冻结边界拖拽（iris 独有）adapt 记录

## Task

`pinnedDrag?: boolean`——列边界拖拽线调整 pinned 列数（拖拽线在 pinned 边界；经 `onPinnedCountChange` 回调）；测试（拖拽调整）。

## Baseline key findings (batch-cv-baseline.md)

- Pin state 已有单一咽喉：`pinOf`（读受控 `pinnedColumns` / 内部 `pinsInternal` / 静态 `col.pinned`）与 `setColumnPinned`（非受控翻转 + 双通道 `onColumnPinnedChange`）。CV 完全骑此咽喉——零新 pin 机制。
- 边界已计算且 sticky：`pinnedOffsets` 解析边界 x；最后一个左固定叶头的尾缘即边界且两个 header 渲染分支都已 `position: sticky`——句柄放其内免费继承 sticky。
- `ColumnResizeHandle`（Table.tsx:1560）是模具：`absolute; right:0; width:8px` + `useDrag` + Arrow 键 + `role="separator"` + 纯英文 aria（零 i18n 先例）。Grouped header 目前不渲染 resize 句柄（已核实）。
- columnDrag 抢臂规避：句柄 React `onPointerDown` 必须 `stopPropagation()`，否则 `colDragCtrl.press` 会武装。

## Implementation

Spec-literal `pinnedDrag` 布尔开关 + `onPinnedCountChange` 回调（props.ts，`onColumnPinnedChange` 之后，propCount 180→182 / eventCount 31→32；`onPinnedCountChange` 单行函数 prop 满足 manifest scanner hygiene）。

**一个 PinnedDragHandle 组件**（`ColumnResizeHandle` 模具逐字）：8px grip + 2px `--iris-primary` 线（`insetInlineStart: '50%'`，RTL 安全）、`useDrag` 拖拽 = translateX ghost（`data-iris-pinned-drag-active`）、松开提交、ArrowLeft/Right ±1、React `onPointerDown` stopPropagation 防 columnDrag 抢臂（原生 useDrag 监听在 span 上先于 React root 分发，仍正常武装）。

**两个纯 module helpers**（框架无关，不 import 任何框架）：

- `leftPinnedCount(cols, pinOf, cap)`——cap 内连续左固定前缀计数（首右固定列硬上限）。
- `pinnedCountFromBudget(cols, widthOf, budget, cap)`——预算内最宽前缀（拖拽 dx → 边界位移）。

`resolvedColumnWidth` 抽成共享 helper（与 pinnedOffsets 同回落链：override → 列声明 number → DEFAULT_PINNED_WIDTH）。

**表内接线**：`firstRightPinnedIndex` / `pinnedBoundaryCol`（最后一个左固定叶，null = 无句柄）memos；`resolvePinnedCount(dx)`（预算 = 当前 pin 宽 + dx → count，键盘用 `resolve(0)` = 当前数）；`commitPinnedCount(count)`——clamp、no-op 直接返回零回调、逐列 `setColumnPinned('left'|null)` 只写变化的列（受控无乐观翻转、非受控写内部 map）+ 最后 `onPinnedCountChange(count)` 一次。flat + grouped 双 header 分支渲染句柄；flat 分支 boundary 列 `resizableColumns` 句柄抑制（同一尾缘不抢手势）。

## Fiats（baseline 记录）

right 块 clamp（首右固定列硬上限）· 宽近似（非数字 → 140，pinnedOffsets 同链）· header-only（body 不渲染）· virtualization 惰性（句柄照常渲染，滚动出视口由滚动处理）· RTL 用逻辑属性、物理 left/right 语义沿用既有 pinnedStyle · 零 i18n（aria 纯英文，ColumnResizeHandle 先例）· 键盘步进 = 1 列。

## Files

- `packages/react/src/primitives/table/props.ts` +2（pinnedDrag + onPinnedCountChange，JSDoc）
- `packages/react/src/primitives/table/Table.tsx`（destructure / PinnedDragHandle + 2 module helpers + resolvedColumnWidth / 边界 memos + commit/resolve / flat + grouped 双分支 / resize 抑制）
- `packages/react/src/primitives/table/test/pinned-drag.test.tsx` NEW —— 17 tests（≤500 行：487）
- `packages/manifest/manifest.json`（gen:manifest 再生成，propCount 182 / eventCount 32）
- `docs/vxe-grid-comparison.md` 2 spots（构建状态 tail + test-count 行）
- `docs/vxe-grid/DECISIONS.md`（stage 记录）

## Test plan（17）

① handle 在边界（位置/role/line/fail-closed×2）② 拖右调 count（attrs + onPinnedCountChange 一次 + 逐列变更恰一次）③ 拖左减 pin ④ 全 pin clamp ⑤ 零 clamp（句柄消失）⑥ no-op 零回调 ⑦ ghost transform（拖中 active + translateX，释放复位）⑧ right 块 clamp ⑨ 受控无乐观翻转 ⑩ 静态声明 seed + 显式 null 覆盖 ⑪ 键盘 ±1 + 两端 clamp ⑫ grouped 叶句柄 ⑬ resizableColumns 共存 + boundary 抑制 ⑭ columnDrag 抢臂 ⑮ columnVirtualization ⑯ 宽感知（100/200 真实宽判别 140 近似）⑰ lead 列排除（seq 不计数）。

## Verification

- core: **1559/1559**（框架无关不变式 intact——core 零改动）
- react typecheck clean · react test **2635/2635**（2618 + 17）
- lint 0 errors（1 个既有 complexity warning）
- spec 0 violations（1416 files）
- check:manifest up to date（manifest 已随本 commit 再生成）
