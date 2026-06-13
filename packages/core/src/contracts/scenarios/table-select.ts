import type { ContractScenario } from '../types'

/** Selectable BODY rows expose `aria-selected` (the header row does not). */
const ROW = '[role="row"][aria-selected]'
/** Selection checkboxes — index 0 is the master/select-all, rows follow. */
const CHECKBOX = 'input[type="checkbox"]'

/**
 * Shared Table MULTI row-selection behavior. Each adapter mounts a
 * `selectable="multi"` table with 3 rows and none selected, then runs this. Every
 * selectable body row carries `aria-selected` ("true"/"false"); a per-row native
 * checkbox toggles it (the first `input[type="checkbox"]` is the master/select-all,
 * so row checkboxes start at index 1). Multi mode: toggling a row is INDEPENDENT
 * (selecting a second keeps the first; re-toggling clears just that row). Asserts
 * all four adapters expose selection to assistive tech identically AND drive the
 * shared multi-selection model the same way.
 */
export const tableSelectScenario: ContractScenario = {
  name: 'TableSelect',
  description:
    'Multi-select: toggling a row checkbox flips its row aria-selected independently (a11y parity).',
  steps: [
    {
      label: 'initial: all rows unselected',
      action: 'none',
      expect: [
        { selector: ROW, read: 'count', equals: 3 },
        { selector: ROW, index: 0, read: 'aria-selected', equals: 'false' },
        { selector: ROW, index: 1, read: 'aria-selected', equals: 'false' },
        { selector: ROW, index: 2, read: 'aria-selected', equals: 'false' },
      ],
    },
    {
      label: 'check first row → its row aria-selected true',
      action: 'click',
      target: CHECKBOX,
      index: 1,
      expect: [
        { selector: ROW, index: 0, read: 'aria-selected', equals: 'true' },
        { selector: ROW, index: 1, read: 'aria-selected', equals: 'false' },
      ],
    },
    {
      label: 'check second row → BOTH selected (independent)',
      action: 'click',
      target: CHECKBOX,
      index: 2,
      expect: [
        { selector: ROW, index: 1, read: 'aria-selected', equals: 'true' },
        { selector: ROW, index: 0, read: 'aria-selected', equals: 'true' },
      ],
    },
    {
      label: 'uncheck first row → only second stays selected',
      action: 'click',
      target: CHECKBOX,
      index: 1,
      expect: [
        { selector: ROW, index: 0, read: 'aria-selected', equals: 'false' },
        { selector: ROW, index: 1, read: 'aria-selected', equals: 'true' },
      ],
    },
  ],
}
