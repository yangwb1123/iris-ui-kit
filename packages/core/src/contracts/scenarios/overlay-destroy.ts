import type { ContractScenario } from '../types'

const DLG = '[role="dialog"]'
const TRIGGER = '[data-iris-dialog-trigger]'

/**
 * Shared overlay DESTROY / UNMOUNT-CLEANUP behavior (modal Dialog).
 *
 * Overlays typically portal their surface to `document.body`. If the adapter's
 * teardown leaks that portaled node when the component unmounts, a long-lived app
 * accumulates orphaned `role="dialog"` nodes (focus traps, scroll locks, stale
 * ARIA). This contract opens an overlay, then UNMOUNTS the whole component and
 * asserts no role-bearing node remains in the document.
 *
 * Observability needs no portal-disable prop: both assertions are document-scoped
 * (`global: true`), counting `role="dialog"` in the WHOLE document (so a portaled
 * surface is counted while open and its absence is verified after unmount).
 *
 * Each adapter mounts the overlay portaling to `document.body` (its default —
 * NOT `portalTarget={false}`), so this genuinely exercises portal cleanup.
 * Sequence:
 *   click trigger → overlay open; exactly one role="dialog" exists in the document
 *   unmount       → component torn down; zero role="dialog" remain (no leak)
 */
export const overlayDestroyScenario: ContractScenario = {
  name: 'OverlayDestroy',
  description:
    'Opening then unmounting an overlay leaves no leaked role-bearing nodes ' +
    '(role="dialog") in the document — portal cleanup runs on destroy.',
  steps: [
    {
      label: 'click trigger → overlay open; one role="dialog" in document',
      action: 'click',
      target: TRIGGER,
      expect: [{ selector: DLG, read: 'count', equals: 1, global: true }],
    },
    {
      label: 'unmount → no role="dialog" leaks in document.body',
      action: 'unmount',
      expect: [{ selector: DLG, read: 'count', equals: 0, global: true }],
    },
  ],
}
