Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-ah-baseline.md` (251 lines). No source files touched (`git status` shows only the new doc).

**What the baseline establishes:**

**a) Named view presets (`views` prop)** — pure reuse of the batch-AG machinery:

- Snapshot shape = the existing `IrisTablePersistedState` (same 8 pieces as `persistState`); capture = the existing `persistSnapshot` memo; apply = the existing `restorePersistPiece` switch (same per-piece callback gating + type guards).
- Key trap surfaced: `pageSize` restore is _eligibility-only_ in `restorePersistPiece` — the real restore lives in the mount-only proxy effect, so a mid-session view apply must reproduce `onPageChange(1, size)` + `ctrl.request({pageSize, page:1})`.
- `usePersistState.ts`'s `defaultStorage()` is private — needs exporting for the new `useTableViews.ts` hook instead of duplicating the SSR guard.
- UI: toolbar select `data-iris-table-views` + prompt-free save menu (inline input, FilterPanel/ContextMenu floating pattern) + per-view delete; toolbar condition widens to `(toolbar || views)`.
- `activeKey`/`onActiveViewChange` controlled-only, not persisted; storage key `'iris-table-views'`, `storage: false` → in-memory.

**b) Range floating toolbar** — visibility derives from the existing `useSyncExternalStore` range bridge; ContextMenu virtual-anchor pattern chosen (first selected cell's rect, placement top, flip/shift ON, portal) with two deliberate divergences from ContextMenu: it repositions on scroll via `autoUpdate` instead of closing, and has no close button (hides on `clearRange`). The three actions map 1:1 onto existing paths: 复制 → `buildRangeTsv` + `writeClipboardText` (batch O), 导出 CSV → `exportCsv` + `downloadCsv` on a sliced rectangle (batch W), 清除 → batched byKey `commitRowList` (pasteIntoRange shape, cells become `''`).

File map: 3 new files (`useTableViews.ts`, `TableViews.tsx`, `RangeToolbar.tsx`), 5 small edits, 0 core logic changes, +4 i18n keys; ~24 new tests across `views.test.tsx` + `range-toolbar.test.tsx` following the `persist-state`/`clip-fnr`/`exportDownload` harness conventions. 5 open questions resolved by fiat (activeKey not persisted, upsert on duplicate names, `''` clear semantics, headerless range CSV, pageSize gating parity).
