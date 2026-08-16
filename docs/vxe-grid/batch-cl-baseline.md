Baseline complete — written to `/home/u1/iris-ui/docs/vxe-grid/batch-cl-baseline.md` (25 lines). Zero source files touched; `git status` shows only the new baseline plus pre-existing prior-stage dirt (`DECISIONS.md`, `batch-ck-gate.md`), HEAD `fcf9a661`.

## Baseline essence (batch CL：行展开动画 — iris 独有)

**Spec**: `expandAnimation?: boolean` —— 详情/树形展开收起过渡（max-height/opacity transition，token；reduced-motion 关闭）；测试（属性存在/样式）。vxe-grid 无展开动画配置 → 无 parity 约束，纯 iris 独有增量。

**Design** — 一个 additive/fail-closed 布尔 prop + 纯 CSS 入场动画（复用现有 `iris-table-row-styles` 单例），两个属性注入点 + 一个模块级 helper，零 state/effect/handler/i18n/core/types/事件：

- **Prop** after `lazyLoad` in `props.ts` (:443，展开族) → manifest **171→172**（events 31 不变）。
- **机制** — `TABLE_ROW_CSS` 新增 `@keyframes iris-table-expand-enter`（max-height `0 → var(--iris-table-expand-max, 512px)` + opacity `0 → 1`，from/to 两端 `overflow: hidden`，动画结束回到基态——内容永不永久裁切）；规则 `[data-iris-expand-anim="true"] { animation: … var(--iris-duration-md, 200ms) ease-out; }`——时长用 motion 包四框架共用 token（fallback 先例），上限同为 token-with-fallback。
- **reduced-motion 关闭** — `@media (prefers-reduced-motion: reduce) { animation: none }`——纯 CSS 翻转（`floating/animations.ts` 先例），零新 hook。
- **两个注入点，共用派生 `expandAnimOn = expandAnimation === true && !virtualScroll`**：`renderBodyEntry` 详情包裹 (:7863) + `renderRow` 树行（`depth > 0` 才动画，根行不动）；helper `expandAnimAttr`（:127 `rangeFillTargetAttr` 先例）保持行箭头复杂度预算。
- **两个显式 fiat**：虚拟模式惰性（滚动挂载会重放动画并冲击热路径；`renderDetailSlot` 天然惰性）；收起瞬时卸载（真正收起过渡需保持挂载，与虚拟器均高槽模型 + flattenTree 数据驱动 bodyData 冲突——收起 affordance 沿用现有 caret 旋转）。

**Test plan** — spec 强制 属性存在/样式 显式映射：NEW `expand-animation.test.tsx` 8 例（T1 fail-closed 双查 / T2 detail 展开收起 / T3-T5 样式：keyframes + duration token + reduced-motion 块 / T6 树 depth 门 / T7 初始展开重放 / T8 虚拟惰性）→ react **2503→2511** · core 1559 不变 · manifest 171→172。

**File map** — `props.ts`(:443) · `Table.tsx`(destructure + expandAnimOn + helper + 两注入点) · `styles.ts`(TABLE_ROW_CSS :417 +3 规则) · NEW `expand-animation.test.tsx` · `pnpm gen:manifest` 重新生成 · gate 阶段 comparison doc 行。零改动：core / types.ts / i18n / solid·vue·svelte / 虚拟体 / TableBody。
