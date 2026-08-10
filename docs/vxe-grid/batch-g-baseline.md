Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-g-baseline.md` (19.9 KB). No source files modified — the only change is the new doc (the `.vinxi` build artifacts were already dirty before this task).

**Baseline contents:**

1. **vxe semantics** — from `table.d.ts`: `TooltipConfig` (`mode: 'title'`, `showAll`, `contentMethod` with empty-content-drops-tooltip) and `CheckboxConfig` — with an explicit semantic clarification: the requested shift-click range is vxe's **`isShiftKey`** (drag-slide is `range`); we implement the shift-click variant, named `checkboxRange`.

2. **Proposed design (additive, react only):**
   - **a) 3 LOW fixes exactly as the review prescribes** — F1: `selectAll` unions `displaySelection ∪ page keys` instead of `selModel.set` replace; F2: `expandAllSeededRef` burns only when `keys.length > 0` so a later proxy page with parents still seeds; F3: expose `multiSortComparator` from `useTableSort` and use it for tree children in multi mode (single mode byte-identical).
   - **b) `tooltipConfig?: { showAll?, content? }`** — native `title` on body cells (no portal), content from callback or raw value, editing cells exempt; truncation gating explicitly documented as a simplification (always-on this batch, `showAll` kept for parity).
   - **c) `checkboxRange`** — anchor key in a ref, shift-click checks the range in `bodyData` order between anchor and target, respects `checkMethod`/skips disabled, unknown-anchor fallback degrades to single toggle, uncheck-direction flagged as an open question (proposed: mirror vxe's target-state).

3. **File map** — `useTableSort.ts`, `Table.tsx`, `types.ts`, `props.ts`, 2 new test files + 3 extended; no core/i18n changes.

4. **24-case test plan** with per-fix regressions, plus 5 open questions for the adapt phase.
