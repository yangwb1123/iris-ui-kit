import type { ContractScenario } from '../types'

const SWITCH = '[role="switch"]'

/**
 * Shared Switch behavior. Each adapter mounts a switch wired to toggle on click
 * (React/Solid/Svelte uncontrolled; Vue via a v-model harness) starting off, and
 * runs this. Clicking toggles `aria-checked` on the `role="switch"` control.
 */
export const switchScenario: ContractScenario = {
  name: 'Switch',
  description: 'Clicking an uncontrolled switch toggles aria-checked off→on→off.',
  steps: [
    {
      label: 'initial: off',
      action: 'none',
      expect: [
        { selector: SWITCH, read: 'count', equals: 1 },
        { selector: SWITCH, read: 'aria-checked', equals: 'false' },
      ],
    },
    {
      label: 'click → on',
      action: 'click',
      target: SWITCH,
      expect: [{ selector: SWITCH, read: 'aria-checked', equals: 'true' }],
    },
    {
      label: 'click → off',
      action: 'click',
      target: SWITCH,
      expect: [{ selector: SWITCH, read: 'aria-checked', equals: 'false' }],
    },
  ],
}
