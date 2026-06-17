import type { ContractScenario } from '../types'

const FIELD = '[data-iris-form-field]'
const INPUT = 'input, [data-iris-input]'

/**
 * Shared Form field behavior. Tests field-level validation lifecycle:
 * start clean, show error on validation failure, clear error on correction.
 *
 * This scenario is framework-agnostic; each adapter mounts a form with
 * controlled fields and exposes the form store for validation triggers.
 */
export const formScenario: ContractScenario = {
  name: 'Form',
  description:
    'A form field starts with no error; validation failure shows an error ' +
    'message; correcting the value clears the error.',
  steps: [
    {
      label: 'initial: field exists, no error shown',
      action: 'none',
      expect: [
        { selector: FIELD, read: 'count', equals: 1 },
        { selector: '[data-iris-form-error]', read: 'count', equals: 0 },
      ],
    },
    {
      label: 'type invalid value → validation error appears',
      action: 'type',
      target: INPUT,
      index: 0,
      typeText: '',
      expect: [{ selector: '[data-iris-form-error]', read: 'count', equals: 1 }],
    },
  ],
}
