Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-cs-baseline.md` (114 lines). No source files touched — `git status` shows only the new baseline plus the pre-existing prior-stage dirt (`DECISIONS.md`, `batch-cr-gate.md`), HEAD `9045a75c` unchanged.

**Key findings from the current IrisTable:**

- **Pixel scrollTop is already preserved in virtual mode** — `scrollTop` is local state in IrisVirtualScroll (VirtualScroll.tsx:78) surviving the virtualizer rebuild on `items.length` change (:137), re-pushed via `setScroll` and guarded by the DOM+state re-clamp effect (:282). Already pinned by `virtual-tree.test.tsx:125`.
- **The real gap the spec targets is the content anchor**: expanding/collapsing a node or detail panel **above** the viewport shifts every row below by the inserted/removed height — pixel scrollTop unchanged, but the rows being read jump. Non-virtual mode has no active preservation at all.
- **Zero new infrastructure needed**: IrisVirtualScroll's `onScroll` prop exists but is unused by Table (wire it to a ref); the slot-height throat `effectiveRowHeight ?? virtualScroll.itemHeight` (batch BN/AV) is the compensation unit; batch AV already proves the "write `el.scrollTop` → scroll event → child window follows" mechanism (:6186).

**Design** — `expandScrollPreserve?: boolean` (props.ts after `columnTotals`:459, propCount 178→179, fail-closed off): virtual mode records the viewport scrollTop + anchor row (first visible row, with partial-offset) on stable renders, and on the expansion transition (layout effect, after the child's re-clamp) re-locates the anchor key in the **new plan** and writes `newTop = planIndex × slotHeight + relativeTop` — exact index math, zero delta bookkeeping. Five explicit fiats: variable heights pixel-only (offset tree is child-internal), non-virtual inert, full-set restores fall back to clamp, single-key commits stay exact, lazy-load toggle happens post-fill.

**File map** — props.ts (1 line) · Table.tsx (5 touch points: destructure / derive + 3 refs / 2 module helpers / `onScroll` wiring / 1 layout effect) · NEW `test/expand-scroll-preserve.test.tsx` · comparison-doc row + `pnpm gen:manifest` regen (178→179, events 31 unchanged, core/other frameworks untouched).

**Test plan** — react +12 (2582→2594): fail-closed pin, tree expand above (+C×36) / below (zero) / collapse above (−C×36), detail +36, partial-anchor offset preserved, collapse-past-max clamp, handle path, anchor-removed fallback, variable fiat, non-virtual + flat-table inert.
