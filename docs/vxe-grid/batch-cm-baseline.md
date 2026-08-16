Baseline complete — written to `/home/u1/iris-ui/docs/vxe-grid/batch-cm-baseline.md` (115 lines). Zero source files modified; `git status` shows only the new baseline plus pre-existing prior-stage dirt (`DECISIONS.md`, `batch-cl-gate.md`), HEAD `0826c69d`.

## Baseline essence — 列合计行增强（iris 独有）

**Spec**: `summaryRowStyle?: 'default' | 'sticky'` —— 全局列合计行 `position: sticky; bottom: 0` 吸附视口底缘；测试（sticky 属性存在/样式）。vxe-grid 无此 parity → 纯 iris 独有增量。

**Design** — additive/fail-closed，零 state/effect/handler/i18n/core/types/events：

- **Prop** after `footerAlign` in `props.ts` (:153 区, footer 家族) → manifest props **172→173**（events 31 不变）。
- **判别**：`renderSummaryRow` 行 div (:7999) 加 `data-iris-summary-sticky={summaryStickyAttr(summaryRowStyle === 'sticky' && groupKey === undefined)}` —— `groupKey === undefined` 精确区分全局/组汇总（组汇总行也是 root 直接子节点，DOM 位置无法区分）；`renderFooterStack` 的 footerMethod 替换行 (:8204) 同加（占据同一汇总槽位），**footerData 与组汇总行不加**。
- **CSS**：Table.tsx 本地单例 `TABLE_ROW_CSS` (:420, header 粘性规则后) +1 规则 `[data-iris-table-fixed-height] [data-iris-summary-sticky="true"] { position: sticky; bottom: 0; z-index: 1; }` —— 与 header (z 2) / 钉列 (z 1) 层级同构；行已有不透明 `var(--iris-surface)` 背景 + 2px 顶边，**零 inline style 改动**；钉列双轴 sticky 共存（header 钉列先例）。
- **两个显式 fiat**：组汇总行不粘（多组互相争夺底缘）、footerData 不粘（契约上渲染于汇总之下）。
- 虚拟滚动下全局汇总行在 `IrisVirtualScroll` 之外，天然不受影响。

**File map**：`props.ts`（+prop）· `Table.tsx`（destructure + helper + 两注入点 + 单例 CSS）· NEW `summary-sticky.test.tsx` · `pnpm gen:manifest` · adapt/gate comparison doc 行。

**Test plan**（8 例，镜像 `height-align-footermethod.test.tsx` 的 `root()`/`styleSheet()` helper）：T1 默认 fail-closed 双查 / T2 显式 default / T3 sticky 属性+聚合不变 / T4 样式（选择器 + sticky + bottom: 0）/ T5 footerMethod 槽位、footerData 排除 / T6 组汇总排除 / T7 虚拟滚动保留 / T8 非法值 fail-closed。react 测试 +8（primitives 2187→2195），`pnpm --filter @iris-ui-kit/react test summary-sticky` + `make ci` 验证。
