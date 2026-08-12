Done. Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-ae-baseline.md` (405 lines, untracked — the only change; no source files touched).

## Key findings from the investigation

**Virtual tree — mostly already works.** The guard `virtualScroll && (!treeMode || !hasDetail)` (Table.tsx L4861) already permits tree×virtual, and `flatTree` (L2320) is exactly the visible-rows list — `bodyData = flatTree.map(t => t.row)` feeds `virtualItems` with `itemCount = flatTree.length`. Expansion changes flow through `expandedKeys → flatTree → items` for free; an existing unit test pins tree×virtual with tree decoration intact.

**itemCount mid-scroll is handled at 3 layers** (answering the "does it clamp?" question):

1. The virtualizer is recreated on `items.length` change (memo keyed `[items.length, buffer, variable]`, VirtualScroll.tsx L137)
2. `scrollTop` state survives and is re-pushed via `setScroll` → core clamps (`clampScroll` against `totalSize - viewportSize`, virtualizer.ts L275)
3. A dedicated re-clamp effect fixes `el.scrollTop` when the list shrinks past the viewport (L272-277)

**Residual gap found:** the re-clamp mutates the DOM but not the `scrollTop` state — the fixed-mode window derives from state, so a deep-scroll collapse can show a one-frame blank window until the browser's scroll event syncs state. No test covers this.

**Detail mode:** the real bug — flat+detail+virtual is _permitted_ by the guard but the virtual path renders `renderRow` only, so **expanded detail panels are silently dropped**; tree+detail is blocked entirely. The guard is byte-identical across all four frameworks (vue TableBody.ts L52, solid L2961, svelte L1002), so any fix must be four-framework.

**Design decisions documented:** detail rows occupy one slot each at `itemHeight` (content scrolls inside), plan gains `kind: 'detail'` entries with `::detail`-suffixed keys, guard drops the `hasDetail` exclusion. The react example actually has **5** sections (basic/edit/proxy/form + row-ops), so the mirror keeps all 5; vue/solid/svelte need page file + menu entry (order 8) + Shell/PageHost registration + one e2e file each (react already has 3 vxe tests in pages.spec.ts).
