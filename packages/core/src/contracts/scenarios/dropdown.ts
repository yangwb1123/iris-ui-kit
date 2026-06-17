import type { ContractScenario } from '../types'

const MENU = '[role="menu"]'
const TRIGGER = '[data-iris-dropdown-trigger]'

/**
 * Shared Dropdown (popup menu) behavior. Each adapter mounts an uncontrolled
 * Dropdown with `portalTarget={false}` (inline rendering) so the contract
 * driver can query within the container. Dropdown is a non-modal overlay:
 * the trigger TOGGLES (click opens AND closes); Escape is the keyboard
 * dismiss mechanism.
 *
 * Scenario: closed → click trigger → open → click trigger → closed
 * → click trigger → open → Escape → closed.
 */
export const dropdownScenario: ContractScenario = {
  name: 'Dropdown',
  description:
    'An uncontrolled dropdown starts closed; clicking the trigger opens it; ' +
    'clicking the trigger again closes it; ' +
    'clicking the trigger opens it again; Escape closes it.',
  steps: [
    {
      label: 'initial: closed',
      action: 'none',
      expect: [
        { selector: TRIGGER, read: 'count', equals: 1 },
        { selector: MENU, read: 'count', equals: 0 },
      ],
    },
    {
      label: 'click trigger → open',
      action: 'click',
      target: TRIGGER,
      expect: [{ selector: MENU, read: 'count', equals: 1 }],
    },
    {
      label: 'click trigger again → closed (toggle)',
      action: 'click',
      target: TRIGGER,
      expect: [{ selector: MENU, read: 'count', equals: 0 }],
    },
    {
      label: 'click trigger → open again',
      action: 'click',
      target: TRIGGER,
      expect: [{ selector: MENU, read: 'count', equals: 1 }],
    },
    {
      label: 'Escape → closed',
      action: 'keydown',
      target: MENU,
      key: 'Escape',
      expect: [{ selector: MENU, read: 'count', equals: 0 }],
    },
  ],
}
