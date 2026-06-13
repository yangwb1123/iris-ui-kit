import type { ContractScenario } from '../types'

const ITEM = '[data-iris-segmented-item]'

/**
 * Shared Segmented behavior. Each adapter mounts a segmented control with three
 * options (values `a`/`b`/`c`) and the first selected by default (React/Solid/
 * Svelte `defaultValue="a"`; Vue via a v-model harness holding `'a'`), then runs
 * this. Single-selection: clicking an item checks it (`aria-checked="true"`) and
 * unchecks the previously-selected sibling. Only DISTINCT items are clicked, so
 * the contract stays agnostic to whether re-clicking the active item deselects.
 */
export const segmentedScenario: ContractScenario = {
  name: 'Segmented',
  description: 'Single-selection: clicking an item checks it and unchecks the prior sibling.',
  steps: [
    {
      label: 'initial: first selected',
      action: 'none',
      expect: [
        { selector: ITEM, read: 'count', equals: 3 },
        { selector: ITEM, index: 0, read: 'aria-checked', equals: 'true' },
        { selector: ITEM, index: 1, read: 'aria-checked', equals: 'false' },
        { selector: ITEM, index: 2, read: 'aria-checked', equals: 'false' },
      ],
    },
    {
      label: 'click second → selection moves',
      action: 'click',
      target: ITEM,
      index: 1,
      expect: [
        { selector: ITEM, index: 1, read: 'aria-checked', equals: 'true' },
        { selector: ITEM, index: 0, read: 'aria-checked', equals: 'false' },
      ],
    },
    {
      label: 'click third → selection moves',
      action: 'click',
      target: ITEM,
      index: 2,
      expect: [
        { selector: ITEM, index: 2, read: 'aria-checked', equals: 'true' },
        { selector: ITEM, index: 1, read: 'aria-checked', equals: 'false' },
      ],
    },
  ],
}
