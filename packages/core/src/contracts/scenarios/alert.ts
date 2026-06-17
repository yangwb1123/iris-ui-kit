import type { ContractScenario } from '../types'

const ALERT = '[data-iris-alert]'
const CLOSE = '[data-iris-alert-close]'

/**
 * Shared Alert behavior. Each adapter mounts an uncontrolled IrisAlert with
 * `closable=true` and some content. The alert is initially visible; clicking
 * the close button dismisses it.
 *
 * Scenario: visible → click close → dismissed.
 */
export const alertScenario: ContractScenario = {
  name: 'Alert',
  description:
    'An uncontrolled closable alert starts visible; clicking the close ' + 'button dismisses it.',
  steps: [
    {
      label: 'initial: visible',
      action: 'none',
      expect: [
        { selector: ALERT, read: 'count', equals: 1 },
        { selector: CLOSE, read: 'count', equals: 1 },
      ],
    },
    {
      label: 'click close → dismissed',
      action: 'click',
      target: CLOSE,
      expect: [{ selector: ALERT, read: 'count', equals: 0 }],
    },
  ],
}
