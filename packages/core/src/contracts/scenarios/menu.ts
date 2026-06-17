import type { ContractScenario } from '../types'

const MENU = '[role="menu"]'
const TRIGGER = '[aria-haspopup="menu"]'

/**
 * Shared Menu (popup menu) behavior. Each adapter mounts an uncontrolled
 * IrisMenu with portal disabled (inline rendering). Tests the overlay
 * lifecycle: closed initially, opens on trigger click, closes on Escape.
 *
 * Scenario: closed → click trigger → open → Escape → closed.
 */
export const menuScenario: ContractScenario = {
  name: 'Menu',
  description:
    'An uncontrolled menu starts closed; clicking the trigger opens it; ' + 'Escape closes it.',
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
      label: 'Escape → closed',
      action: 'keydown',
      target: MENU,
      key: 'Escape',
      expect: [{ selector: MENU, read: 'count', equals: 0 }],
    },
  ],
}
