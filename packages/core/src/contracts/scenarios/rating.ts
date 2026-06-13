import type { ContractScenario } from '../types'

const SLIDER = '[role="slider"][data-iris-rating]'
const STAR = '[data-iris-rating-star]'

/**
 * Shared Rating behavior. Each adapter mounts a 5-star rating starting at `0`
 * with whole-star precision (`allowHalf` off — so clicks are position-independent:
 * star index `i` selects value `i+1`). React/Solid use `defaultValue={0}`;
 * Vue/Svelte a model harness holding `0`. The `role="slider"` container owns
 * `aria-valuenow`; clicking a star sets it. Asserts identical 1-based star
 * selection across all four adapters.
 */
export const ratingScenario: ContractScenario = {
  name: 'Rating',
  description: 'Whole-star: clicking star index i sets the slider aria-valuenow to i+1.',
  steps: [
    {
      label: 'initial: 0 of 5',
      action: 'none',
      expect: [
        { selector: SLIDER, read: 'count', equals: 1 },
        { selector: STAR, read: 'count', equals: 5 },
        { selector: SLIDER, read: 'aria-valuenow', equals: '0' },
      ],
    },
    {
      label: 'click 3rd star → 3',
      action: 'click',
      target: STAR,
      index: 2,
      expect: [{ selector: SLIDER, read: 'aria-valuenow', equals: '3' }],
    },
    {
      label: 'click 1st star → 1',
      action: 'click',
      target: STAR,
      index: 0,
      expect: [{ selector: SLIDER, read: 'aria-valuenow', equals: '1' }],
    },
    {
      label: 'click 5th star → 5',
      action: 'click',
      target: STAR,
      index: 4,
      expect: [{ selector: SLIDER, read: 'aria-valuenow', equals: '5' }],
    },
  ],
}
