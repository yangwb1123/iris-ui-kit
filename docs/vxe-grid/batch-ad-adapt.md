# vxe-grid batch AD — solid adapter parity (interaction round follow-up)

Status: the batch-AB interaction surface (columnDrag/rowDrag, row edit mode,
contextMenu, filterValues, tableRef) landed in `8f40aaac`; this batch closes
the two outstanding in-scope items — the **handed-off `lazyLoad` tree
feature** (baseline §2f, react batch-J design) and the **row-mode session
liveness guard** (review hardening) — plus the required `parity-ad` test
file and gates. Solid-only; core/react/vue/svelte untouched.

## Report

### Files changed (source, exactly 4) + tests

| File                                                     | Change                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `packages/solid/src/primitives/table/types.ts`           | +1 named exported type `IrisTableLazyLoad<Row>` (named function type, manifest-scanner friendly) |
| `packages/solid/src/primitives/table/props.ts`           | +`lazyLoad?: IrisTableLazyLoad<Row>` (single-line function prop)                                 |
| `packages/solid/src/primitives/table/index.ts`           | re-exports `IrisTableLazyLoad`                                                                   |
| `packages/solid/src/primitives/table/IrisTable.tsx`      | lazyLoad machinery + row-mode session liveness guard (+~130 net; additive)                       |
| `packages/solid/src/primitives/table/parity-ad.test.tsx` | **new — 486 lines, 15 tests** (≤500 ✓)                                                           |

Plus required artifacts: regenerated `packages/manifest/manifest.json` +
`llms.txt` (155 components, 4×155 aligned; solid contract gains
`lazyLoad?` + `IrisTableLazyLoad`), `docs/vxe-grid/batch-ad-adapt.md`
(evidence).

### 1. lazyLoad (vxe lazyLoad parity, react batch-J port) — NEW

- `treeMode()` now true with `lazyLoad` alone (role `treegrid`, virtual-scroll
  windowing, tree indent all light up without `getSubRows`).
- Loaded children live in a **plain closure Map** (keyed by `rowId`, wins over
  `getSubRows` via `lazyChildrenOf`); the **loading set is a signal** (drives
  the caret spinner on both transitions); a **monotonic epoch** bumps when the
  data source reference changes (cache + loading cleared wholesale) so a stale
  fetch's result never re-seeds a cleared cache and never clears a newer
  fetch's loading flag (react batch-K M2 parity).
- `flatTree` re-walks when `lazyLoading()` changes (react's
  lazyLoading-in-deps parity — the cache map is not reactive); lazy children
  still participate in hierarchical sorting (`withSortedChildren`).
- A row with no children and nothing cached renders a lazy caret
  (`data-iris-table-tree-toggle`, `aria-expanded="false"`); first expand calls
  `lazyLoad(row, load)` — success caches + expands (firing the tree-expand
  channel via `expansion.toggle`) + clears loading; resolving with `[]` drops
  the caret (plain leaf); a **throwing load stays retryable** (key not
  cached); a stale resolution is dropped without touching the loading flag.
- Caret spinner: `data-iris-tree-loading` attr + token-driven
  `iris-table-caret-spin` keyframes in the injected singleton stylesheet
  (`#iris-table-row-styles`; `--iris-*` only — spec gate clean).
- Resolved children are themselves uncached lazy leaves (caret parity with
  react) — covered by test.

### 2. Row-mode session liveness guard (review hardening)

`commitRowSession` now returns early when the session is no longer in the
session Map. The editor's `onBlur` can fire **after** the session left the map
(input unmount on close/cancel — Escape-then-blur, Enter-then-blur in real
browsers), which would otherwise start a FRESH commit on the stale session
object (double `onCellEdit` / write-back after Escape). jsdom does not fire
blur on removal, so the guard is defensive browser hardening; the
supersede-epoch path it protects is regression-tested via
Enter-then-blur-on-mounted-input (exactly one commit).

### Tests added (15, one new file)

- **lazyLoad (5)**: caret + first-expand loads/expands + cache reuse (no
  second call) · pending spinner + resolve-`[]` drops the caret · throwing
  load stays retryable · data-source change drops stale in-flight result
  (epoch) then fresh row loads · lazily loaded key wins over `getSubRows`
  while other rows keep `getSubRows` children.
- **rowDrag/columnDrag (2)**: reorder through the handle reporting
  `onReorder` + `onDataChange`; tap cancels · column reorder on drop; tap
  does not.
- **row edit mode (2)**: click opens every editable column; Escape cancels
  the whole row without committing · Enter-then-blur on an async-validated
  column commits exactly once (epoch supersede), other column stays open.
- **contextMenu (2)**: opens at the cursor (portaled, translate3d at
  clientX/Y); item click fires `onSelect` + closes · Escape closes; header
  right-click never opens.
- **filter panel (2)**: check + confirm OR-match; checking the second option
  widens; clear removes immediately · remoteFilter comma-joins the checked
  sets into the query `filters`.
- **tableRef (2)**: `loadData` no query + `onDataChange` + `reloadData`
  re-queries + `getProxyInfo` · `clearSort` resets the sort channel +
  `clearFilter` resets both filter channels.

### Verification (all green)

- `pnpm --filter @iris-ui-kit/solid typecheck` — **0 errors**
- `pnpm --filter @iris-ui-kit/solid test` — **128 files / 974 tests + 34
  hydration** pass (15 new parity-ad)
- `pnpm --filter @iris-ui-kit/solid lint` — **0 errors**
- `pnpm --filter @iris-ui-kit/solid build` ✓ · prettier ✓ ·
  `@iris-ui-kit/manifest` tests 69 ✓
- `iris-ui-spec.py --mode all --json` — **0 violations**
- `pnpm gen:manifest` — 155 components, 4×155 aligned; solid contract
  extracts `lazyLoad?` + `IrisTableLazyLoad` cleanly

### Handoff list (next batch)

1. **svelte interaction round** — svelte still lacks filterValues/filter
   panel, contextMenu, rowDrag/columnDrag, editConfig row mode, lazyLoad,
   tableRef (the AC baseline handoff items 1–2); react/solid now define the
   reference semantics for all of them.
2. `editConfig.showAsterisk` — declared in types but not rendered in any
   adapter (react's handling is a style-only no-op); confirm vxe semantics or
   drop from the type.
3. `trigger: 'manual'` — unwired in both adapters; needs vxe manual-trigger
   semantics (grid methods) before adding.
4. `editor: 'select'` row-mode editors — row sessions (and cell mode) are
   text/number only.
5. Handle scope — solid exposes the 6 proxy/reset methods; react also has
   row/view ops (additive growth per batch; IrisTable.tsx is ~3250 lines).
