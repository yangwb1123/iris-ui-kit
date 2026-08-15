Baseline complete. Deliverable: **`/home/u1/iris-ui/docs/vxe-grid/batch-bh-baseline.md`** (194 lines) — the only file created (`git status` confirms the pre-existing BG-stage `M` entries untouched; zero source files modified).

## What's in the baseline

**Exact design** (every anchor verified against current code):

- **Props** — `groupCollapsed?: Array<string | number>` (controlled) + `defaultGroupCollapsed` + `onGroupCollapseChange` in props.ts after `keymap` (:399), mirroring the `selection`/`defaultSelection`/`onSelectionChange` controlled pattern (incl. the no-optimistic-flip semantics documented at Table.tsx :2074-2078). Group keys = `String(getCellValue(row, groupCol))`, consistent with `data-iris-group-key`.
- **State** — internal `useState<Set<string>>` seeded from `defaultGroupCollapsed`; `collapsedSet` memo derives from the prop when controlled; `toggleGroupCollapse` fires `onGroupCollapseChange` in **both** modes (lift-ready), placed right before the `groupPlan` memo (:3934).
- **Filtering at one choke point** — the `groupPlan` memo (:3935-3948) skips a collapsed group's rows **and** per-group summary; header + full count stay. Both render paths inherit automatically: non-virtual (:7707) and virtual (`virtualItems` returns `groupPlan` :6097, virtualizer re-clamps on count change). Skipped rows keep **original bodyData indices** → seq (:5343), row-ref, striped, span, checkMethod untouched.
- **DOM contract** — `renderGroupHeader` (:5783-5826) gains a native `<button type="button" data-iris-group-toggle aria-expanded>` (▸/▾, existing 8px token gap) and `data-iris-group-collapsed` on the row; group headers were already excluded from onRowClick/contextMenu/selection.
- **7 fiats** for gate arbitration: hidden = rows+summary, full count stays; true controlled semantics; callback in both modes; collapse never mutates selection/edit/index state (selection summary still counts hidden selected rows); stale keys inert; inert without groupBy / in tree mode; pure render layer (no onDataChange/undo/audit).

**File map**: 3 edits (core i18n +2 keys `table.groupCollapse/groupExpand` :106, props.ts, Table.tsx 3 sites) + optional types.ts doc touch + 1 new test file + manifest regeneration (propCount 149→152, eventCount 28→29). Untouched: data-view.ts (`groupRows`), TableRow/TableBody/styles, vue/solid/svelte (verified: no groupBy parity exists in those frameworks).

**Test plan**: 12 cases — initial expanded, collapse hides rows+summary, count kept, expand restores, uncontrolled default, controlled (no optimistic flip + write-back), selection coexistence (persist + summary count + select-all), edit coexistence (committed value persists, dirty dot), seq indices unchanged, virtual path, toggle never fires row events, stale/inert keys.
