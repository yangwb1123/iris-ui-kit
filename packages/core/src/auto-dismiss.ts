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

interface AutoDismissClock {
  remaining: number
  runningSince: number
}

function createAutoDismissMachine(scheduler: Scheduler, onDismiss: () => void): AutoDismissMachine {
  return createMachine<AutoDismissState, Record<string, never>, AutoDismissEvent>({
    initial: 'idle',
    context: {},
    scheduler,
    states: {
      idle: { on: { START: { target: 'running' } } },
      running: {
        on: {
          PAUSE: { target: 'paused' },
          CANCEL: { target: 'idle' },
          TIMEOUT: { target: 'done' },
        },
      },
      paused: {
        on: { RESUME: { target: 'running' }, CANCEL: { target: 'idle' } },
      },
      done: { entry: [() => onDismiss()] },
    },
  })
}

interface AutoDismissTimer {
  isArmed(): boolean
  clear(): void
  arm(ms: number): void
}

function createAutoDismissTimer(
  scheduler: Scheduler,
  machine: AutoDismissMachine,
): AutoDismissTimer {
  let timer: unknown = null
  return {
    isArmed: () => timer !== null,
    clear() {
      if (timer === null) return
      scheduler.clearTimeout(timer)
      timer = null
    },
    arm(ms) {
      this.clear()
      timer = scheduler.setTimeout(() => {
        timer = null
        machine.send({ type: 'TIMEOUT' })
      }, ms)
    },
  }
}

function createAutoDismissControls(
  machine: AutoDismissMachine,
  timer: AutoDismissTimer,
  clock: AutoDismissClock,
  scheduler: Scheduler,
  duration: number,
  never: boolean,
): Pick<AutoDismiss, 'start' | 'pause' | 'resume' | 'cancel'> {
  const now = (): number => scheduler.now?.() ?? Date.now()
  return {
    start() {
      if (never) return
      clock.remaining = duration
      machine.send({ type: 'START' })
    },
    pause() {
      if (machine.store.getState().value !== 'running') return
      clock.remaining = Math.max(0, clock.remaining - (now() - clock.runningSince))
      machine.send({ type: 'PAUSE' })
    },
    resume() {
      if (machine.store.getState().value !== 'paused') return
      machine.send({ type: 'RESUME' })
    },
    cancel() {
      timer.clear()
      machine.send({ type: 'CANCEL' })
      machine.stop()
    },
  }
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
  const clock: AutoDismissClock = { remaining: duration, runningSince: 0 }
  const machine = createAutoDismissMachine(scheduler, onDismiss)

  // We can't key the `after` map by a *dynamic* remaining value in static config,
  // so we drive the running timer ourselves off the same injectable scheduler and
  // feed its expiry back through the machine as a TIMEOUT event. This keeps a
  // single source of truth (the machine) for state while honouring the
  // pause-preserves-elapsed contract.
  const timer = createAutoDismissTimer(scheduler, machine)

  // React to every state change: on entering `running` arm the remaining timer,
  // on leaving `running` cancel it (and capture elapsed on PAUSE).
  machine.store.subscribe(() => {
    const value = machine.store.getState().value
    if (value === 'running') {
      if (!timer.isArmed()) {
        clock.runningSince = now()
        timer.arm(clock.remaining)
      }
    } else {
      timer.clear()
    }
  })

  return {
    machine,
    state: () => machine.store.getState().value,
    ...createAutoDismissControls(machine, timer, clock, scheduler, duration, never),
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
