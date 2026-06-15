import { createMachine, type Machine, type Scheduler } from './machine'

export type HoverIntentState = 'closed' | 'opening' | 'open' | 'closing'

export type HoverIntentEvent =
  | { type: 'POINTER_ENTER' }
  | { type: 'POINTER_LEAVE' }
  | { type: 'FORCE_OPEN' }
  | { type: 'FORCE_CLOSE' }

export type HoverIntentMachine = Machine<HoverIntentState, Record<string, never>, HoverIntentEvent>

export interface HoverIntentOptions {
  /** Hover dwell before opening (ms). Default 0 (open immediately). */
  openDelay?: number
  /** Grace period before closing after the pointer leaves (ms). Default 0. */
  closeDelay?: number
  /** Injectable timer; defaults to setTimeout/clearTimeout. Inject in tests. */
  scheduler?: Scheduler
}

export interface HoverIntent {
  machine: HoverIntentMachine
  /** True while `value` is `open` OR `closing` (i.e. the surface is showing). */
  isOpen(): boolean
  /** Pointer entered the trigger/surface — arms the open intent. */
  pointerEnter(): void
  /** Pointer left — arms the close-grace intent. */
  pointerLeave(): void
  /** Bypass the delays and open/close now (e.g. focus, Escape). */
  open(): void
  close(): void
  /** Cancel pending timers and detach. Call on unmount. */
  stop(): void
}

/**
 * Hover-intent disclosure built entirely on the promoted statechart's `after`
 * delayed transitions — the demonstrative timing PRIMITIVE for v3 R18. It proves
 * interaction TIMING (open-on-dwell, close-on-grace) can live in core instead of
 * the hand-rolled setTimeout that Tooltip/Toast/longpress carry today.
 *
 * Lifecycle:
 *   closed  --POINTER_ENTER-->  opening  --after openDelay-->  open
 *   open    --POINTER_LEAVE-->  closing  --after closeDelay--> closed
 * Re-entering during the grace period (`closing --POINTER_ENTER--> open`) cancels
 * the pending close — that re-entry-cancels-pending behavior is exactly the
 * `after` auto-cancel-on-exit guarantee, and the reason it lives in the machine
 * rather than scattered timers. `FORCE_OPEN`/`FORCE_CLOSE` bypass the delays.
 *
 * The injectable `scheduler` makes the timing deterministic in tests (no
 * real-time waits, no jsdom flake — the flaky-Solid-tooltip cautionary tale).
 *
 * DEFERRED (v3 R18): wiring this into the shipped Tooltip/Toast across the four
 * framework adapters is intentionally NOT done here — those ship hand-rolled
 * setTimeout and replacing it risks regressing live timing. This primitive is
 * the opt-in sink demonstration; adoption is a separate, scoped follow-up.
 */
export function createHoverIntent(options: HoverIntentOptions = {}): HoverIntent {
  const openDelay = options.openDelay ?? 0
  const closeDelay = options.closeDelay ?? 0

  const machine = createMachine<HoverIntentState, Record<string, never>, HoverIntentEvent>({
    initial: 'closed',
    context: {},
    scheduler: options.scheduler,
    states: {
      closed: {
        on: {
          POINTER_ENTER: { target: 'opening' },
          FORCE_OPEN: { target: 'open' },
        },
      },
      opening: {
        // Dwell, then open. Leaving (POINTER_LEAVE) auto-cancels this timer.
        after: { [openDelay]: { target: 'open' } },
        on: {
          POINTER_LEAVE: { target: 'closed' },
          FORCE_OPEN: { target: 'open' },
          FORCE_CLOSE: { target: 'closed' },
        },
      },
      open: {
        on: {
          POINTER_LEAVE: { target: 'closing' },
          FORCE_CLOSE: { target: 'closed' },
        },
      },
      closing: {
        // Grace period, then close. Re-entering (POINTER_ENTER) cancels the close.
        after: { [closeDelay]: { target: 'closed' } },
        on: {
          POINTER_ENTER: { target: 'open' },
          FORCE_OPEN: { target: 'open' },
          FORCE_CLOSE: { target: 'closed' },
        },
      },
    },
  })

  return {
    machine,
    isOpen: () => {
      const v = machine.store.getState().value
      return v === 'open' || v === 'closing'
    },
    pointerEnter: () => machine.send({ type: 'POINTER_ENTER' }),
    pointerLeave: () => machine.send({ type: 'POINTER_LEAVE' }),
    open: () => machine.send({ type: 'FORCE_OPEN' }),
    close: () => machine.send({ type: 'FORCE_CLOSE' }),
    stop: () => machine.stop(),
  }
}
