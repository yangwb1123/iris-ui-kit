# Iris UI Vue Table `groupCollapsed` Baseline

## Evidence Summary

- **React BH** (batch BH): Implemented `groupCollapsed?: Array<string | number>`, `defaultGroupCollapsed`, `onGroupCollapseChange` with single-column `groupBy?: boolean` on `IrisTableColumn`. Nested `groupBy?: string[]` (batch BS) is a separate future batch.
- **Solid IA** and **Svelte IB**: Have equivalent single-column row-grouping/collapse surfaces.
- **Vue**: Currently has grouped column headers via `children` on `IrisTableColumn`, but **no row grouping/collapse** surface.
- **Core i18n**: `table.groupCollapse` / `table.groupExpand` already exist in `/home/u1/iris-ui/packages/core/src/i18n-messages.ts`.
- **Existing Vue column `groupBy`**: Column-level `groupBy?: boolean` does **not** exist in Vue `IrisTableColumn` type (only in React). This baseline adds it only if needed for the single-column grouping path.
- **Architecture limit**: The Vue table already has a `grouped` computed that checks `displayColumns.value.some((c) => c.children && c.children.length > 0)` — this is for **column header groups** (multi-level headers), **not** row grouping/collapse. The new surface is orthogonal.

---

## Smallest Additive Vue Contract

### 1. Table-Level Props (add to `IrisTableProps`)

| Prop                    | Type                                      | Default | Description                                                                                                                    |
| ----------------------- | ----------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `groupCollapsed`        | `Array<string \| number>`                 | —       | **Controlled**: currently collapsed group keys. Keys are `String(getCellValue(row, groupColumn))`.                             |
| `defaultGroupCollapsed` | `Array<string \| number>`                 | —       | **Uncontrolled**: seeds once on mount from this default. After mount, only `onGroupCollapseChange` updates the internal state. |
| `onGroupCollapseChange` | `(next: Array<string \| number>) => void` | —       | Fires in **both** controlled and uncontrolled mode on every collapse/expand transition.                                        |

### 2. Column-Level Prop (add to `IrisTableColumn`, only if needed)

| Prop      | Type      | Default | Description                                                                                                                                                                                                  |
| --------- | --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `groupBy` | `boolean` | `false` | When `true`, this column drives the row-grouping surface. Only the **first** column with `groupBy: true` is used. Exactly one column should have `groupBy: true` for single-column grouping (batch BH path). |

> **Note**: The column-level `groupBy?: boolean` is added **only if needed** — i.e., if the table author wants to specify which column to group by without relying on prop-ordering conventions. If no column has `groupBy: true`, grouping is inert.

---

## Behavioral Contract

### Grouping Activation

| Condition                                                                                                           | Result                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| No column has `groupBy: true` **or** `groupCollapsed`/`defaultGroupCollapsed`/ `onGroupCollapseChange` not provided | Feature is **inert** — no grouping UI rendered, no collapse/expand behavior.                                                                       |
| Tree mode (`tree` or `lazyLoad` prop active)                                                                        | Feature is **inert** (fail-closed) — tree expansion/collapse takes precedence; grouping is not applied.                                            |
| A column has `groupBy: true` **and** table-level props provided                                                     | Grouping activates. Body rows are grouped by the distinct values of the `groupBy` column, in **first-seen order** within the filtered+sorted body. |

### Key Semantics

- **Keys**: `String(getCellValue(row, groupColumn))` — each distinct stringified cell value becomes a group key.
- **Controlled state never flips optimistically**: In controlled mode, the `groupCollapsed` prop is the single source of truth. The internal state is always derived from it.
- **Uncontrolled state seeds once**: On mount, if `groupCollapsed` is not provided, `defaultGroupCollapsed` is used to seed the internal collapse set **once**. Subsequent changes flow through `onGroupCollapseChange` only.
- **Stale keys are inert**: If a key in `groupCollapsed`/`defaultGroupCollapsed` no longer matches any group value, it is silently ignored — no error, no effect.
- **Callback fires in both modes**: `onGroupCollapseChange` fires with the new array of collapsed keys whenever the user expands or collapses a group, regardless of controlled/uncontrolled mode.

### Group Rendering

- **Group header row** per distinct value (first-appearance order), rendered with:
  - Group value label
  - Row count badge
  - Toggle button (`data-iris-group-toggle`) that expands/collapses the group
- **While collapsed**: Data rows of that group are hidden from the DOM. The group **header + count remain visible**.
- **Group summary row** (`data-iris-group-summary`): Appears when any column has a `summary` op; visible/independently of row collapse state.
- **Original body indices preserved**: The underlying data source is not reordered; only the rendered DOM reflects collapse state.
- **Full header counts preserved**: Column header structure (including any `children`/grouped headers) is unchanged.

### Preserved Semantics

| Feature                  | Status                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Selection                | Preserved — collapsed groups still participate in selection model.                                                      |
| Edit (cell/row mode)     | Preserved — editing infrastructure remains active.                                                                      |
| `seq` (sequence numbers) | Preserved — sequence is unaffected.                                                                                     |
| `formula` columns        | Preserved — formulas read from the original data source.                                                                |
| `summary` (footer)       | Preserved — footer computes over all rows, not just visible.                                                            |
| `virtual` scrolling      | Preserved — virtualization uses the full underlying data; collapsed rows are simply not rendered in the visible window. |
| Filtering / sorting      | Applied **before** grouping — grouping operates on the filtered+sorted body in first-seen order.                        |

---

## Implementation Path (non-spec, for reference)

The following describes the minimal changes needed to implement the above contract. **This baseline document does NOT modify any source files.**

### A. Type Definitions

1. **`/home/u1/iris-ui/packages/vue/src/primitives/table/types.ts`**: Add `groupBy?: boolean` to `IrisTableColumn<Row>` interface.

2. **`/home/u1/iris-ui/packages/vue/src/primitives/table/props.ts`**: Add three props to `tableProps`:
   - `groupCollapsed: { type: Array, default: undefined }`
   - `defaultGroupCollapsed: { type: Array, default: undefined }`
   - `onGroupCollapseChange: { type: Function, default: undefined }`

### B. Setup Logic (in `Table.ts` setup)

1. **Detect the group column**: `const groupColumn = computed(() => columns.find((c) => c.groupBy))`
2. **Derive collapse set** (controlled vs uncontrolled):
   - Controlled: `const collapsed = toRef(props, 'groupCollapsed')`
   - Uncontrolled: seed from `props.defaultGroupCollapsed` once on mount, then keep in sync via `onGroupCollapseChange`
3. **Group body rows**: Compute grouped rows using `getCellValue(row, groupColumnKey)` — first-seen order, preserving original indices.
4. **Group header rendering**: In `renderTableHeaderRow`, add toggle buttons for each group value with `aria-expanded` and `data-iris-group-toggle`.
5. **Body row filtering**: In `renderTableBodyContent`, conditionally render rows based on whether their group key is collapsed.
6. **Emit callback**: Call `props.onGroupCollapseChange(newCollapsedKeys)` on every toggle.

### C. SSR / Hydration Considerations

- **No module-level counters**: Use `useId` from the framework for any generated IDs (e.g., group toggle buttons). Do NOT use module-scoped `let i = 0` counters.
- **Hydration mismatch risk**: The collapse/expand state must be **identical** on client and server. Since the feature is inert without explicit props, default `groupCollapsed` to `[]` and `defaultGroupCollapsed` to `[]` on the server to avoid hydration mismatches.
- **Teleport**: Group headers rendered via Teleport (if any) must key off stable group values, not array indices, to avoid SSR/VNode mismatches.

### D. Test Coverage (identified focus areas)

| Area                       | Test Focus                                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client SSR                 | Render table with `groupBy` + `defaultGroupCollapsed` + `onGroupCollapseChange` on `node` environment; verify initial collapsed state matches `defaultGroupCollapsed`. |
| Node SSR                   | Same as client SSR but with `renderToString`; verify no SSR-specific warnings.                                                                                         |
| Vue VNode / Teleport       | Ensure group toggle buttons do not rely on Teleport for core functionality; if Teleport is used, key toggle elements by group value string, not index.                 |
| Hydration                  | Mount with `groupCollapsed` prop (controlled) and verify no "hydration mismatch" errors between server-rendered and client-toggled state.                              |
| Stale keys                 | Provide `groupCollapsed` with keys that no longer exist in the data; verify inert behavior (no errors, no state corruption).                                           |
| Tree mode inert            | Mount table with `tree` prop + `groupBy`; verify grouping is absent and tree expansion/collapse works independently.                                                   |
| Controlled vs uncontrolled | Test both modes: (a) controlled only via `groupCollapsed` + `onGroupCollapseChange`; (b) uncontrolled via `defaultGroupCollapsed` only.                                |

---

## Change Checklist (for maintainers)

- [ ] Add `groupBy?: boolean` to Vue `IrisTableColumn` type (only if the batch decides to include column-level grouping control).
- [ ] Add `groupCollapsed`, `defaultGroupCollapsed`, `onGroupCollapseChange` to Vue `tableProps`.
- [ ] Implement grouping logic in `Table.ts` setup: detect group column, derive collapse set, compute grouped body, render group headers/toggles.
- [ ] Group header rendering in `table-header-renderers.ts` / `table-header-row.ts` — add toggle button with `data-iris-group-toggle`, `aria-expanded`.
- [ ] Body row conditional rendering in `table-body-content.ts` — hide/show rows based on collapse state.
- [ ] `onGroupCollapseChange` callback wiring.
- [ ] SSR/hydration: default props to `[]` on server; use stable keys/IDs.
- [ ] Add Vue contract test scenarios (or adapt existing `tableExpandScenario`).
- [ ] Update manifest / llms.txt if type signatures change (run `pnpm gen:manifest`).
