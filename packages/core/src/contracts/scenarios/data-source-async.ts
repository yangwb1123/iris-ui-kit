import type { ContractScenario } from '../types'

/** A rendered row — `data-iris-ds-row`, text = the row's `name`. ×4 async harness. */
const ROW = '[data-iris-ds-row]'
/** loadMore trigger (infinite append) — `data-iris-ds-loadmore`. ×4 harness. */
const LOAD_MORE = '[data-iris-ds-loadmore]'
/** Reload trigger (re-fetch) — `data-iris-ds-reload`. ×4 harness. */
const RELOAD = '[data-iris-ds-reload]'
/** Optimistic rename (skipReload, action succeeds) — `data-iris-ds-rename`. ×4 harness. */
const RENAME = '[data-iris-ds-rename]'
/** Optimistic rename whose action REJECTS → rollback — `data-iris-ds-rename-fail`. ×4 harness. */
const RENAME_FAIL = '[data-iris-ds-rename-fail]'
/**
 * Engine-state mirror node — `data-iris-ds-meta`, reflecting the live bridge
 * state as attributes so the runner (attribute-only reader) can observe async
 * flags without an input `.value`:
 *   `data-hasmore`  — `state.hasMore`
 *   `data-loading`  — `state.loading`
 *   `data-fetches`  — how many times the latency fetcher has resolved (a counter
 *                     the harness owns), proving a re-fetch actually happened.
 * ×4 harness.
 */
const META = '[data-iris-ds-meta]'

/**
 * ASYNC `createDataSource` contract — the per-framework `useDataSource` bridges
 * diverge most on async TIMING (the sync happy-path is in `dataSourceScenario`).
 *
 * Each adapter mounts an infinite-mode harness (`mode: 'infinite'`, `pageSize: 2`)
 * over five rows (Ann/Ben/Cara/Dan/Eve) driven by an INJECTED-LATENCY fetcher
 * (resolves on a microtask, not synchronously) — so every operation round-trips
 * through the engine's Promise path (`loading`/`loadingMore`, the `epoch` stale-
 * response guard, `applyResult` append) exactly as a real network source would.
 * The harness exposes a `data-iris-ds-meta` mirror (hasMore / loading / a fetch
 * counter) so the runner can assert async observables after each `flush()`.
 *
 * Replays the engine's defining ASYNC operations across all four hand-written
 * bridges:
 *   - `loadMore` infinite append — the visible row count GROWS (2 → 4 → 5) and
 *     `hasMore` flips false at the end;
 *   - optimistic `mutate` (skipReload) that COMMITS — the first row's value flips
 *     to the optimistic value and stays (no reload overwrites it);
 *   - optimistic `mutate` whose action REJECTS — the optimistic value ROLLS BACK
 *     to the snapshot and the engine re-`load()`s (fetch counter advances);
 *   - `reload` re-fetch — a fresh fetch (counter advances) that replaces the
 *     append-accumulated rows with the current page's slice.
 * A bridge that loses an async write (no `await` in its flush), double-applies an
 * append, or fails to roll back an optimistic mutate diverges here — exactly the
 * cross-adapter async drift the engine's own (single) unit tests cannot see.
 */
export const dataSourceAsyncScenario: ContractScenario = {
  name: 'DataSourceAsync',
  description:
    'useDataSource bridges drive createDataSource async identically: infinite loadMore append, optimistic mutate commit + rollback, reload re-fetch.',
  steps: [
    {
      label: 'initial async load → page 1 (2 rows), hasMore, 1 fetch',
      action: 'none',
      expect: [
        { selector: ROW, read: 'count', equals: 2 },
        { selector: ROW, index: 0, read: 'text', equals: 'Ann' },
        { selector: META, read: 'data-hasmore', equals: 'true' },
        { selector: META, read: 'data-loading', equals: 'false' },
        { selector: META, read: 'data-fetches', equals: '1' },
      ],
    },
    {
      label: 'optimistic rename (skipReload, action resolves) → row0 commits, no re-fetch',
      action: 'click',
      target: RENAME,
      expect: [
        { selector: ROW, read: 'count', equals: 2 },
        { selector: ROW, index: 0, read: 'text', equals: 'Ann*' },
        // skipReload → the optimistic value persists and NO fetch fired.
        { selector: META, read: 'data-fetches', equals: '1' },
      ],
    },
    {
      label: 'optimistic rename whose action REJECTS → rollback to snapshot + re-load',
      action: 'click',
      target: RENAME_FAIL,
      expect: [
        // Rolled back: row0 is the reloaded original, never the failed optimistic value.
        { selector: ROW, read: 'count', equals: 2 },
        { selector: ROW, index: 0, read: 'text', equals: 'Ann' },
        // The catch path re-load()s the current page → one more fetch.
        { selector: META, read: 'data-fetches', equals: '2' },
      ],
    },
    {
      label: 'loadMore → append page 2 (4 rows), still hasMore, 3rd fetch',
      action: 'click',
      target: LOAD_MORE,
      expect: [
        { selector: ROW, read: 'count', equals: 4 },
        { selector: ROW, index: 0, read: 'text', equals: 'Ann' },
        { selector: ROW, index: 3, read: 'text', equals: 'Dan' },
        { selector: META, read: 'data-hasmore', equals: 'true' },
        { selector: META, read: 'data-fetches', equals: '3' },
      ],
    },
    {
      label: 'loadMore → append page 3 (5 rows), hasMore false, 4th fetch',
      action: 'click',
      target: LOAD_MORE,
      expect: [
        { selector: ROW, read: 'count', equals: 5 },
        { selector: ROW, index: 4, read: 'text', equals: 'Eve' },
        { selector: META, read: 'data-hasmore', equals: 'false' },
        { selector: META, read: 'data-fetches', equals: '4' },
      ],
    },
    {
      label: 'reload → fresh fetch of the current page replaces appended rows',
      action: 'click',
      target: RELOAD,
      expect: [
        // reload re-fetches the CURRENT page (3, the last slice = 1 row), replacing
        // the append-accumulated set — an observable reset that proves a re-fetch.
        { selector: ROW, read: 'count', equals: 1 },
        { selector: ROW, index: 0, read: 'text', equals: 'Eve' },
        { selector: META, read: 'data-fetches', equals: '5' },
      ],
    },
  ],
}
