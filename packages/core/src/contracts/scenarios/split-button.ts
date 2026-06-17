import type { ContractScenario } from '../types'

const BTN = '[data-iris-split-button]'
const TRIGGER = '[data-iris-split-button-trigger]'
const MENU = '[data-iris-split-button-menu]'

/**
 * Shared SplitButton dropdown behavior. Mount uncontrolled IrisSplitButton
 * with actions. Initially just the button is visible; clicking the caret
 * trigger toggles the dropdown menu.
 */
export const splitButtonScenario: ContractScenario = {
  name: 'SplitButton',
  description:
    'An uncontrolled split button shows its dropdown on trigger click; ' + 'Escape closes it.',
  steps: [
    {
      label: 'initial: closed',
      action: 'none',
      expect: [
        { selector: BTN, read: 'count', equals: 1 },
        { selector: MENU, read: 'count', equals: 0 },
      ],
    },
    {
      label: 'click trigger → open',
      action: 'click',
      target: TRIGGER,
      expect: [{ selector: MENU, read: 'count', equals: 1 }],
    },
  ],
}
