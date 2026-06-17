import type { ContractScenario } from '../types'

const TOOLTIP = '[role="tooltip"]'
const TRIGGER = '[data-iris-tooltip-trigger]'

/**
 * Shared Tooltip behavior. Each adapter mounts an uncontrolled Tooltip with
 * `openDelay={0}` (instant) and no portal (inline rendering) so the contract
 * driver can query within the container. Tooltip appears on pointer-enter
 * (or focus) and disappears on pointer-leave (or blur).
 *
 * Scenario: closed → pointer enter → open → pointer leave → closed.
 */
export const tooltipScenario: ContractScenario = {
  name: 'Tooltip',
  description:
    'An uncontrolled tooltip starts closed; pointer-enter opens it; ' + 'pointer-leave closes it.',
  steps: [
    {
      label: 'initial: closed',
      action: 'none',
      expect: [
        { selector: TRIGGER, read: 'count', equals: 1 },
        { selector: TOOLTIP, read: 'count', equals: 0 },
      ],
    },
    {
      label: 'pointer enter → open',
      action: 'pointer',
      target: TRIGGER,
      pointerEvent: 'enter',
      expect: [{ selector: TOOLTIP, read: 'count', equals: 1 }],
    },
    {
      label: 'pointer leave → closed',
      action: 'pointer',
      target: TRIGGER,
      pointerEvent: 'leave',
      expect: [{ selector: TOOLTIP, read: 'count', equals: 0 }],
    },
  ],
}
