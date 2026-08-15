Baseline complete. **`/home/u1/iris-ui/docs/vxe-grid/batch-bn-baseline.md`** (20 lines) — the only file created; `git status` confirms the pre-existing BM-stage `M` entries untouched, zero source files modified.

## What's in the baseline

**Exact design** (every anchor verified against current code — `renderRow`/`renderBodyEntry` signatures, `IrisVirtualScroll` call site :8206, PageUp/PageDown :4610–4614, batch AG variable-height virtual machinery):

- **Prop** — `rowHeight?: number | ((index: number) => number)` at props.ts after `virtualScroll` (:412), before `persistState`. Additive, unset = byte-identical current behavior.
- **One throat** — `rowHeight ?? virtualScroll.itemHeight`:
  - **固定形式** (number): virtual path → uniform slot height, closed-form fixed window (**覆盖默认 itemHeight**); non-virtual path → `extraStyle={{ height: N }}` on the row (cells stretch + flex-center via existing `BASE_CELL_STYLE`, zero cell changes).
  - **函数形式** (fn): virtual path → fed as `estimateSize` into the core virtualizer's **Fenwick offset tree — that IS the 前缀和** (O(log n) cumulative tops, spacer = total; batch AG machinery verbatim, **zero core changes**); non-virtual path → per-`bodyData`-index inline height.
  - **PageUp/PageDown reads the same resolved source** so ±10-row paging matches rendered rows.
- **Precedence fiat** — rowHeight wins when both set (single throat; additive, no existing caller sets it); `rowStyle.height` stays the per-row escape hatch (existing cascade).

**10 fiats** for gate arbitration (precedence, plan-index vs body-index fn contract — plan index in virtual per batch AG, body index non-virtual; data-row-only scope, group headers/detail wraps keep content height; size-preset override; no new data attr — inline height/transform/spacer directly assertable with existing test helpers; "前缀和" = core Fenwick tree; propCount 154→155).

**File map**: props.ts +1 · Table.tsx 3 touch points (renderBodyEntry extraStyle, IrisVirtualScroll itemHeight, PageUp/PageDown resolver) · NEW `row-height.test.tsx` · comparison doc 3 sites (iris-only row after :67, 构建状态 :282, test count :338) · manifest regenerated · zero: core/types/styles/i18n/vue/solid/svelte.

**Test plan**: ~14 cases, spec-mandated trio first — **固定** (non-virtual row `style.height`, virtual uniform window + `translateY(i*N)` + spacer) · **函数** (per-row `fn(i)`; virtual cumulative tops = prefix sums + spacer = Σ) · **虚拟组合** (fn + virtualScroll: window/buffer bounds, deep-scroll, detail-slot plan-index trap, rowHeight-wins, itemHeight fallback, PageUp/PageDown) — plus no-prop no-op and rowStyle escape hatch.
