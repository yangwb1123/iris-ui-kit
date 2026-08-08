import type { ContractScenario } from '../types'

/** A rendered row — `data-iris-ds-row`, text = the row's `name`. ×4 resilient harness. */
const ROW = '[data-iris-ds-row]'
/** Reload trigger (re-fetch within TTL) — `data-iris-ds-reload`. ×4 harness. */
const RELOAD = '[data-iris-ds-reload]'
/** Multi-sort trigger A (age asc) — `data-iris-ds-multisort-a`. ×4 harness. */
const MULTI_SORT_A = '[data-iris-ds-multisort-a]'
/** Multi-sort trigger B (name desc) — `data-iris-ds-multisort-b`. ×4 harness. */
const MULTI_SORT_B = '[data-iris-ds-multisort-b]'
/** Rename-first-row mutation (action resolves; full reload) — `data-iris-ds-mutate`. ×4 harness. */
const MUTATE = '[data-iris-ds-mutate]'
/**
 * Fetch-counter mirror — `data-iris-ds-meta` / `data-fetches`: how many times the
 * harness fetcher has ACTUALLY RUN (cache misses only, never cache hits). ×4 harness.
 */
const META = '[data-iris-ds-meta]'

/**
 * RESILIENT `createDataSource` contract — the `resilient` option's cache-key
 * completeness and post-mutation auto-invalidation, replayed ×4.
 *
 * Each adapter mounts a paged harness (`pageSize: 10`, `resilient: { ttlMs: 60_000 }`)
 * over three rows — Charlie(30) / Alice(25) / Bob(35) — whose fetcher reads a
 * MUTABLE backing store and returns per-row COPIES, so a mutation becomes visible
 * ONLY through a real re-fetch (the engine's rows never alias the backing
 * objects). `data-fetches` exposes cache hits vs. network reads to the
 * attribute-only runner.
 *
 * Replays the two resilient-mode guarantees across all four hand-written bridges:
 *   - a `reload` within the TTL is a CACHE HIT — the fetch counter does not move
 *     (the TTL is genuinely active);
 *   - a `multiSort` change is a DIFFERENT cache key — the sort re-fetches and
 *     re-orders (a key that ignored multiSort would serve the initial page);
 *   - a successful `mutate` AUTO-INVALIDATES — the post-mutate reload re-fetches
 *     and serves the NEW row value (a still-fresh cache would short-circuit and
 *     keep showing the pre-mutation row).
 * A bridge whose `resilient` config never reaches the engine, or whose engine
 * serves pre-mutation rows after a successful mutate, diverges here.
 */
export const dataSourceResilientScenario: ContractScenario = {
  name: 'DataSourceResilient',
  description:
    'useDataSource bridges drive createDataSource resilient mode identically: TTL cache hit, multiSort-specific keys, mutate auto-invalidation.',
  steps: [
    {
      label: 'initial load → 3 rows in source order, 1 fetch',
      action: 'none',
      expect: [
        { selector: ROW, read: 'count', equals: 3 },
        { selector: ROW, index: 0, read: 'text', equals: 'Charlie' },
        { selector: META, read: 'data-fetches', equals: '1' },
      ],
    },
    {
      label: 'reload within TTL → cache hit: same rows, NO new fetch',
      action: 'click',
      target: RELOAD,
      expect: [
        { selector: ROW, read: 'count', equals: 3 },
        { selector: ROW, index: 0, read: 'text', equals: 'Charlie' },
        { selector: META, read: 'data-fetches', equals: '1' },
      ],
    },
    {
      label: 'multiSort age asc → Alice(25) first, distinct cache key (2nd fetch)',
      action: 'click',
      target: MULTI_SORT_A,
      expect: [
        { selector: ROW, read: 'count', equals: 3 },
        { selector: ROW, index: 0, read: 'text', equals: 'Alice' },
        { selector: ROW, index: 2, read: 'text', equals: 'Bob' },
        { selector: META, read: 'data-fetches', equals: '2' },
      ],
    },
    {
      label: 'multiSort name desc → Charlie/Bob/Alice, another key (3rd fetch)',
      action: 'click',
      target: MULTI_SORT_B,
      expect: [
        { selector: ROW, read: 'count', equals: 3 },
        { selector: ROW, index: 0, read: 'text', equals: 'Charlie' },
        { selector: ROW, index: 1, read: 'text', equals: 'Bob' },
        { selector: META, read: 'data-fetches', equals: '3' },
      ],
    },
    {
      label: 'successful mutate → cache invalidated: reload serves the NEW name (4th fetch)',
      action: 'click',
      target: MUTATE,
      expect: [
        { selector: ROW, read: 'count', equals: 3 },
        { selector: ROW, index: 0, read: 'text', equals: 'Charlie!' },
        { selector: META, read: 'data-fetches', equals: '4' },
      ],
    },
  ],
}
