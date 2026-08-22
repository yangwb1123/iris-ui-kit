Baseline written: `/home/u1/iris-ui/docs/vxe-grid/batch-ea-baseline.md` (155 行，批 EA 滚动到顶按钮). No source files modified — `git status` shows only the new doc plus pre-existing dirt.

**Verified** (HEAD `31addcd3` 批 DZ 已合入，manifest 204 props / 33 events — EA → 205 props):

- **滚动容器双路事实**：fixed-height 模式下滚动容器是根（`rootRef`，`overflow:auto`，Table.tsx:7501 `fixedHeight`）；virtual 模式下滚轮发生在 `[data-iris-virtual-scroll]` 视口（虚拟高度测试只设 `virtualScroll.height`，顶层无 height → 根不滚动）。按钮必须双路寻址。
- **重叠定位先例**：BU watermark 注释明确「absolute 挂滚动容器会随内容滚走，sticky 才能钉视口」（cell-helpers.tsx:293）——按钮采用 **sticky 零高锚**（`height:0` wrapper 收官 + absolute 按钮），零布局侵占、无死滚动尾。
- **可复用配方**：独立原语 `IrisBackTop`（`scrollTo?.({top:0})||scrollTop=0` 回退、reduced-motion→'auto'、`insetInlineEnd:24`、40×40 圆钮、`↑` 字形、`backTop.label` i18n 已存在→**零 messages 改动**）；`usePrefersReducedMotion`、FNR 按钮字形、RTL 逻辑属性先例齐全。

**Design**：`scrollToTop?: boolean`（`props/advanced.ts`，`scrollbarThumb` 后，203→204→实际 204→205 props）；常量 `SCROLL_TOP_VISIBLE_PX=200` + 布尔态 `scrollTopShown`（仅阈值穿越翻转，无逐像素重渲染）；监听 effect 双路（virtual 视口 / fixedHeight 根，皆无→惰性零节点 fail-closed）；点击 = `scrollTo({top:0, behavior})` 回退 `scrollTop=0`；根末 sticky 零高 wrapper（zIndex 3：表头 z2/钉列 z1 之上、面板之下、pointer-events none）+ presence-gated 按钮（printable 抑制）；全 inline style，零样式表改动。

**File map**：2 源码（advanced.ts + Table.tsx）、1 新测（test/batch-ea.test.tsx）、manifest 再生成；无 core/types/i18n/virtual-scroll 改动。**8 条显式 fiat**（布尔 prop、双滚动器边角收敛到虚拟视口、无动画、backTop.label 复用、无 rAF/定时器、不可滚动惰性、zoom 兼容、printable 抑制）。**19 例测试计划**：出现/边界/消失/点击（回退+scrollTo 双路径）/降级运动/virtual 路径/重渲染保持/清理/onScroll 独立/样式契约/zoom/SSR/printable。
