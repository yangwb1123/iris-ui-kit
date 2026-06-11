import type { ContractScenario } from '../types'

const CHECKBOX = '[data-iris-checkbox] input'

/**
 * Shared Checkbox behavior. Each adapter mounts an uncontrolled IrisCheckbox
 * (initially unchecked) and runs this. Clicking toggles `aria-checked` on the
 * control inside `[data-iris-checkbox]`.
 */
export const checkboxScenario: ContractScenario = {
  name: 'Checkbox',
  description: 'Clicking an uncontrolled checkbox toggles aria-checked off→on→off.',
  steps: [
    {
      label: 'initial: unchecked',
      action: 'none',
      expect: [
        { selector: CHECKBOX, read: 'count', equals: 1 },
        { selector: CHECKBOX, read: 'aria-checked', equals: 'false' },
      ],
    },
    {
      label: 'click → checked',
      action: 'click',
      target: CHECKBOX,
      expect: [{ selector: CHECKBOX, read: 'aria-checked', equals: 'true' }],
    },
    {
      label: 'click → unchecked',
      action: 'click',
      target: CHECKBOX,
      expect: [{ selector: CHECKBOX, read: 'aria-checked', equals: 'false' }],
    },
  ],
}
