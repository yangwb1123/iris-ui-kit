import type { ContractScenario } from '../types'

const STEP = '[data-iris-stepper-step]'
const TRIGGER = '[data-iris-stepper-step-trigger]'

/**
 * Shared Stepper behavior. Each adapter mounts a 3-step stepper with
 * `linear={false}` (so any step is directly clickable) starting on step 0
 * (React/Solid `defaultValue={0}`; Vue/Svelte a model harness holding `0`), then
 * runs this. Each step `<li>` carries `data-iris-stepper-step` + `aria-current`
 * ("step" on the active one only); its clickable `[data-iris-stepper-step-trigger]`
 * button activates it. Clicking a trigger moves `aria-current` to its step.
 * Asserts identical active-step tracking across all four adapters.
 */
export const stepperScenario: ContractScenario = {
  name: 'Stepper',
  description: 'Clicking a step trigger moves aria-current="step" to its step (non-linear).',
  steps: [
    {
      label: 'initial: step 0 active',
      action: 'none',
      expect: [
        { selector: TRIGGER, read: 'count', equals: 3 },
        { selector: STEP, index: 0, read: 'aria-current', equals: 'step' },
        { selector: STEP, index: 1, read: 'aria-current', equals: null },
        { selector: STEP, index: 2, read: 'aria-current', equals: null },
      ],
    },
    {
      label: 'click step 3 → active moves',
      action: 'click',
      target: TRIGGER,
      index: 2,
      expect: [
        { selector: STEP, index: 2, read: 'aria-current', equals: 'step' },
        { selector: STEP, index: 0, read: 'aria-current', equals: null },
      ],
    },
    {
      label: 'click step 2 → active moves',
      action: 'click',
      target: TRIGGER,
      index: 1,
      expect: [
        { selector: STEP, index: 1, read: 'aria-current', equals: 'step' },
        { selector: STEP, index: 2, read: 'aria-current', equals: null },
      ],
    },
  ],
}
