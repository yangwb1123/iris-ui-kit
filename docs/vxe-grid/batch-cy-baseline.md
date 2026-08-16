Baseline written: **`/home/u1/iris-ui/docs/vxe-grid/batch-cy-baseline.md`** — zero source files touched (`git status` shows only the new baseline + pre-existing dirt `DECISIONS.md` M / `batch-cx-gate.md` ??; HEAD `6b496ae1` unchanged).

**Design (spec-faithful):** `responsive?: boolean` (props.ts, after `syncResize` — propCount 184→185, events 32 unchanged, default false byte-identical):

- **Narrow** = `0 < containerWidth < 480` (strictly below; 480 exactly = full width, test-locked), measured by a prop-gated ResizeObserver over the root (`clientWidth`, the column-virtualization `:7577` precedent; jsdom/SSR no-RO fail-closed).
- **Scroll hint** = root-sibling bar `data-iris-scroll-hint` (between root and pager — no sticky/overlay math), token-only styles, `⇆` + i18n `table.scrollHint` (en `Scroll horizontally for more columns` / zh `横向滚动查看更多列`, en+zh same batch). Renders only on **post-collapse overflow** (honest — a hint exactly when horizontal scrolling is possible); root gains `overflowX: 'auto'` at `:10418`; hidden in print and while zoomed.
- **Column collapse** = greedy tail-hide of top-level display columns (display order = lowest priority, `columnOrder` already honored upstream) until the natural width fits; **pinned survival** + **floor** (≥1 non-pinned unit). Slots into the free displayColumns→leafColumns gap (`:2889`) so header matrix, body, footer, virtualization, widths and export all agree for free. New core pure `computeResponsiveColumns` (`core/src/responsive.ts`).

**Key facts baked in:** width model reuses the existing `resolvedColumnWidth` chain (`:1636-1644`); group-hide scope mirrors visibleMethod's top-level precedent; `hasDetail` hoists one line (`:3523→:2785`) to feed the width sum (documented code motion).

**Test plan:** core +8 (1569→1577, pure fit math incl. 479/480/481 edges, pinned, floor) · react +14 (2660→2674, spec-mandated ① hint displays ② tail column hidden ③ ≥480 no-op, plus off-byte-identical, no-RO no-crash, widen-restore, pinned/floor/order/visibility/grouped/zoom edges).

**File map:** core +2 files +2 exports +1 i18n key · zh plugin +1 key · props.ts +1 · Table.tsx 8 touch points · new `test/responsive-narrow.test.tsx` · manifest regen · comparison doc +1. Zero changes: types.ts, styles.ts, vue/solid/svelte.
