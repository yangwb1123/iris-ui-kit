import type { ContractScenario } from '../types'

const DLG = '[role="dialog"]'
const TRIGGER = '[data-iris-dialog-trigger]'

/**
 * Shared Dialog behavior. Each adapter mounts a minimal uncontrolled Dialog
 * with `closeOnOutsideClick={false}` and `portalTarget={false}` (inline
 * rendering — the contract driver's `queryAll` is container-scoped). The
 * scenario exercises: initial closed → click trigger opens → Escape closes
 * → click trigger re-opens → Escape closes again.
 *
 * Note: Dialog is modal — the trigger only opens, never closes. Escape is
 * the canonical close mechanism (or a dedicated close button, not tested here).
 */
export const dialogScenario: ContractScenario = {
  name: 'Dialog',
  description:
    'An uncontrolled dialog starts closed; clicking the trigger opens it; ' +
    'Escape closes it; clicking the trigger re-opens it; Escape closes it again.',
  steps: [
    {
      label: 'initial: closed',
      action: 'none',
      expect: [
        { selector: TRIGGER, read: 'count', equals: 1 },
        { selector: DLG, read: 'count', equals: 0 },
      ],
    },
    {
      label: 'click trigger → open',
      action: 'click',
      target: TRIGGER,
      expect: [
        { selector: DLG, read: 'count', equals: 1 },
        { selector: DLG, read: 'aria-modal', equals: 'true' },
      ],
    },
    {
      label: 'Escape → closed',
      action: 'keydown',
      target: DLG,
      key: 'Escape',
      expect: [{ selector: DLG, read: 'count', equals: 0 }],
    },
    {
      label: 'click trigger → open again',
      action: 'click',
      target: TRIGGER,
      expect: [{ selector: DLG, read: 'count', equals: 1 }],
    },
    {
      label: 'Escape → closed again',
      action: 'keydown',
      target: DLG,
      key: 'Escape',
      expect: [{ selector: DLG, read: 'count', equals: 0 }],
    },
  ],
}
