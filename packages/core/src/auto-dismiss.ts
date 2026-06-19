import { createMachine, type Machine, type Scheduler } from './machine'

export type AutoDismissState = 'idle' | 'running' | 'paused' | 'done'

export type AutoDismissEvent =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'CANCEL' }
  | { type: 'TIMEOUT' }

export type AutoDismissMachine = Machine<AutoDismissState, Record<string, never>, AutoDismissEvent>

export interface AutoDismissOptions {
  /**
   * Total time in the running state before `onDismiss` fires, in ms. A value of
   * `Infinity` or `0` means "never auto-dismiss" — the timer is never armed.
   */
  duration: number
  /** Called once, when the running clock reaches `duration`. */
  onDismiss: () => void
  /** Injectable timer; defaults to setTimeout/clearTimeout. Inject in tests. */
  scheduler?: Scheduler
}

export interface AutoDismiss {
  machine: AutoDismissMachine
  /** Current machine state value (`idle` | `running` | `paused` | `done`). */
  state(): AutoDismissState
  /** Arm the timer. From `idle` it begins the full `duration` countdown. */
  start(): void
  /** Stop the clock, preserving elapsed time. No-op unless `running`. */
  pause(): void
  /** Continue counting down for the time that was remaining at `pause()`. */
  resume(): void
  /** Detach permanently: cancels any pending timer and disables further timing. */
  cancel(): void
}

/**
 * A single timed dismiss built on the promoted statechart's `after` delayed
 * transitions + injectable `Scheduler` — the timing PRIMITIVE behind Toast
 * auto-dismiss (and any "do X after N ms, but pause on hover" interaction). It
 * replaces the hand-rolled `setTimeout` Map that toast viewports carry today.
 *
 * Lifecycle:
 *   idle  --START-->  running  --after remaining--> done  (fires onDismiss)
 *   running  --PAUSE-->  paused                 (clock stops, elapsed preserved)
 *   paused   --RESUME--> running                (counts down the leftover only)
 *   any      --CANCEL--> idle/done detached     (no fire)
 *
 * The `after` timer is auto-cancelled the instant the machine leaves `running`
 * (the machine's exit-cancels-pending guarantee), so PAUSE stops the clock for
 * free. RESUME re-enters `running` with a freshly-computed remaining delay, which
 * is why elapsed time is preserved across a pause without any manual timer math
 * in the consumer.
 *
 * `duration` of `Infinity` or `0` arms nothing — `start()` parks in `idle`
 * (the timer never fires), matching Toast's "duration: 0 = persistent" contract.
 *
 * The injectable `scheduler` makes the timing deterministic in tests (no
 * real-time waits, no jsdom flake — the flaky-Solid-tooltip cautionary tale).
 */
export function createAutoDismiss(options: AutoDismissOptions): AutoDismiss {
  const { duration, onDismiss } = options
  const scheduler = options.scheduler ?? defaultClockScheduler()
  const never = duration === Infinity || duration <= 0

  // Wall-clock derived from the SAME scheduler so pause/resume math is
  // deterministic under a fake scheduler (which never touches Date.now()).
  // We tick a monotonic clock off the scheduler's setTimeout(0) ordering would
  // be unreliable; instead we read it through a `now()` the scheduler exposes,
  // falling back to Date.now() for the real scheduler.
  const now = (): number => scheduler.now?.() ?? Date.now()

  // Remaining ms to count down on the next entry into `running`. Begins as the
  // full duration; PAUSE decrements it by the elapsed slice.
  let remaining = duration
  // Timestamp (clock) of the last entry into `running`; used to compute elapsed.
  let runningSince = 0

  const machine = createMachine<AutoDismissState, Record<string, never>, AutoDismissEvent>({
    initial: 'idle',
    context: {},
    scheduler,
    states: {
      idle: {
        on: { START: { target: 'running' } },
      },
      running: {
        on: {
          PAUSE: { target: 'paused' },
          CANCEL: { target: 'idle' },
          // TIMEOUT is the synthetic event we send from the after-timer; routing
          // it through `send` (rather than a direct `after.target`) lets us run
          // the onDismiss side-effect in one place via the `done` entry.
          TIMEOUT: { target: 'done' },
        },
      },
      paused: {
        on: {
          RESUME: { target: 'running' },
          CANCEL: { target: 'idle' },
        },
      },
      done: {
        // Terminal. Entry fires the dismiss callback exactly once.
        entry: [() => onDismiss()],
      },
    },
  })

  // We can't key the `after` map by a *dynamic* remaining value in static config,
  // so we drive the running timer ourselves off the same injectable scheduler and
  // feed its expiry back through the machine as a TIMEOUT event. This keeps a
  // single source of truth (the machine) for state while honouring the
  // pause-preserves-elapsed contract.
  let timer: unknown = null
  const clearTimer = (): void => {
    if (timer !== null) {
      scheduler.clearTimeout(timer)
      timer = null
    }
  }
  const armTimer = (ms: number): void => {
    clearTimer()
    timer = scheduler.setTimeout(() => {
      timer = null
      machine.send({ type: 'TIMEOUT' })
    }, ms)
  }

  // React to every state change: on entering `running` arm the remaining timer,
  // on leaving `running` cancel it (and capture elapsed on PAUSE).
  machine.store.subscribe(() => {
    const value = machine.store.getState().value
    if (value === 'running') {
      if (timer === null) {
        runningSince = now()
        armTimer(remaining)
      }
    } else {
      clearTimer()
    }
  })

  function start(): void {
    if (never) return // never arm; park in idle (persistent)
    remaining = duration
    machine.send({ type: 'START' })
  }

  function pause(): void {
    if (machine.store.getState().value !== 'running') return
    // Capture how much of `remaining` is left before the transition cancels the
    // timer (the store subscriber will clear it on leaving `running`).
    const elapsed = now() - runningSince
    remaining = Math.max(0, remaining - elapsed)
    machine.send({ type: 'PAUSE' })
  }

  function resume(): void {
    if (machine.store.getState().value !== 'paused') return
    machine.send({ type: 'RESUME' })
  }

  function cancel(): void {
    clearTimer()
    machine.send({ type: 'CANCEL' })
    machine.stop()
  }

  return {
    machine,
    state: () => machine.store.getState().value,
    start,
    pause,
    resume,
    cancel,
  }
}

/**
 * The default scheduler used when none is injected. It augments the global timer
 * with a `now()` reading `Date.now()` so the pause/resume elapsed math has a
 * real clock. (Tests inject a fake scheduler that supplies its own `now()`.)
 */
function defaultClockScheduler(): Scheduler {
  return {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    now: () => Date.now(),
  }
}
