Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-aj-baseline.md` (193 lines). No source files touched — `git status` shows only the new doc.

**What the baseline establishes** (all verified against current code):

**a) Core `rangeStats`** — placed in `packages/core/src/data-view.ts` next to the canonical `aggregate`/`summarize` (the barrel `index.ts` already re-exports from there, so `@iris-ui-kit/core` picks it up with zero wiring). Reuses `aggregate` semantics exactly: `count` = non-null cells; sum/avg/min/max coerce `Number(raw)` and keep only finite values (non-numeric ignored). One deliberate divergence: empty numeric subset → `null` (the `number | null` shape's marker) instead of `aggregate`'s `0`/`NaN` — representation only. Empty range → `{}`. The react bridge maps `dataIndex ?? key` into `key` (same indirection as `getCellValue`), keeping the core pure over `{ key }`.

**b) Range toolbar 统计 button + panel** — the bar already remounts on every range change (`key={rangeToolbarSeq}`), so the panel-open state must be hoisted to `Table.tsx` for "recomputes on range change" to hold with the panel staying open. Stats computed by a memo over `[activeRange, bodyData, leafColumns]` — `bodyData` (the displayed, already query/filtered rows) sliced by the range's row/col indexes; `activeRange` derives from the existing `useSyncExternalStore` range bridge. The panel rides the bar's existing `useDismiss` (outside click / Escape → `clearRange` → whole surface hides). i18n: `table.range.stats` en + zh, alongside the existing `table.range.*` keys.

**c) Views snapshot gains `query`** — optional `query?: string` on `IrisTablePersistedState` (existing views without it load unchanged — `readViews` only checks the snapshot object shape). Collector adds the query **gated on `views`** so the batch-AG `persistState` path stays byte-identical (deliberately not added to `IrisTablePersistPiece`). Apply restores query **first** via `onQueryChange` with a typeof-string type guard, before the other pieces.

File map: 0 new files, 9 edits, ~15 new tests, 7 fiats flagged for review.
