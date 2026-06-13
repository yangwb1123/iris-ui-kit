import type { ContractScenario } from '../types'

/** The sortable "name" column header — `data-iris-table-header={col.key}` ×4. */
const NAME_HEADER = '[data-iris-table-header="name"]'

/**
 * Shared Table column-sort behavior. Each adapter mounts a table with a sortable
 * `name` column and a few rows, no initial sort (React/Solid `defaultSort`
 * omitted/null; Vue/Svelte a model harness holding `null`), then runs this. A
 * sortable column header (`[data-iris-table-header="<key>"]`, `role="columnheader"`)
 * exposes `aria-sort`: `"none"` when sortable-but-inactive, `"ascending"` /
 * `"descending"` when it's the active sort key. Clicking the header cycles
 * `none → ascending → descending → none`. Asserts all four adapters drive the
 * same sort state machine (the shared sort controller) identically.
 */
export const tableSortScenario: ContractScenario = {
  name: 'TableSort',
  description: 'Clicking a sortable column header cycles aria-sort none→ascending→descending→none.',
  steps: [
    {
      label: 'initial: sortable, unsorted',
      action: 'none',
      expect: [
        { selector: NAME_HEADER, read: 'count', equals: 1 },
        { selector: NAME_HEADER, read: 'aria-sort', equals: 'none' },
      ],
    },
    {
      label: 'click → ascending',
      action: 'click',
      target: NAME_HEADER,
      expect: [{ selector: NAME_HEADER, read: 'aria-sort', equals: 'ascending' }],
    },
    {
      label: 'click → descending',
      action: 'click',
      target: NAME_HEADER,
      expect: [{ selector: NAME_HEADER, read: 'aria-sort', equals: 'descending' }],
    },
    {
      label: 'click → back to none',
      action: 'click',
      target: NAME_HEADER,
      expect: [{ selector: NAME_HEADER, read: 'aria-sort', equals: 'none' }],
    },
  ],
}
