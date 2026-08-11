Batch U complete — all items implemented and verified (final batch).

## Summary

**Implemented (all three work items, react-only, additive):**

1. **zoomConfig** (`props.ts` + `Table.tsx` + `Table.tsx` TABLE_ROW_CSS + 2 i18n files):
   - `zoomConfig?: { showButton?: boolean }` (single line, manifest-safe).
   - Toolbar: with `zoomConfig.showButton` a toggle button (`data-iris-table-zoom`)
     renders after the batch button (and after columnSettings, per baseline slot
     order); icon ⛶ when not zoomed, ✕ when zoomed; `aria-label`/`title` switch
     between i18n `table.zoomIn` / `table.zoomOut` (en `Zoom in`/`Zoom out`, zh
     `放大`/`退出放大`).
   - State: local `zoomed` (useState false); zoomed root gets
     `data-iris-table-zoomed="true"` and the injected stylesheet rule
     `[data-iris-table][data-iris-table-zoomed] { position: fixed; inset: 0;
z-index: var(--iris-z-popover, 1000); background: var(--iris-surface);
overflow: auto }` (token-driven only). Verified caveat: the root is a
     plain block (each ROW is its own CSS grid), so the fixed overlay leaves
     the internal grid layout untouched — documented in the stylesheet
     comment; the form/toolbar/pager sections are fragment siblings OUTSIDE
     the root and stay in place above the overlay (matches vxe grid zoom,
     which zooms the grid, not the page).
   - `fixedHeight` now includes `zoomed`, so the sticky header + scroll
     machinery engage exactly like an explicit height; inline `height: 100%`
     is forced after `...style` (zoom wins over caller heights). Caller
     inline `position`/`z-index` in `style` would override the stylesheet
     rule — documented caveat.
   - Esc exits zoom: a `window` keydown listener registered only while zoomed.
   - No body scroll lock (documented in the baseline; overlay is the root).

2. **layouts** (`props.ts` + `Table.tsx`):
   - `layouts?: { form?: 'top' | 'hidden'; toolbar?: 'top' | 'hidden'; pager?:
'bottom' | 'hidden' }` (single line, manifest-safe).
   - Suppression-only: `form: 'hidden'` skips the form block (formConfig still
     accepted), `toolbar: 'hidden'` skips the toolbar (and its zoom toggle),
     `pager: 'hidden'` skips the proxy pager. Defaults render every section
     exactly as before — the default `layouts` shape matches current behavior
     byte-for-byte (no reordering API).

3. **visibleMethod** (`types.ts` + `Table.tsx`):
   - `IrisTableColumn.visibleMethod?: () => boolean` (single line).
   - Evaluated in the `displayColumns` memo — at most once per render, ANDed
     with `columnVisibility`; **decision: `visibleMethod() === false`
     overrides `columnVisibility: true`** (a column whose own predicate vetoes
     itself must not render). Scope mirrors `columnVisibility`: top-level
     columns only — grouped leaves are not consulted (documented in types.ts;
     the grouped-leaf test asserts this explicitly). Reference-preserving:
     without `columnVisibility` and without any `visibleMethod` the memo
     result IS `orderedColumns`.

**Files changed:** `props.ts` (+2 props), `types.ts` (+1 member), `Table.tsx`
(~+45), `packages/core/src/i18n.ts` (+2 keys), `packages/plugin-locale-zh/src/
core/index.ts` (+2 keys), regenerated `manifest.json`/`llms.txt`; tests: new
`zoom-layouts-visiblemethod.test.tsx` (**19 tests, 326 lines ≤500**). Props.ts
483/500 lines — under the limit, no types.ts migration needed.

**Counts:** react 1798/1798 tests · 159 files · typecheck ✓ · lint 0 errors
(1 pre-existing complexity warning, 176 vs 161 at HEAD) · spec scanner 0
violations · core 1249/1249 · plugin-locale-zh 6/6 (incl. "translates EVERY
built-in key" parity guard) · manifest regenerated + committed.

**Unfinished:** none. Decisions documented above: visibleMethod veto wins over
columnVisibility; grouped leaves out of scope (mirrors columnVisibility);
zoom without `toolbar` renders no entry point (the toggle lives in the
toolbar, vxe parity); no body scroll lock while zoomed; zh zoomOut = 退出放大
(explicit exit semantics, not vxe's 缩小).
