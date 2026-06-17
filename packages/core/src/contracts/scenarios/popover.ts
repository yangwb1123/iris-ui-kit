import type { ContractScenario } from '../types'

const POPOVER = '[role="dialog"]'
const TRIGGER = '[data-iris-popover-trigger]'

/**
 * Shared Popover (non-modal floating surface) behavior. Each adapter mounts an
 * uncontrolled Popover with `portalTarget={false}` (inline rendering) so the
 * contract driver can query within the container. Popover differs from Dialog
 * in that the trigger TOGGLES (click opens AND closes, unlike Dialog's trigger
 * which only opens). Escape and outside-pointerdown are the canonical dismiss
 * mechanisms.
 *
 * Scenario: closed → click trigger → open → click trigger → closed
 * → click trigger → open → Escape → closed.
 */
export const popoverScenario: ContractScenario = {
  name: 'Popover',
  description:
    'An uncontrolled popover starts closed; clicking the trigger opens it; ' +
    'clicking the trigger again closes it; ' +
    'clicking the trigger opens it again; Escape closes it.',
  steps: [
    {
      label: 'initial: closed',
      action: 'none',
      expect: [
        { selector: TRIGGER, read: 'count', equals: 1 },
        { selector: POPOVER, read: 'count', equals: 0 },
      ],
    },
    {
      label: 'click trigger → open',
      action: 'click',
      target: TRIGGER,
      expect: [{ selector: POPOVER, read: 'count', equals: 1 }],
    },
    {
      label: 'click trigger again → closed (toggle)',
      action: 'click',
      target: TRIGGER,
      expect: [{ selector: POPOVER, read: 'count', equals: 0 }],
    },
    {
      label: 'click trigger → open again',
      action: 'click',
      target: TRIGGER,
      expect: [{ selector: POPOVER, read: 'count', equals: 1 }],
    },
    {
      label: 'Escape → closed',
      action: 'keydown',
      target: POPOVER,
      key: 'Escape',
      expect: [{ selector: POPOVER, read: 'count', equals: 0 }],
    },
  ],
}
