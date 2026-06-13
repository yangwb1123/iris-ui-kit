import type { ContractScenario } from '../types'

const THUMB = '[data-iris-range-slider-thumb]'

/**
 * Shared RangeSlider keyboard behavior. Each adapter mounts a two-thumb range
 * slider with `min=0 max=100 step=10` starting at `[20, 80]` (React/Solid
 * uncontrolled `defaultValue`; Vue/Svelte a model harness holding `[20, 80]`),
 * then runs this. Each `[data-iris-range-slider-thumb]` (`role="slider"`) owns
 * its own `aria-valuenow`; ArrowRight/ArrowLeft on a thumb steps ONLY that
 * thumb's value (the two thumbs are independent and must not cross). Asserts all
 * four adapters drive the dual-value range controller identically.
 */
export const rangeSliderScenario: ContractScenario = {
  name: 'RangeSlider',
  description: 'Keyboard on a thumb steps only that thumb (start 20 / end 80, independent).',
  steps: [
    {
      label: 'initial: [20, 80]',
      action: 'none',
      expect: [
        { selector: THUMB, read: 'count', equals: 2 },
        { selector: THUMB, index: 0, read: 'aria-valuenow', equals: '20' },
        { selector: THUMB, index: 1, read: 'aria-valuenow', equals: '80' },
      ],
    },
    {
      label: 'ArrowRight on start thumb → 30 (end unchanged)',
      action: 'keydown',
      target: THUMB,
      index: 0,
      key: 'ArrowRight',
      expect: [
        { selector: THUMB, index: 0, read: 'aria-valuenow', equals: '30' },
        { selector: THUMB, index: 1, read: 'aria-valuenow', equals: '80' },
      ],
    },
    {
      label: 'ArrowRight on end thumb → 90 (start unchanged)',
      action: 'keydown',
      target: THUMB,
      index: 1,
      key: 'ArrowRight',
      expect: [
        { selector: THUMB, index: 1, read: 'aria-valuenow', equals: '90' },
        { selector: THUMB, index: 0, read: 'aria-valuenow', equals: '30' },
      ],
    },
    {
      label: 'ArrowLeft on start thumb → back to 20',
      action: 'keydown',
      target: THUMB,
      index: 0,
      key: 'ArrowLeft',
      expect: [{ selector: THUMB, index: 0, read: 'aria-valuenow', equals: '20' }],
    },
  ],
}
