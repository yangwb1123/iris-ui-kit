import type { ContractScenario } from '../types'

const SLIDER = '[role="slider"]'

/**
 * Shared Slider keyboard behavior. Each adapter mounts a single-value slider with
 * `min=0 max=100 step=10` starting at `50` (React/Solid/Svelte `defaultValue={50}`;
 * Vue via a v-model harness holding `50`), then runs this. The `role="slider"`
 * thumb owns `aria-valuenow`; keyboard moves it: →/↑ +step, Home → min, End → max.
 * Asserts the four adapters share identical clamped keyboard arithmetic.
 */
export const sliderScenario: ContractScenario = {
  name: 'Slider',
  description: 'Keyboard: ArrowRight +step, End → max, Home → min, all on aria-valuenow.',
  steps: [
    {
      label: 'initial: 50',
      action: 'none',
      expect: [
        { selector: SLIDER, read: 'count', equals: 1 },
        { selector: SLIDER, read: 'aria-valuenow', equals: '50' },
      ],
    },
    {
      label: 'ArrowRight → 60',
      action: 'keydown',
      target: SLIDER,
      key: 'ArrowRight',
      expect: [{ selector: SLIDER, read: 'aria-valuenow', equals: '60' }],
    },
    {
      label: 'ArrowRight → 70',
      action: 'keydown',
      target: SLIDER,
      key: 'ArrowRight',
      expect: [{ selector: SLIDER, read: 'aria-valuenow', equals: '70' }],
    },
    {
      label: 'End → 100 (clamped to max)',
      action: 'keydown',
      target: SLIDER,
      key: 'End',
      expect: [{ selector: SLIDER, read: 'aria-valuenow', equals: '100' }],
    },
    {
      label: 'Home → 0 (clamped to min)',
      action: 'keydown',
      target: SLIDER,
      key: 'Home',
      expect: [{ selector: SLIDER, read: 'aria-valuenow', equals: '0' }],
    },
  ],
}
