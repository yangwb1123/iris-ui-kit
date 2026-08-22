Baseline complete. Wrote `/home/u1/iris-ui/docs/vxe-grid/batch-dp-baseline.md` (verification-style, 26 lines) — the only file I touched.

## 批 DP：表格滚动条增强（iris 独有）— 基线结论

**Feature 已在 HEAD `b2dc79b9` 完整提交**（于 `61ec5418` adapter 对齐提交内一并交付），逐行锚定：

**Exact design**（spec 逐项核对，全部满足）：

- `scrollbarThumb?: boolean` opt-in — `props/advanced.ts:198`，默认 false
- 根节点标记 — `Table.tsx:8070` `data-iris-scrollbar-thumb={scrollbarThumb ? 'true' : undefined}`（关态不输出）
- CSS overlay 简单版 — `table-css.ts:153-170`（运行时唯一注入源 `#iris-table-row-styles`）：
  - `::-webkit-scrollbar` 8×8px 细条 + Firefox `scrollbar-color: var(--iris-primary)`
  - thumb `background: var(--iris-primary)` + `border-radius: var(--iris-radius-sm, 4px)`（**圆角 ✓**）
  - **hover 规则存在**（结构就位）；覆盖根容器与 `[data-iris-virtual-scroll]` 虚拟滚动后代
  - 仅替换原生 thumb 视觉，原生滚动/键盘可达保留（"替代原生"落在观感层）
- 测试（样式属性）— `test/batch-dl-dt.test.tsx`：根属性存在 + 注入 CSS 断言圆角/8px 细条/`color-mix` hover 增强，及默认关态无属性负向断言

**实跑验证**：`vitest run batch-dl-dt.test.tsx` → **14/14 PASS**；核心/React 全量测试、typecheck、lint 0 errors、spec 扫描 0 violations、manifest 同步。

**File map**：prop 1 处（advanced.ts:198）+ 解构 1 处（Table.tsx:286）+ 标记 1 处（Table.tsx:8070）+ CSS 21 行（table-css.ts:152-174）+ 测试 2 个（batch-dl-dt.test.tsx:225-247）；零 core/其他适配层/i18n 变更。

**观察处置**：① hover 色增强已落实（rest 半透明 primary → hover 全量 primary，`color-mix` 纯 token）；② `styles.ts:295` 的 TABLE_ROW_CSS 孪生副本仅 density-toggle 排序测试消费，不触碰（避免扩漂移面）；③ 默认关态负向断言已补。
