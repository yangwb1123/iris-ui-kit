import { createMachine, type Machine, type Scheduler } from './machine'

export type LongPressState = 'idle' | 'pressing' | 'fired'

export type LongPressEvent = { type: 'PRESS' } | { type: 'RELEASE' } | { type: 'CANCEL' }

export type LongPressMachine = Machine<LongPressState, Record<string, never>, LongPressEvent>

export interface LongPressOptions {
  /** Time the pointer must be held before `onLongPress` fires, in ms. */
  holdDelay: number
  /** Called once when the hold reaches `holdDelay` without an intervening release. */
  onLongPress: () => void
  /** Injectable timer; defaults to setTimeout/clearTimeout. Inject in tests. */
  scheduler?: Scheduler
}

export interface LongPress {
  machine: LongPressMachine
  /** Current machine state (`idle` | `pressing` | `fired`). */
  state(): LongPressState
  /** Pointer down: start the hold timer. */
  press(): void
  /** Pointer up: cancel a pending hold (no fire) or reset after a fired press. */
  release(): void
  /** Abort the gesture (pointer left / scroll) without firing. */
  cancel(): void
}

/**
 * A press-and-hold gesture built on the promoted statechart's `after` delayed
 * transition + injectable `Scheduler` — the timing PRIMITIVE for long-press /
 * press-hold interactions, so the timing lives in core instead of a hand-rolled
 * `setTimeout` in every component (the third member of the trio alongside
 * `createHoverIntent` and `createAutoDismiss`).
 *
 * Lifecycle:
 *   idle --PRESS--> pressing --after holdDelay--> fired   (fires onLongPress)
 *   pressing --RELEASE|CANCEL--> idle                     (released early: no fire)
 *   fired    --RELEASE|CANCEL--> idle                     (reset for the next press)
 *
 * The `after` timer is auto-cancelled the instant the machine leaves `pressing`
 * (the machine's exit-cancels-pending guarantee), so a release before `holdDelay`
 * never fires. A `holdDelay` of `Infinity` arms nothing (a press never escalates).
 * The injectable `scheduler` makes the timing deterministic in tests.
 */
export function createLongPress(options: LongPressOptions): LongPress {
  const { holdDelay, onLongPress } = options
  const armable = holdDelay !== Infinity && holdDelay >= 0

  const machine = createMachine<LongPressState, Record<string, never>, LongPressEvent>({
    initial: 'idle',
    context: {},
    scheduler: options.scheduler,
    states: {
      idle: {
        on: { PRESS: { target: 'pressing' } },
      },
      pressing: {
        ...(armable ? { after: { [holdDelay]: { target: 'fired' as const } } } : {}),
        on: {
          RELEASE: { target: 'idle' },
          CANCEL: { target: 'idle' },
        },
      },
      fired: {
        entry: [() => onLongPress()],
        on: {
          RELEASE: { target: 'idle' },
          CANCEL: { target: 'idle' },
        },
      },
    },
  })

  return {
    machine,
    state: () => machine.store.getState().value,
    press: () => machine.send({ type: 'PRESS' }),
    release: () => machine.send({ type: 'RELEASE' }),
    cancel: () => machine.send({ type: 'CANCEL' }),
  }
}
