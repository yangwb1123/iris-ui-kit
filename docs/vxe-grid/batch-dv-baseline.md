Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-dv-baseline.md` (253 lines). No source files modified — the only new file is the baseline; the `M` entries are pre-existing working-tree changes (batch DU gate record) untouched.

## Summary

**Verified (HEAD `65f0b8ad`)**: `urlState`/`_table`/`hashchange` → zero hits — forward design. Read sources for the 4 spec pieces: `sort`/`multiSortState` (useTableSort, Table.tsx:926-933), `filters`/`filterValues` (props/layout.ts:252-258), `page`/`pageSize` (`proxyState.params`, proxy-only — 无代理跳过 precedent). Restore channel already exists: `restorePersistPiece` (Table.tsx:1352, per-piece callback gating + type guards) + `applyViewSnapshot`'s pageSize reproduction (:1457-1464); pre-query pageSize injection (proxy-creation effect :634-655) avoids double fetch. Manifest gate: propCount 200→201, eventCount 32 unchanged.

**Exact design**:

- `urlState?: boolean` in props/editing.ts:285 (persistState/autoSaveState sibling family), default off, fail-closed — no new types/handle/i18n/core.
- Encoding: one `_table` query param, versioned `{v:1, sort?|sorts? (multiSort gated), filters?, filterValues?, page?/pageSize? (proxy only)}`, `encodeURIComponent(JSON.stringify(...))`; decode is **whole-state fail-closed** (schema version + per-piece type guards → any violation = null, never partial restore).
- Write: single effect, always `history.replaceState` (no history spam), preserves other params, empties remove `_table`.
- Restore: mount lazy-ref parse (SSR-guarded) with page/pageSize via **pre-query injection** (exactly one query); mid-session via `hashchange` (spec) + `popstate` (documented extension), idempotent same-state no-op, `_table`-absent → no-op. URL wins over persistState on mount conflicts (effect declared after the persist block).
- React-only bridge; zero changes to core/other frameworks/styles/i18n.

**File map**: props/editing.ts +1 prop · Table.tsx ~110 lines / 4 touch points (helpers, pre-query injection, restore/write/listener effects, mid-session dispatch) · manifest regenerated (200→201) · NEW `test/batch-dv.test.tsx` (jsdom) + `test/batch-dv-ssr.test.tsx` (node env — file-scoped pragma, persist-state-ssr precedent).

**Test plan**: 13 cases — encode (sort/filters/page-pageSize/empty), restore-mount (single query), hashchange restore + idempotency, fail-closed (corrupt/`v:2`/wrong types/prop off), multiSort channel, share-link round-trip (Unicode + reserved chars), uncontrolled-table inertness, persist-vs-url ordering, regression (off = byte-identical), SSR. Plus 4 non-blocking observations (search-vs-hash dual read, `_table`-absent no-op, `sorts` extension rationale, replaceState back-button semantics).
