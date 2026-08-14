Baseline complete — `/home/u1/iris-ui/docs/vxe-grid/batch-as-baseline.md` (258 lines). `git status` confirms only the new doc; zero source files touched.

**What the baseline covers** (every claim verified against current code):

**a) `autoRefresh?: { intervalMs: number }`** (proxy mode only):

- Controller facts: `proxyRef` (Table.tsx:1115), `tableLoading = proxy ? proxyState.loading : loading` (batch C, :1129), lifecycle effect keyed `[hasProxy]` (:1137–1188, cleanup nulls ref + `destroy()`), refetch results land via the sync effect → `setLiveData` (:1260), and the built-in ↻ button already does `proxyRef.current.refetch()` (:5416–5435) — the exact "normal refetch" pattern.
- **Silent-flag check**: `createRemoteTableSource`'s options are only `query/autoLoad/initialParams` (remote-table.ts:46–53) — **no silent option exists**. `createDataSource.fetchPage` flips `loading: true` before awaiting a thenable (:169/:179), so the loading flash is the standard refetch behavior → documented per instruction, suppression (a core `silent` flag) explicitly out of scope.
- One interval effect after :1188, keyed on scalar `intervalMs` + `hasProxy`, `proxyRef.current?.refetch()` at tick time, cleanup on unmount + prop change. Cleanup ordering is safe (lifecycle cleanup nulls the ref before the interval clear runs).

**b) `freshness?: boolean`**:

- All mutations funnel through `setLiveData`: proxy page load (:1260), edit commit (:1849 direct), row ops/paste/batch/range-clear via `commitRowList` (:2666–2673), undo/redo via `applyUndoSnapshot` (:2682–2702) — so **one effect keyed on `[liveData]` catches every freshness-relevant change**.
- Toolbar: gate at :5288 must admit `freshness` (same pattern as `chartPreview`); stamp span after the title (:5312–5317), `data-iris-freshness`, `t('table.freshness', { time: formatClock(...) })`, hidden when `liveData.length === 0` ("no data yet → hidden").
- **`formatClock` in core `date.ts`** (the `formatLocalISO` mold: local-time, padStart, no timezone surprises) — deterministic 24h HH:MM:SS, deliberately not `Intl` (hour12 variance); tests in `date.test.ts`. i18n: en `Updated at {time}` (core i18n.ts) + zh `更新于 {time}` (plugin-locale-zh).

**File map**: 7 edits + 1 new test file (`auto-refresh-freshness.test.tsx`, 12 test cases incl. fake-timer tick counts, unmount cleanup, interval restart, and a test that locks in the loading-flash behavior) + **12 numbered fiats** for gate arbitration (proxy-only, no silent flag, intervalMs ≤ 0 fail-closed, "no data yet" interpretation, stamp placement, etc.).
