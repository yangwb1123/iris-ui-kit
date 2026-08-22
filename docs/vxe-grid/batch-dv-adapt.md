Done. **Batch DV（URL 状态深链）complete and committed** at `0288c42e`.

## Files changed (3 source files + 2 test files + manifest)

| File                                                             | Change                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props/editing.ts`           | +1 prop `urlState?: boolean` (single-line boolean, `persistState`/`autoSaveState` sibling family — scanner-safe; named-interface member, no new types)                                                                                                                                                                                    |
| `packages/react/src/primitives/table/Table.tsx`                  | +~295 lines, 4 touch points, zero new imports: module helpers/codec (`IrisTableUrlState` named export + `IRIS_URL_STATE_KEY` + `decodeUrlTableState`/`readUrlTableState`/`writeUrlTableState`/`serializeUrlTableState` — all window-guarded) · mount lazy-ref parse · proxy-creation pre-query injection · restore/write/listener effects |
| `packages/react/src/primitives/table/index.ts`                   | +1 line barrel re-export (`type IrisTableUrlState`, `IRIS_URL_STATE_KEY`)                                                                                                                                                                                                                                                                 |
| `packages/react/src/primitives/table/test/batch-dv.test.tsx`     | new, **373 lines** (≤500 ✓), **13 tests** (jsdom)                                                                                                                                                                                                                                                                                         |
| `packages/react/src/primitives/table/test/batch-dv-ssr.test.tsx` | new, **65 lines** (≤500 ✓), **5 tests** (`// @vitest-environment node`, persist-state-ssr precedent)                                                                                                                                                                                                                                      |
| `packages/manifest/{manifest.json,llms.txt}`                     | regenerated (react contract **200→201 props**, eventCount 32 unchanged; `IrisTableUrlState` type added; baseline-predicted count)                                                                                                                                                                                                         |

Zero core changes (framework-free preserved), zero CSS/i18n, additive only. React-only bridge — the other three frameworks untouched.

## Implementation

- **One `_table` query param** carries versioned JSON `{v:1, sort?|sorts? (multiSort-gated), filters?, filterValues?, page?/pageSize? (proxy-only)}`; writes go through `history.replaceState` (never pushes history entries), preserve every other param, and remove `_table` when the state is empty (fresh app start → clean URL).
- **Whole-state fail-closed decode**: schema version check + per-piece type guards — corrupt JSON / wrong `v` / any invalid piece → `null`, never a partial restore (`decodeUrlTableState` pure function; unit-tested in the node-env file).
- **Write**: single effect, `urlStateOn` gated; encodes only what is restore-able through the **same per-piece callback gates as `persistState`** (`onSortChange` / `onMultiSortChange` (multiSort mode) / `onFiltersChange` / `onFilterValuesChange` / proxy `onPageChange`); an uncontrolled piece is inert in both directions (the URL never claims a channel the table cannot replay). pageSize is omitted when it equals the proxy default (the omission threshold — restore reproduces it anyway).
- **Restore**: mount lazy-ref parse (SSR-guarded, idempotent) with page/pageSize applied **pre-query** in the proxy-creation effect (exactly ONE request for an app-start deep link — the batch-AG pageSize precedent); sort/filters land through the change callbacks right after (remote-sort apps re-query once when the sort prop lands, same as persistState's documented sort restore). Mid-session via `hashchange` (spec) + `popstate` (documented extension); serialized-payload idempotency makes identical URLs an exact no-op; `_table`-absent → no-op.
- **URL wins over `persistState`** on mount conflicts: the effect is declared after the persist restore block and the pre-query injection prefers the URL payload.
- **SSR-safe**: `readUrlTableState`/`writeUrlTableState` are window-guarded; `decodeUrlTableState` is DOM-free.

## Verification

- `@iris-ui-kit/core test`: ✅ 106 files / **1641/1641**
- `@iris-ui-kit/react typecheck`: ✅ clean
- `@iris-ui-kit/react test`: ✅ 249 files / **2855/2855** (incl. 13 DV jsdom + 5 DV SSR)
- `@iris-ui-kit/react lint`: ✅ **0 errors** (2 pre-existing complexity warnings)
- `iris-ui-spec.py --mode all --json`: ✅ **0 violations** (1545 files)
- `gen:manifest`: ✅ regenerated, up-to-date, **committed** (`0288c42e`)

## What is left

Nothing source-side. Baseline's 4 non-blocking observations remain documented (search-vs-hash dual read, `_table`-absent no-op, `sorts` extension rationale, replaceState back-button semantics). Change-budget warning only (304 core logic lines vs 300 target — not blocking). Pre-existing unrelated working-tree changes (aero-platform-console, grid-refactor docs, core data-grid, etc.) deliberately left uncommitted and untouched.
