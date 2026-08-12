Review complete — verdict written to `docs/vxe-grid/batch-ah-review.md`.

## Verdict: FAIL (findings 1–2 block; 3–4 low)

**Verification (all green):** react test 1873/1873 · typecheck clean · lint 0 errors (1 pre-existing complexity warning) · audit 0 vulnerabilities · `check:manifest` up to date (155×4 native, 0 unavailable) · core framework-free · i18n +6 keys en+zh.

**Checklist:** views collector is the _same_ `persistSnapshot` memo; apply goes through callbacks only (pageSize reproduces the mount sequence, exactly one request — test-verified); persistence guards (SSR/storage:false/corrupt-JSON/upsert) all present and tested; activeKey controlled-only; range toolbar anchored top with flip/shift, autoUpdate repositioning, portal, useDismiss→clearRange hide; copy/export/clear all correct; additive-only diff; token-styled.

**Findings:**

1. **HIGH** — `Table.tsx:3666-3679`: the spread `onClick` that calls `updateRangeToolbarAnchor()` is dead code (shadowed by the later `onClick` prop on the same cell). With `cellRange` + `onCellClick`, the click goes through `handleCellClick`, which never updates the anchor → `rangeToolbarAnchorRef` stays null → `useFloating` early-returns → `visibility: hidden` → **the bar renders but is invisible**. Untested combo (no test pairs `cellRange` with `onCellClick`). Fix: anchor update in `handleCellClick`'s cellRange branch + remove the dead handler.
2. **MEDIUM** — `Table.tsx:1317-1350` `applyViewSnapshot` re-implements the restore gating _without_ the per-piece type guards `restorePersistPiece` has, diverging from the baseline's "same per-piece callback gating + type guards". A tampered storage entry `{snapshot:{sort:42}}` passes `readViews` and lands raw in `onSortChange(42)`.
3. **LOW** — `TableViews.tsx`: a view named `__iris-save-view` collides with the sentinel and becomes unselectable.
4. **LOW** — `RangeToolbar.tsx:58`: whole-toolbar `aria-label` is "Copy" (first action's label).
