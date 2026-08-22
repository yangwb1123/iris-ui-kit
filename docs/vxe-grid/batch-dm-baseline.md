Baseline complete. **`/home/u1/iris-ui/docs/vxe-grid/batch-dm-baseline.md`** written (4.4KB, verification-style) — the only file created; all source/manifest/docs untouched (the two other ` M` entries in git status — `DECISIONS.md`, `batch-dl-gate.md` — pre-existed before this run).

## What's in the baseline (all anchors verified against current code at HEAD `b2086564`)

**Exact design** — the revised spec `autoSaveState?: { intervalMs?: number }` is already fully shipped at HEAD (added in `61ec5418`), so the baseline records it as verified design with per-line anchors:

- **Prop**: `autoSaveState?: TableTypes.IrisTableAutoSaveStateConfig` at `props/editing.ts:286` right after `persistState` (:283); type `{ intervalMs?, storage?, key? }` at `types/base.ts:107-127` — spec head is a structural subset, `storage`/`key` are documented shipped superset
- **定时写**: `Table.tsx:1489-1500` — `setInterval(save, interval)` serializing `{...persistSnapshotRef.current}` minus `multiSortState` → **byte-identical to `exportStateJson()`** (same collector `:1284`, same strip, same stringify); cleanup on unmount/config change
- **恢复**: `:1479-1487` — runs in the effect body **before** first timer tick via `applyViewSnapshotRef` (shared gated path with `importStateJson`/views: query-first, per-piece type guards, pageSize `onPageChange(1,size)` reproduction); any failure fail-inert
- **与 persistState 区分矩阵**: separate key (`iris-table-auto-state` vs `iris-table-state`), timer-driven whole-package snapshot (no `include`) vs per-change deduped writes, `multiSortState` deliberately excluded
- **fail-closed gates**: non-positive/NaN interval, `storage:false`, SSR window guard → zero IO

**File map**: 4 source/test files with exact touch points + manifest (`autoSaveState` present, stats 155×4) + comparison doc `:418` DM row; zero core/vue/solid/svelte/styles/i18n changes.

**Test plan**: spec-mandated pair (恢复 / 定时写) already delivered at `batch-dl-dt.test.tsx:65-91` under fake timers with a MemoryMap adapter; plus 10 fail-inert/distinction contract checks (#3–#12) — invalid interval, `storage:false`, storage throws, corrupt snapshot, no-config zero-IO, restore-before-first-tick, multiSort strip, default key, SSR, timer cleanup — all satisfied by the shipped implementation.
