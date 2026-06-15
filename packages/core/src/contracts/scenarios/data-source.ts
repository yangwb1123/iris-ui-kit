import type { ContractScenario } from '../types'

/** A rendered row — `data-iris-ds-row`, text = the row's `name`. ×4 harness. */
const ROW = '[data-iris-ds-row]'
/** Sort-by-age trigger — `data-iris-ds-sort`. ×4 harness. */
const SORT = '[data-iris-ds-sort]'
/** Filter name~"li" trigger — `data-iris-ds-filter`. ×4 harness. */
const FILTER = '[data-iris-ds-filter]'
/** Clear-filters trigger — `data-iris-ds-clear`. ×4 harness. */
const CLEAR = '[data-iris-ds-clear]'

/**
 * Shared `createDataSource` (the unified v2 data engine) behavior through each
 * adapter's `useDataSource` bridge. Each adapter mounts a tiny harness that
 * drives `useDataSource({ fetcher: createSyncClientDataSource(data, columns) })`
 * over three rows — Charlie(30) / Alice(25) / Bob(35), `name` filterable — and
 * renders the live rows plus sort / filter / clear triggers. This replays the
 * data engine's defining operations end-to-end across the four hand-written
 * bridges: an initial synchronous client load, `setSort` re-ordering, `setFilter`
 * narrowing the set (while the sort persists), and `clearFilters` restoring it.
 * A bridge that drops reactivity, re-emits the wrong slice, or resets sort on
 * filter diverges here — exactly the cross-adapter drift the engine's own
 * (single, framework-agnostic) unit tests cannot see.
 */
export const dataSourceScenario: ContractScenario = {
  name: 'DataSource',
  description:
    'useDataSource bridges drive createDataSource identically: load, setSort, setFilter, clearFilters.',
  steps: [
    {
      label: 'initial: 3 rows in source order',
      action: 'none',
      expect: [
        { selector: ROW, read: 'count', equals: 3 },
        { selector: ROW, index: 0, read: 'text', equals: 'Charlie' },
      ],
    },
    {
      label: 'sort by age ascending → Alice(25) first, Bob(35) last',
      action: 'click',
      target: SORT,
      expect: [
        { selector: ROW, read: 'count', equals: 3 },
        { selector: ROW, index: 0, read: 'text', equals: 'Alice' },
        { selector: ROW, index: 2, read: 'text', equals: 'Bob' },
      ],
    },
    {
      label: 'filter name~"li" → Alice + Charlie remain, sort still active',
      action: 'click',
      target: FILTER,
      expect: [
        { selector: ROW, read: 'count', equals: 2 },
        { selector: ROW, index: 0, read: 'text', equals: 'Alice' },
        { selector: ROW, index: 1, read: 'text', equals: 'Charlie' },
      ],
    },
    {
      label: 'clear filters → all 3 return, age sort preserved',
      action: 'click',
      target: CLEAR,
      expect: [
        { selector: ROW, read: 'count', equals: 3 },
        { selector: ROW, index: 0, read: 'text', equals: 'Alice' },
        { selector: ROW, index: 2, read: 'text', equals: 'Bob' },
      ],
    },
  ],
}
