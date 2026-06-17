import type { ContractScenario } from '../types'

const FIELD = '[data-iris-form-field]'

/**
 * Shared Form field behavior. Tests that a form field renders correctly.
 * Framework adapters mount a form with validation configured.
 */
export const formScenario: ContractScenario = {
  name: 'Form',
  description: 'A form field renders with the correct structure.',
  steps: [
    {
      label: 'initial: field exists',
      action: 'none',
      expect: [{ selector: FIELD, read: 'count', equals: 1 }],
    },
  ],
}
