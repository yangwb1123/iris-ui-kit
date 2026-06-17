import type { ContractScenario } from '../types'

const DRAWER = '[role="dialog"][data-state="open"]'
const TRIGGER = '[data-iris-drawer-trigger]'

/**
 * Shared Drawer (slide-in panel) behavior. Each adapter mounts an uncontrolled
 * Drawer with `portalTarget={false}` (inline rendering — the contract driver's
 * `queryAll` is container-scoped). Drawer is modal (like Dialog): the trigger
 * only OPENS; Escape is the canonical close mechanism.
 * Because Drawer has an exit animation (the content stays in the DOM for the
 * animation duration after close), the selector uses `[data-state="open"]` to
 * distinguish the open state from the animating-out state.
 *
 * Scenario: closed → click trigger → open → Escape → closed
 * → click trigger → open → Escape → closed.
 */
export const drawerScenario: ContractScenario = {
  name: 'Drawer',
  description:
    'An uncontrolled drawer starts closed; clicking the trigger opens it; ' +
    'Escape closes it; clicking the trigger re-opens it; Escape closes it again.',
  steps: [
    {
      label: 'initial: closed',
      action: 'none',
      expect: [
        { selector: TRIGGER, read: 'count', equals: 1 },
        { selector: DRAWER, read: 'count', equals: 0 },
      ],
    },
    {
      label: 'click trigger → open',
      action: 'click',
      target: TRIGGER,
      expect: [
        { selector: DRAWER, read: 'count', equals: 1 },
        { selector: DRAWER, read: 'aria-modal', equals: 'true' },
      ],
    },
    {
      label: 'Escape → closed',
      action: 'keydown',
      target: DRAWER,
      key: 'Escape',
      expect: [{ selector: DRAWER, read: 'count', equals: 0 }],
    },
    {
      label: 'click trigger → open again',
      action: 'click',
      target: TRIGGER,
      expect: [{ selector: DRAWER, read: 'count', equals: 1 }],
    },
    {
      label: 'Escape → closed again',
      action: 'keydown',
      target: DRAWER,
      key: 'Escape',
      expect: [{ selector: DRAWER, read: 'count', equals: 0 }],
    },
  ],
}
