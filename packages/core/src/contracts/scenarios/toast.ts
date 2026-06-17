import type { ContractScenario } from '../types'

const VIEWPORT = '[data-iris-toast-viewport]'
const TOAST = '[data-iris-toast]'
const PUSH_BTN = '[data-iris-toast-push]'
const DISMISS_BTN = `${TOAST} button[aria-label=Dismiss]`

/**
 * Shared Toast notification behavior. Each adapter mounts an inline
 * IrisToastViewport (portalTarget={false}) plus a `<button data-iris-toast-push>`
 * that calls `pushToast({ title: 'Hello Toast' })` on click — bridging the
 * programmatic push API into a declarative DOM interaction the contract driver
 * can replay.
 *
 * Scenario: empty viewport → click push → toast appears with title + role
 * → click dismiss → toast gone.
 *
 * Note: Toast uses a global module-level store (no context provider needed),
 * and each adapter's test resets the store via `clearToasts()` in afterEach
 * to avoid cross-test leakage.
 */
export const toastScenario: ContractScenario = {
  name: 'Toast',
  description:
    'An inline viewport starts empty; clicking the push button adds a toast with ' +
    'title and role="status"; clicking the dismiss × button removes it.',
  steps: [
    {
      label: 'initial: viewport visible, no toasts',
      action: 'none',
      expect: [
        { selector: VIEWPORT, read: 'count', equals: 1 },
        { selector: TOAST, read: 'count', equals: 0 },
      ],
    },
    {
      label: 'click push → toast appears',
      action: 'click',
      target: PUSH_BTN,
      expect: [
        { selector: TOAST, read: 'count', equals: 1 },
        { selector: TOAST, read: 'role', equals: 'status' },
      ],
    },
    {
      label: 'click dismiss × → toast gone',
      action: 'click',
      target: DISMISS_BTN,
      expect: [{ selector: TOAST, read: 'count', equals: 0 }],
    },
  ],
}
