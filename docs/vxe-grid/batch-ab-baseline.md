# vxe-grid batch AB baseline — solid adapter parity (interaction round)

Status: baseline for the AB adapt stage. The adapt stage has since landed
(commit `8f40aaac`); this document is written against the CURRENT tree so
every "proposed" item carries an evidence-backed current-state annotation
(`✅ shipped` / `⏳ not yet — handed off`). Only this doc changed — no source
files touched.

Scope: 7 interaction features — `columnDrag`, `rowDrag`, `editConfig.mode`
('cell' | 'row'), `contextMenu`, `filterValues` (+ `onFilterValuesChange`),
`lazyLoad` (conditional), `tableRef` handle.

Verdict: **6/7 shipped** in batch AB. `lazyLoad` is **in scope** (solid has
tree support via `getSubRows`) but was **handed off to the next batch** —
full design below so it can be picked up without re-reading react.

---

## 1. Current solid state (evidence)

### 1.1 Edit machinery — editRules from batch 1, bespoke (not core createCellEdit)

- Batch 1 (`b49bf5c6`) mirrored `editRules` + `editConfig` across the four
  frameworks: core `edit-rules.ts` (EditRule engine — required/min/max/type/
  pattern/validator, sync + async + `collectAll`), core `cell-edit.ts`
  (async validate), column `editRules` + `editConfig` (trigger click/dblclick
  - showAsterisk) + click-triggered editing.
- **The solid adapter does NOT bridge core `createCellEdit`** (react does,
  one session per cell via the core controller). Solid cell mode is bespoke:
  signals `editingCellId` / `editingDraft` / `editError` +
  `cellEditGen` (monotonic epoch — an in-flight async `editRules` commit
  detects it was cancelled/superseded while pending and does NOT write back).
  Commit path: `editRules` (async) → `column.validate` (sync) → `finishCommit`
  → `onCellEdit` + proxy-mode page-copy write-back.
- Row mode (batch AB) extends the same bespoke machinery: one
  `RowCellSession` per editable column (`{ col, rowIndex, draft, error,
setDraft, setError, gen }` — own signals, own epoch), held in a signal
  `Map<string, RowCellSession>` keyed `` `${rowIdent}::${col.key}` `` so the
  cell render reacts; wholesale drop on cancel.
- Gaps (documented, react-parity): `editConfig.showAsterisk` is NOT rendered
  in solid (react has it at Table.tsx L4768); trigger `'manual'` is unwired in
  BOTH adapters (click/dblclick only); `autoClear` not wired anywhere.
- `editConfig` type (`types.ts`): `{ trigger?: 'click'|'dblclick'|'manual',
showAsterisk?, autoClear?, mode?: 'cell'|'row' }` — `mode` shipped ✅.

### 1.2 Header/body render (explicit CSS-grid tracks)

- `gridTemplate` memo (IrisTable.tsx L1617): `rowDrag 40px` + `seq 60px` +
  `expand 40px` + `selection 40px` + leaf widths — every render path (flat
  header, grouped header, body row, summary) uses the SAME track string, so
  lead tracks align in every combination including `columnVirtualization`.
- `colTrack(i)` (L1646): 1-based grid track for a windowed column after the
  lead tracks — the batch-AA 6-site pattern: `gridTemplate`, `colTrack`,
  flat header, grouped header, `renderRow`, summary.
- Header: flat single-row header (`data-iris-table-header-row`) and grouped
  `headerMatrix` (multi-row grid with colStart/colSpan/rowSpan). Every LEAF
  header carries `data-iris-table-header={col.key}` — that attribute is also
  the column-drag drop-target selector. Sort indicator, filter trigger
  (leaf-only), resize handle per leaf.
- Body: `renderRow(row, index, treeMeta)` is the single source of truth
  (flat / tree / virtual all route through it). `data-iris-table-row=""` stays
  an EMPTY attr; the row-drag id rides on the handle cell's
  `data-iris-row-drag-handle` (vue batch-Y style). spanMethod uses the
  `spanOccupy` set at render time.
- Summary row (`data-iris-table-row="summary"`) renders lead placeholders for
  drag/seq/selection so the tracks stay aligned.

### 1.3 Tree support — YES (getSubRows); lazyLoad — NO

- Tree mode is opt-in via `getSubRows` (IrisTable.tsx L904): `flattenTree`
  from core with `getKey = String(rowId(r, 0))`, `withSortedChildren` under an
  active sort (single or multi comparator), shared `createExpansion` model
  (detail mode and tree mode are mutually exclusive), `bodyEntries`/`bodyRows`
  memos, `treeMode()` memo. Virtual scroll windows flat AND tree rows
  (uniform height; only `renderDetail` bars it).
- **`lazyLoad` is absent** — react has it (batch J):
  `lazyLoad?: (row, load: (children: Row[]) => void) => void`. Per the task
  condition (solid HAS tree/getSubRows), lazyLoad is IN SCOPE — design in §2f,
  currently ⏳ handed off.

### 1.4 Solid floating module

- `packages/solid/src/floating/useFloating.ts` — the module the table uses
  (the prompt's `packages/svelte/src/floating/useFloating.ts` path holds the
  SVELTE port, `useFloating.svelte.ts`; both exist, solid's is the relevant
  one). Accessor API: `anchor`/`floating`/`open` are `Accessor`s; effect
  subscribes `autoUpdate` while `open()` is true and both elements exist;
  monotonic `epoch` token drops stale `computePosition` results after
  close/unmount; `positioned` flag keeps the panel `visibility: hidden` until
  the first cycle lands (no flash at 0,0); returns `floatingStyles`,
  `finalPlacement`, `arrowX/Y/Side`. flip/shift/offset/size/arrow middleware.
- `packages/solid/src/floating/useDismiss.ts` — Escape + outside pointer-down
  (capture phase), `exclude` accessor list, SSR-safe, detaches on disable.
- `Portal` from `solid-js/web` = react `createPortal` parity for body-escaped
  menus (the table's `overflow:hidden` never clips them).
- Both floating tests exist (`useFloating.test.tsx`).

### 1.5 core `createSortable` (`packages/core/src/sortable.ts`)

- `createSortable()` → `SortableController`: `press(id,x,y)` records a PENDING
  press OUTSIDE the store (a tap causes NO subscriber notification /
  re-render); `tryStart(x,y,threshold=4)` promotes to an active drag on
  threshold exceed and returns `true` EXACTLY ONCE (the binding collects
  drop-target rects at that moment); `moveOver(point, targets)` runs the pure
  `closestCenter` (squared distance, earliest tiebreak) and stores `overId`;
  `end()` returns `{ activeId, overId }` then resets; `cancel()`;
  `isPending/isActive/isOver`; state in a core `createStore` instance → solid
  bridges with `useStore` (sync initial value, SSR-safe — the same bridge
  pattern as selection/expansion/cell-range/proxy).

### 1.6 React reference semantics (batches H/I/J/K)

- **rowDrag/columnDrag**: one `createSortable` controller + container-level
  pointer handling on `rootRef`; rects collected ONCE on first threshold pass
  via `querySelectorAll('[data-iris-table-row]')` / `'[data-iris-table-header]'`
  then reused; `end()` → splice reorder of `bodyData`/`leafColumns` →
  `onReorder` only (react has no local-rows write-back). Row handle seeds the
  press.
- **Row edit mode** (batch K): per-column `createCellEdit` sessions in a state
  Map; Enter/blur commits THAT column; **Escape cancels the whole row**; row
  switch commits open editors first (a SYNC validation failure keeps the row
  open with the error visible; async commits land in background); per-cell
  commit closes just that editor (session idle callback) and `rowSessions.size
=== 0` derives row-leaves-edit-mode; Tab moves with the same per-column
  commit; `rowFocus` token focuses the target editor.
- **contextMenu** (batch H): virtual anchor — a fake element whose
  `getBoundingClientRect()` returns the zero-size cursor rect, rebuilt per
  open; `useFloating` with `flip: false, shift: false` (cursor-anchored, vxe
  parity); Esc / outside pointer-down (useDismiss) / any scroll (capture-phase
  document listener — nested scrollers count); portal to body; disabled items
  inert; header excluded (handler only on body leaf cells). React needs a
  `contextMenuSeq` remount token because autoUpdate does not re-run while
  `open` stays true on re-open.
- **FilterPanel** (batch I): anchor is the REAL trigger button (a DOM node,
  captured at click; `stopPropagation` so it never sorts); draft checkbox
  state re-seeds from applied `filterValues` per open (react: seq remount);
  `确认` writes the draft via `onApply`, `清除` applies an empty set
  immediately, dismissal discards; OR-match in the `filteredData` memo
  (`values.includes(String(raw))`, AND-ed with the text channel);
  remote mode comma-joins the checked sets into the query `filters`.
- **lazyLoad** (batch J): `lazyChildrenRef` Map (wins over `getSubRows`) +
  `lazyLoading` state Set (drives the caret spinner) + `lazyEpochRef` epoch
  bumped on data-source change (a stale fetch's result is dropped so a cleared
  cache is never re-seeded; loading flag NOT cleared by stale results);
  `treeKeyMap` gives rowId-aware keys; `getChildren = withSortedChildren(...)`
  so lazy children participate in sorting; throwing loads stay retryable.
- **tableRef**: react rebuilds the handle per render and copies it to the ref
  once on mount (mount-time closures + per-render ref mirrors for staleness).
  Solid's equivalent is FREE: props are getters and the proxy controller is
  captured by reference, so the mount-time handle always reads the latest
  state — no stale snapshot possible (documented in the handle type).

---

## 2. Proposed solid design (framework-idiomatic — signals, thin bridge over core)

### a) `columnDrag?: { onReorder(columns) }` — ✅ shipped

- Header leaf pointer handlers: `onPointerDown` seeds `colDragCtrl.press(colKey,
clientX, clientY)` (left button only, `preventDefault` + `stopPropagation`);
  container `onPointerMove` → `tryStart` on threshold (collect rects once from
  `[data-iris-table-header]`), then `moveOver`; container `onPointerUp` →
  `end()` → splice `leafColumns()` → `onReorder`.
- **Grouped header untouched**: `onPointerDown` is wired only when
  `isLeaf()` (group cells render no drag handler; their spans stay intact).
  Active/over styling via `data-iris-col-drag-active/over`.
- Solid-idiomatic: one controller per component instance (plain closure), state
  bridged with `useStore`; rects array mutated in place (no signal churn).

### b) `rowDrag?: { onReorder(rows) }` — ✅ shipped

- Leading 40px handle cell per row (`data-iris-row-drag-handle={rowId}`)
  seeds the press; container-level `onPointerMove/Up/Leave` on the root div;
  threshold → collect rects once from the HANDLE cells (not
  `data-iris-table-row`, whose empty attr is untouched) → `closestCenter` →
  `end()` reorders `bodyRows()` (the flattened visible list — works in tree
  and virtual modes) → **local rows signal** (`setLocalRows(rows)`) + BOTH
  `onDataChange` and `rowDrag.onReorder` (vue batch-Y parity; react only fires
  `onReorder`).
- Local-override lifecycle: a NEW `data` prop reference clears the override
  (prop wins again); a landed proxy page result also clears it (batch AB fix —
  a pager page change must never leave stale reordered rows on screen).
- Drag track in all 5 grid sites (gridTemplate/colTrack/flat header/grouped
  header/renderRow/summary).

### c) `editConfig.mode?: 'cell' | 'row'` — ✅ shipped (row mode)

- `'cell'` (default): byte-identical bespoke singleton edit as before
  (`editingCellId`/`editingDraft`/`editError` + `cellEditGen` epoch for async
  `editRules` cancellation).
- `'row'`: click on any cell of a row with editable columns opens EVERY
  editable column's editor — one `RowCellSession` per column (own draft/error
  signals + own `gen` epoch); **Escape cancels the whole row** (bumps every
  session gen so pending async commits never write back); **row switch
  commits** open editors first (sync failure keeps the row open with the error
  visible; async commits land per-cell in background); per-cell commit closes
  just that column (Enter/blur); all-committed (`rowSessions().size === 0`)
  derives row-leaves-edit-mode; Tab moves; click on a committed column of the
  SAME row reopens just that column; dblclick re-begins the whole row;
  `data-iris-row-editing` highlight. rowMode wins over cellRange on click
  (rowMode-first).
- Validation order matches cell mode: `editRules` (async, core
  `validateEditRulesAsync`) → `column.validate` (sync) → write-back
  (`onCellEdit` + proxy page-copy).

### d) `contextMenu?: { items(params), onSelect(key, params) }` — ✅ shipped

- `onContextMenu` on body LEAF cells only (header/seq/drag/expand/summary
  cells never open it — header exclusion covered by a dedicated test).
- Virtual anchor: fresh zero-size cursor-rect object per open (captures that
  event's coordinates) → solid `useFloating`'s effect re-runs on the new
  anchor identity — **no react-style remount seq token needed**.
- `TableContextMenu` module component (portal to body): `flip: false,
shift: false` (cursor-anchored), Esc + outside pointer-down (useDismiss) +
  capture-phase document scroll listener close; disabled items inert
  (`aria-disabled`); item click → `onSelect(key, params)` then close.
- i18n keys already exist in core (`table.filter/filterConfirm/filterClear`).

### e) `filterValues?: Record<string, string[]> + onFilterValuesChange?` — ✅ shipped

- Column opts in via `filterable` + `filterOptions`; leaf headers render a
  `⏷` icon trigger (`data-iris-filter-trigger`, stopPropagation so it never
  sorts; `--iris-primary` when active).
- `TableFilterPanel` module component: real-button anchor (`bottom-start`),
  checkbox draft, `确认` (`data-iris-filter-confirm`) → `onApply`, `清除`
  (`data-iris-filter-clear`) → empty set immediately; Esc/outside/scroll
  close; portal to body. Parent renders it in a KEYED `<Show>` on the state
  object identity, so each open REMOUNTS the panel and the draft re-seeds
  from the applied `filterValues` (react parity via seq token).
- Filtering: `filteredData` memo OR-matches `values.includes(String(raw))`
  per non-empty set, AND-ed with the text channel (`filters`/form merged);
  reference-preserving when nothing is active.
- Remote: `mergeFilterValues` folds non-empty sets into the proxy query
  `filters` as **comma-joined strings** (vxe filter-multiple serialization
  parity) — in initial params, form submit/reset, and the remoteFilter
  sync effect.

### f) `lazyLoad?: (row, load) => void` — ⏳ in scope, NOT yet shipped

Solid HAS tree support (`getSubRows` + `flattenTree`), so per the batch
condition lazyLoad is in scope. React batch-J design to port:

- `lazyChildrenRef`-style Map keyed by row id (wins over `getSubRows` in
  `getChildren`) + a **reactive loading set** (drives the caret spinner on
  both transitions) + a monotonic **epoch** bumped whenever the data-source
  reference changes (a stale fetch's result must never re-seed a cleared
  cache, and must not clear a newer fetch's loading flag).
- A row with no `getSubRows` children and no cached children still renders a
  caret; first expand calls `lazyLoad(row, (children) => ...)` — success
  caches, expands (firing the tree-expand channel), clears loading; a
  throwing load stays retryable (key not cached).
- Solid notes: the cache Map can live in a plain closure (like `rowRects`),
  the loading set must be a signal; the epoch is a plain number (solid has no
  re-render staleness, but the async callback closure still needs the guard).
- Handed off per the AB adapt report (handoff item 2).

### g) `tableRef?: { current: IrisTableHandle | null }` — ✅ shipped

- Handle exposes exactly the 6 requested methods (proxy + resets):
  `loadData` (local rows + `onDataChange`, no query; proxy total/page
  unchanged until next query), `reloadData` (clear override + refetch, proxy
  only), `commitProxy` (core `setParams`), `getProxyInfo` (page/pageSize/
  total, null without proxy), `clearSort` (multi → `[]`, single → `null`),
  `clearFilter` (BOTH channels via the change handlers — controlled semantics;
  without handlers the parent map stays untouched, documented).
- Assigned `onMount`; mount-time closures read the LATEST state because solid
  props are getters and the proxy controller is captured by reference.
- Note: react's handle additionally carries row ops (`insertRow/removeRow/...`)
  and view ops (`getFilteredData/scrollToRow/...`) from other batches — solid's
  handle is intentionally scoped to the batch-AB surface (react parity for the
  shared methods, additive growth in later batches).

---

## 3. File map

| File                                                             | Change                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/solid/src/primitives/table/props.ts`                   | +`rowDrag`/`columnDrag`/`editConfig`/`contextMenu`/`filterValues`/`onFilterValuesChange`/`tableRef`/`onDataChange`                                                                                                                                                                                                                                                                                                              |
| `packages/solid/src/primitives/table/types.ts`                   | +`IrisTableEditConfig` (mode), `IrisTableFilterValues`/`IrisTableFilterOption`, `IrisTableContextMenuItem`/`IrisTableContextMenuParams`, `IrisTableHandle` (6 methods); column `filterable`/`filterOptions`; `editRules` (batch 1)                                                                                                                                                                                              |
| `packages/solid/src/primitives/table/IrisTable.tsx`              | `mergeFilterValues` helper; module-level `TableContextMenu` + `TableFilterPanel` (useFloating/useDismiss/Portal); `RowCellSession` + row-mode sessions/handlers; rowDrag/columnDrag controllers + container handlers; context-menu state + virtual anchor; filter trigger; `tableHandle` + `onMount` assignment; drag track in gridTemplate/colTrack/flat+grouped header/renderRow/summary; proxy/local-rows override lifecycle |
| `packages/solid/src/primitives/table/index.ts`                   | +6 type exports                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `packages/manifest/manifest.json` + `llms.txt`                   | regenerated (`gen:manifest`, 155 components, 4×155 aligned)                                                                                                                                                                                                                                                                                                                                                                     |
| `packages/solid/src/primitives/table/parity-ab.test.tsx`         | NEW — 13 tests                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `packages/solid/src/primitives/table/parity-ab-rowedit.test.tsx` | NEW — 8 tests                                                                                                                                                                                                                                                                                                                                                                                                                   |

No core/react/vue/svelte changes (additive solid-only batch).

## 4. Tests

`parity-ab.test.tsx` (13, mirrors react context-menu/filter-panel + vue
batch-Y drag shapes):

- rowDrag: reorder through the handle reporting `onDataChange` + `onReorder`;
  a tap without movement cancels (no reorder).
- columnDrag: reorder on drop; a tap without movement does not.
- context menu: opens at the cursor on body-cell right-click; item click fires
  `onSelect` + closes; Escape closes; disabled item inert; header right-click
  does NOT open.
- filter panel: trigger opens WITHOUT sorting; check + 确认 filters rows
  (OR-match); second open pre-checks from applied values; 清除 removes
  immediately; remoteFilter comma-joins into the query.
- tableRef: `loadData` replaces rows without a query; `reloadData` re-queries;
  `commitProxy`/`getProxyInfo`; `clearSort` resets single channel;
  `clearFilter` resets both channels; `loadData` fires `onDataChange` and a
  controlled `data` re-feed wins again; a pager page change replaces loadData
  rows (no stale page-1 override).

`parity-ab-rowedit.test.tsx` (8, mirrors react batch-K row-edit-mode):

- click opens every editable column; Enter commits only that column; Escape
  cancels the row; row switch commits.
- sync validation failure keeps the row open with the error visible.
- Escape cancels a row whose async commit is pending WITHOUT writing it back.
- double-Enter on an async-validated column commits exactly once.
- cell mode: Escape during a pending async commit does not write back.
- dblclick on an editing row re-begins the whole row.
- cellRange + row mode both configured: click starts row editing (rowMode
  first).

Suite: solid typecheck ✓, 953 unit + 34 SSR tests ✓, lint 0 ✓, prettier ✓,
`iris-ui-spec.py --mode all` 0 violations, solid build ✓.

## 5. Open questions / handoff (for the next batch)

1. **lazyLoad** — design in §2f; needs the epoch fix + reactive loading set
   and a caret-spinner test mirroring react's lazy-tree shapes.
2. `editConfig.showAsterisk` — declared in types, NOT rendered (react has it);
   either implement or drop from the type.
3. `trigger: 'manual'` — unwired in BOTH adapters; confirm vxe manual-trigger
   semantics (vxe activates via grid methods) before adding.
4. `layouts.pager` positioning + `layouts.form/toolbar` hidden — react has
   them; solid parity deferred (handoff item 1).
5. rowDrag × tree: reorder operates on the FLATTENED visible rows (children
   move with their parents) — matches react; document as intended if
   challenged.
6. `editor: 'select'` row-mode editors — row sessions currently text/number
   (cell mode shares the same simplification); vxe `editor` supports select.
7. Handle scope: solid exposes the 6 proxy/reset methods; react's handle also
   has row/view ops — additive growth should be budgeted per batch (file
   budget: IrisTable.tsx is ~3122 lines).
