import type { ContractScenario } from '../types'

const SPIN = '[role="spinbutton"]'
const INC = '[data-iris-number-input-inc]'
const DEC = '[data-iris-number-input-dec]'

/**
 * Shared NumberInput behavior. Each adapter mounts a spinbutton starting at `5`
 * with `step=1 min=0 max=10` (React/Solid `defaultValue={5}`; Vue/Svelte via a
 * model harness holding `5`), then runs this. The `role="spinbutton"` control
 * owns `aria-valuenow`; clicking the increment/decrement buttons steps it. All
 * four adapters must share identical step arithmetic.
 */
export const numberInputScenario: ContractScenario = {
  name: 'NumberInput',
  description: 'Clicking inc/dec steps the spinbutton aria-valuenow by `step` (5→6→7→6).',
  steps: [
    {
      label: 'initial: 5',
      action: 'none',
      expect: [
        { selector: SPIN, read: 'count', equals: 1 },
        { selector: SPIN, read: 'aria-valuenow', equals: '5' },
      ],
    },
    {
      label: 'increment → 6',
      action: 'click',
      target: INC,
      expect: [{ selector: SPIN, read: 'aria-valuenow', equals: '6' }],
    },
    {
      label: 'increment → 7',
      action: 'click',
      target: INC,
      expect: [{ selector: SPIN, read: 'aria-valuenow', equals: '7' }],
    },
    {
      label: 'decrement → 6',
      action: 'click',
      target: DEC,
      expect: [{ selector: SPIN, read: 'aria-valuenow', equals: '6' }],
    },
  ],
}
