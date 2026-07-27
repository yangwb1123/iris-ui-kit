import { createMachine, type Machine } from './machine'

export type FloatingState = 'closed' | 'open'

export type FloatingEvent = { type: 'OPEN' } | { type: 'CLOSE' } | { type: 'TOGGLE' }

export type FloatingMachine = Machine<FloatingState, Record<string, never>, FloatingEvent>

/**
 * A tiny binary state machine for any "open / closed" surface — Popover,
 * Tooltip, Dialog, Dropdown, Menu, etc. Kept intentionally degenerate (no
 * context) so each consumer can wrap it with its own context-rich machine
 * when needed. The shared machine guarantees uniform event semantics across
 * primitives:
 *
 *   - `OPEN`   → forces open
 *   - `CLOSE`  → forces closed
 *   - `TOGGLE` → flips state
 *
 * Adapters bridge the resulting store into framework reactivity via
 * `useMachine`. The DOM-level positioning is handled separately by the
 * framework adapter (e.g. `useFloating` in `@iris-ui-kit/vue`).
 */
export function createFloatingMachine(initial: FloatingState = 'closed'): FloatingMachine {
  return createMachine<FloatingState, Record<string, never>, FloatingEvent>({
    initial,
    context: {},
    states: {
      closed: {
        on: {
          OPEN: { target: 'open' },
          TOGGLE: { target: 'open' },
        },
      },
      open: {
        on: {
          CLOSE: { target: 'closed' },
          TOGGLE: { target: 'closed' },
        },
      },
    },
  })
}
