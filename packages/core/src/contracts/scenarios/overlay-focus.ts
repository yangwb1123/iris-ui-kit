import type { ContractScenario } from '../types'

const DLG = '[role="dialog"]'
const TRIGGER = '[data-iris-dialog-trigger]'

/**
 * Shared overlay FOCUS-LIFECYCLE behavior (modal Dialog).
 *
 * A correct modal moves focus OFF the trigger and INTO the overlay on open, then
 * RESTORES focus to the trigger when dismissed (Escape). This is observable with
 * NO portal-content access: `document.activeElement` is global (jsdom tracks it)
 * and the trigger stays in the container, so the contract reads `focused` on the
 * in-container trigger only — it never needs to see the (possibly portaled)
 * overlay body. That is why this scenario needs no portal-disable public prop.
 *
 * Each adapter mounts a focusable trigger + the overlay (Dialog with
 * `closeOnOutsideClick={false}`). Sequence:
 *   click trigger → opens; focus has left the trigger (focused === 'false')
 *   Escape       → closes; focus is restored to the trigger (focused === 'true')
 *
 * If a framework genuinely fails to restore focus on dismiss, the second step
 * fails — surfacing a real focus-management bug, not a harness gap.
 */
export const overlayFocusScenario: ContractScenario = {
  name: 'OverlayFocus',
  description:
    'Opening a modal overlay moves focus off the trigger and into the overlay; ' +
    'dismissing with Escape restores focus to the trigger.',
  steps: [
    {
      label: 'click trigger → opens; focus leaves the trigger',
      action: 'click',
      target: TRIGGER,
      expect: [
        { selector: DLG, read: 'count', equals: 1 },
        // Focus moved into the overlay, so the trigger is no longer focused.
        { selector: TRIGGER, read: 'focused', equals: 'false' },
      ],
    },
    {
      label: 'Escape → closes; focus is restored to the trigger',
      action: 'keydown',
      target: DLG,
      key: 'Escape',
      expect: [
        { selector: DLG, read: 'count', equals: 0 },
        // Dismissing restores focus to the trigger that opened the overlay.
        { selector: TRIGGER, read: 'focused', equals: 'true' },
      ],
    },
  ],
}
