import type { ContractScenario } from '../types'

const PAGE = '[data-iris-pagination-item="page"]'

/**
 * Shared Pagination behavior. Each adapter mounts a pager over `total=30` with
 * `pageSize=10` (→ exactly 3 page buttons, always visible, no ellipsis) starting
 * on page 1 (React `defaultValue`, Solid `defaultPage`, Vue/Svelte a model harness
 * holding `1`), then runs this. Page-number buttons carry
 * `data-iris-pagination-item="page"`; the active one (and only it) carries
 * `aria-current="page"`. Clicking a page button moves `aria-current` to it.
 * Asserts all four adapters drive identical current-page tracking. (Three pages
 * stay visible regardless of the current one, so item indices 0/1/2 map stably to
 * pages 1/2/3.)
 */
export const paginationScenario: ContractScenario = {
  name: 'Pagination',
  description: 'Clicking a page button moves aria-current="page" to it (exactly one current).',
  steps: [
    {
      label: 'initial: page 1 current',
      action: 'none',
      expect: [
        { selector: PAGE, read: 'count', equals: 3 },
        { selector: PAGE, index: 0, read: 'aria-current', equals: 'page' },
        { selector: PAGE, index: 1, read: 'aria-current', equals: null },
        { selector: PAGE, index: 2, read: 'aria-current', equals: null },
      ],
    },
    {
      label: 'click page 3 → current moves',
      action: 'click',
      target: PAGE,
      index: 2,
      expect: [
        { selector: PAGE, index: 2, read: 'aria-current', equals: 'page' },
        { selector: PAGE, index: 0, read: 'aria-current', equals: null },
      ],
    },
    {
      label: 'click page 2 → current moves',
      action: 'click',
      target: PAGE,
      index: 1,
      expect: [
        { selector: PAGE, index: 1, read: 'aria-current', equals: 'page' },
        { selector: PAGE, index: 2, read: 'aria-current', equals: null },
      ],
    },
  ],
}
