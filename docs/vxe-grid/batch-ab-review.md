Verdict written to `docs/vxe-grid/batch-ab-review.md`. **FAIL** — 2 medium + 2 low + 3 info.

## What passed

- **Verification**: solid typecheck/lint 0 errors, 953+34 tests pass (13 new `parity-ab`), build ✓, `check:manifest` ✓ (155 comps, 4×155, solid contract `source: native`), `audit:tokens` no new violations (2 pre-existing exceptions), core/react/vue/svelte diffs zero.
- **Semantics vs react reference**: drag (threshold → rects-once → closestCenter → reorder, tap-cancels, cleanup) ✓; grouped header column-drag leaf-only ✓; row mode (all editors open, per-column commit, Escape UI-cancel, row-switch commit, Tab) ✓; contextMenu (cursor virtual anchor, flip/shift off, Esc/outside/scroll close, disabled inert, header excluded, portal) ✓; filter panel (no-sort trigger, OR-match AND-ed with text, remote comma-join ×3 sites, core i18n keys) ✓; handle 6 methods + clearSort/clearFilter channels ✓.

## Key findings

1. **MEDIUM** `IrisTable.tsx:1120-1126/1164-1167` — Escape during a pending **async** (editRules) row-mode commit still writes back via `onCellEdit`/proxyRows: solid's bespoke sessions lack core's `sessionGen` guard (react has a dedicated regression test, `row-edit-mode.test.tsx:193`). Same root cause double-fires on double-Enter; cell-mode `:999-1016` shares it (pre-existing).
2. **MEDIUM** `IrisTable.tsx:608/621-626/1477-1480` — proxy `loadData` writes `localRows` which overrides `proxyRows` and is only cleared by `reloadData`/data-refeed — a **pager page change never replaces it** (stale rows while pager shows page 2). React (liveData effect) and vue (proxy liveData channel) both replace on next query, and solid's own `IrisTableHandle` JSDoc promises it.
3. **LOW** `:2035` — `cellRange` branch precedes `rowMode()` (react is rowMode-first) in the combined-config click path.
4. **LOW** `:2048` — same-row dblclick while editing: solid no-ops/reopens one column; react re-begins the whole row.
5. **INFO** select editors text-only in row mode (handoff-documented), lazyLoad deferred despite baseline scope, rowDrag extra `onDataChange`/local-list channels (vue batch-Y design, documented).

Both mediums have concrete one-line-scope fixes (epoch guard; clear `localRows` on proxy data ref change) plus missing regression tests — suitable for the gate stage. No source files were modified.
