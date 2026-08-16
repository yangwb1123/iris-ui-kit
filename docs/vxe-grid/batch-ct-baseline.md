Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-ct-baseline.md` (122 lines). No source files touched — `git status` shows only the new baseline plus the pre-existing prior-stage dirt (`DECISIONS.md`, `batch-cs-gate.md`), HEAD `500b3d42` unchanged.

**Key findings from the current IrisTable:**

- **The named-view machinery (batch AH) is complete and directly reusable** — `views` prop → `useTableViews` coordinator → toolbar select (`TableViews.tsx`); snapshots captured by the shared collector (`persistSnapshot` Table.tsx:3420) and replayed via `applyViewSnapshot` (:3550) through per-piece callbacks + type guards. `selectView(key)` already has a fail-inert guard (missing view → no-op), so routing tab clicks through it gives "inert without `views` config" for free (batch BB fail-safe precedent).
- **`views` is already inside the toolbar gate** (Table.tsx:8833), so tabs + views always pull the toolbar out (the select has a home). The toolbar owns the top card radius (:8847) — the tabs bar must take it over via a fail-closed conditional, leaving the no-tabs path byte-identical.
- **Zero collision**: no `tableTabs` reference anywhere in the monorepo. Zero new i18n keys (labels are data, not copy); core/other frameworks untouched.

**Design** — `tableTabs?: IrisTableTab[]` (`{ key, label, views?: string[] }`, types.ts + props.ts after `onActiveViewChange`:570, propCount 179→180, fail-closed off): a `role=tablist` strip (`data-iris-table-tabs`) rendered ABOVE the toolbar, independent of the toolbar gate; clicking applies each name in `views` **in order** through `selectView` (unknown names skipped, later views win on overlapping pieces, the toolbar select mirrors the last applied view); active tab is internal state, nothing active until first click. 9 fail-closed rules tabled (dup keys keep first, empty `views` tab renders but applies nothing, no-`views` clicks inert, etc.).

**File map** — types.ts (+1 interface) · props.ts (1 line) · Table.tsx (4 touch points: destructure / activeTab state + apply callback / tabs-bar render before the toolbar gate / toolbar radius conditional) · NEW `table-tabs.test.tsx` · manifest regen (179→180, events 31 unchanged, core/i18n/other frameworks untouched).

**Test plan** — react +10 (2594→2604): render, fail-closed zero-DOM pin, single-view apply + select mirror, multi-view order (later wins), unknown-name fail-inert, empty-views tab, no-`views` inert, active switching, duplicate-key drop, radius coordination + `toolbar:'hidden'` combo.
