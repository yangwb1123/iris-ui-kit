import type { ContractScenario } from '../types'

const TOGGLE = '[data-iris-table-expand-toggle]'
const DETAIL = '[data-iris-table-detail-cell]'

/**
 * Shared Table row-expansion behavior. Each adapter mounts a table with a
 * `renderDetail` (so every row gets a leading expand-toggle) and 3 rows, none
 * expanded, then runs this. Each `[data-iris-table-expand-toggle]` button owns
 * `aria-expanded` ("true"/"false"); clicking it toggles the row's detail panel
 * (`[data-iris-table-detail-cell]`) in/out of the DOM. Exercises the shared
 * expansion controller driven through the Table identically across all four
 * adapters (detail panels are independent — expanding one leaves others closed).
 */
export const tableExpandScenario: ContractScenario = {
  name: 'TableExpand',
  description:
    'Clicking a row expand-toggle flips its aria-expanded and shows/hides its detail panel.',
  steps: [
    {
      label: 'initial: all collapsed, no detail panels',
      action: 'none',
      expect: [
        { selector: TOGGLE, read: 'count', equals: 3 },
        { selector: TOGGLE, index: 0, read: 'aria-expanded', equals: 'false' },
        { selector: TOGGLE, index: 1, read: 'aria-expanded', equals: 'false' },
        { selector: DETAIL, read: 'count', equals: 0 },
      ],
    },
    {
      label: 'expand first row → aria-expanded true + detail appears',
      action: 'click',
      target: TOGGLE,
      index: 0,
      expect: [
        { selector: TOGGLE, index: 0, read: 'aria-expanded', equals: 'true' },
        { selector: TOGGLE, index: 1, read: 'aria-expanded', equals: 'false' },
        { selector: DETAIL, read: 'count', equals: 1 },
      ],
    },
    {
      label: 'collapse first row → aria-expanded false + detail removed',
      action: 'click',
      target: TOGGLE,
      index: 0,
      expect: [
        { selector: TOGGLE, index: 0, read: 'aria-expanded', equals: 'false' },
        { selector: DETAIL, read: 'count', equals: 0 },
      ],
    },
  ],
}
