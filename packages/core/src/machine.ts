import { createStore, type Store } from './store'

export type MachineEvent = { type: string }

export interface MachineState<TState extends string, TContext> {
  value: TState
  context: TContext
}

/** An entry/exit side-effect callback. Receives the live context and the event
 * that caused the (re)entry/exit. Keep these simple — synchronous callbacks for
 * side effects (logging, focus, notifying). They do NOT update context (use a
 * transition's `actions` for that). The event is the machine event that drove
 * the transition; on initial entry it is the synthetic `{ type: 'xstate.init' }`. */
export type Action<TContext, TEvent extends MachineEvent> = (
  context: TContext,
  event: TEvent | InitEvent,
) => void

/** Synthetic event dispatched for the initial-state entry actions. */
export type InitEvent = { type: 'xstate.init' }
const INIT_EVENT: InitEvent = { type: 'xstate.init' }

export interface Transition<TState extends string, TContext, TEvent extends MachineEvent> {
  /** Target state to transition to. If absent, the transition only runs actions. */
  target?: TState
  /** Optional guard: returns true to permit the transition. */
  guard?: (context: TContext, event: TEvent) => boolean
  /** Optional context updates applied when this transition fires. */
  actions?: (context: TContext, event: TEvent) => Partial<TContext> | void
}

/**
 * A delayed (`after`) transition. Same shape as an event transition, but its
 * guard/actions receive the synthetic `InitEvent` (the timer is not driven by a
 * user event). Scheduled on ENTERING the owning state; AUTO-CANCELLED the moment
 * the machine leaves that state.
 */
export interface DelayedTransition<TState extends string, TContext> {
  target?: TState
  guard?: (context: TContext, event: InitEvent) => boolean
  actions?: (context: TContext, event: InitEvent) => Partial<TContext> | void
}

export type StateNode<TState extends string, TContext, TEvent extends MachineEvent> = {
  /** Event-driven transitions for this state. */
  on?: {
    [K in TEvent['type']]?: Transition<TState, TContext, Extract<TEvent, { type: K }>>
  }
  /**
   * Delayed transitions, keyed by delay in milliseconds. Scheduled when the
   * machine ENTERS this state and auto-cancelled when it LEAVES (any cause).
   * Multiple delays may be declared; each is an independent timer.
   */
  after?: Record<number, DelayedTransition<TState, TContext>>
  /** Side-effect actions run when this state is ENTERED (incl. initial entry). */
  entry?: Action<TContext, TEvent>[]
  /** Side-effect actions run when this state is LEFT (any transition out). */
  exit?: Action<TContext, TEvent>[]
  /**
   * One level of nested states. When this state declares `initial`/`states`, it
   * is a COMPOUND state: entering it also enters its `initial` child, and the
   * child's `on`/`after`/`entry`/`exit` are active. An event/timer is offered to
   * the CHILD first; if the child does not handle it, it bubbles to this parent.
   * Kept to a single level by design (no XState clone — no parallel/actors).
   */
  initial?: TState
  states?: Partial<Record<TState, StateNode<TState, TContext, TEvent>>>
}

/**
 * Pluggable timer. Defaults to global `setTimeout`/`clearTimeout`, but tests
 * inject a deterministic fake (or use `vi.useFakeTimers`) so `after`-driven
 * timing is reproducible and jsdom never flakes (the flaky-Solid-tooltip is the
 * cautionary tale that motivated making this injectable).
 */
export interface Scheduler {
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

const defaultScheduler: Scheduler = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export interface MachineConfig<TState extends string, TContext, TEvent extends MachineEvent> {
  initial: TState
  context: TContext
  states: Record<TState, StateNode<TState, TContext, TEvent>>
  /** Injectable timer for `after` transitions. Defaults to setTimeout/clearTimeout. */
  scheduler?: Scheduler
}

export interface Machine<TState extends string, TContext, TEvent extends MachineEvent> {
  store: Store<MachineState<TState, TContext>>
  send(event: TEvent): void
  /**
   * Cancel any pending `after` timers and detach. Call on teardown so a delayed
   * transition can't fire into a disposed consumer. Idempotent. Machines with no
   * `after` transitions need not call it (nothing is scheduled), but it is always
   * safe. Back-compat: degenerate machines (e.g. floating.ts) simply never use it.
   */
  stop(): void
}

/**
 * Tiny statechart factory. Frame-agnostic; the returned store can be bridged
 * into any reactive system via the store's subscribe contract.
 *
 * Beyond flat event transitions it supports (v3 R18 — the "statechart promotion"):
 *   - `after`: delayed transitions, scheduled on state-entry, auto-cancelled on
 *     exit, driven by an INJECTABLE `scheduler` (deterministic in tests).
 *   - `entry`/`exit`: side-effect action arrays run on entering/leaving a state.
 *   - one level of nested (compound) states via `initial`/`states`.
 *
 * It deliberately stops at the 80/20: NO parallel states, NO actors, NO spawned
 * children. The point is to let interaction TIMING (hover-intent, auto-dismiss,
 * longpress) live in core instead of hand-rolled setTimeout in every component.
 *
 * @example
 * const dialog = createMachine<'closed' | 'open', { reason?: string }, { type: 'OPEN' } | { type: 'CLOSE'; reason?: string }>({
 *   initial: 'closed',
 *   context: {},
 *   states: {
 *     closed: { on: { OPEN: { target: 'open' } } },
 *     open: { on: { CLOSE: { target: 'closed', actions: (_, e) => ({ reason: e.reason }) } } },
 *   },
 * })
 */
export function createMachine<TState extends string, TContext, TEvent extends MachineEvent>(
  config: MachineConfig<TState, TContext, TEvent>,
): Machine<TState, TContext, TEvent> {
  const scheduler = config.scheduler ?? defaultScheduler
  const store = createStore<MachineState<TState, TContext>>({
    value: config.initial,
    context: config.context,
  })

  /** Pending `after` timer handles for the CURRENT state, cleared on every exit. */
  let pendingTimers: unknown[] = []
  let stopped = false

  /** Resolve the (parent) node for a top-level state value. */
  const nodeOf = (value: TState): StateNode<TState, TContext, TEvent> | undefined =>
    config.states[value]

  /**
   * The child node that `value` is currently delegating to, if `value` names a
   * compound state. One level only: the active child is the parent's `initial`.
   */
  const childNodeOf = (value: TState): StateNode<TState, TContext, TEvent> | undefined => {
    const parent = nodeOf(value)
    if (!parent?.initial || !parent.states) return undefined
    return parent.states[parent.initial]
  }

  const cancelPending = (): void => {
    if (pendingTimers.length === 0) return
    for (const h of pendingTimers) scheduler.clearTimeout(h)
    pendingTimers = []
  }

  const runActions = (
    actions: Action<TContext, TEvent>[] | undefined,
    event: TEvent | InitEvent,
  ): void => {
    if (!actions) return
    const ctx = store.getState().context
    for (const action of actions) action(ctx, event)
  }

  /**
   * Schedule the `after` timers for `value`'s active nodes (child's + parent's,
   * child wins on a delay collision — same precedence as event handling). Each
   * fires at most once; firing re-enters `enterState` for the new target, which
   * cancels remaining siblings.
   */
  const scheduleAfter = (value: TState): void => {
    const parent = nodeOf(value)
    const child = childNodeOf(value)
    // Merge so a child delay shadows a parent delay at the same ms.
    const afterMap: Record<number, DelayedTransition<TState, TContext>> = {
      ...(parent?.after ?? {}),
      ...(child?.after ?? {}),
    }
    for (const key of Object.keys(afterMap)) {
      const ms = Number(key)
      const delayed = afterMap[ms]
      if (ms <= 0 && config.scheduler === undefined) {
        // 0-delay transition with the default scheduler fires as a microtask
        // rather than synchronously inside send(). This avoids nested store
        // updates during React's batched event context that can confuse
        // useSyncExternalStore subscriptions, while still firing before any
        // macrotask. Custom schedulers (tests) still get synchronous 0-delay
        // via scheduler.setTimeout(fn, 0) for deterministic control.
        queueMicrotask(() => {
          if (stopped) return
          if (store.getState().value !== value) return
          fireDelayed(value, delayed)
        })
        continue
      }
      const handle = scheduler.setTimeout(() => {
        if (stopped) return
        // Re-validate: only fire if still in the state that scheduled this.
        if (store.getState().value !== value) return
        fireDelayed(value, delayed)
      }, ms)
      pendingTimers.push(handle)
    }
  }

  /**
   * Enter `value`: run exit actions of the state we are LEAVING, cancel its
   * pending timers, commit the new state, run entry actions (parent then child),
   * and schedule the new state's `after` timers.
   */
  const enterState = (next: TState, event: TEvent | InitEvent, isInitial: boolean): void => {
    const current = store.getState()
    if (!isInitial) {
      // Exit the old state: child exits before parent (deepest-first), then cancel.
      runActions(childNodeOf(current.value)?.exit, event)
      runActions(nodeOf(current.value)?.exit, event)
      cancelPending()
    }
    // The transition's own context update has already been applied to the store
    // by the caller; here we only move `value`.
    if (store.getState().value !== next) {
      store.setState((s) => ({ ...s, value: next }))
    }
    // Entry: parent before child (shallowest-first).
    runActions(nodeOf(next)?.entry, event)
    runActions(childNodeOf(next)?.entry, event)
    scheduleAfter(next)
  }

  /** Apply a (delayed or event) transition's actions+target, then re-enter. */
  const applyTransition = (
    transition: Transition<TState, TContext, TEvent> | DelayedTransition<TState, TContext>,
    event: TEvent | InitEvent,
  ): void => {
    const current = store.getState()
    const ctxUpdate =
      (transition.actions as (c: TContext, e: TEvent | InitEvent) => Partial<TContext> | void)?.(
        current.context,
        event,
      ) ?? undefined
    const nextValue = transition.target ?? current.value
    store.batch(() => {
      if (ctxUpdate !== undefined) {
        store.setState((s) => ({ ...s, context: { ...s.context, ...ctxUpdate } }))
      }
      // A self-transition with no target re-enters (cancels & reschedules
      // `after`) only if a target is named; a target-less transition runs its
      // actions WITHOUT exit/entry (matches XState "internal" semantics and the
      // original flat behavior where no target meant value unchanged).
      if (transition.target !== undefined) {
        enterState(nextValue, event, false)
      }
    })
  }

  const fireDelayed = (fromValue: TState, delayed: DelayedTransition<TState, TContext>): void => {
    const ctx = store.getState().context
    if (delayed.guard && !delayed.guard(ctx, INIT_EVENT)) return
    if (store.getState().value !== fromValue) return
    applyTransition(delayed, INIT_EVENT)
  }

  function send(event: TEvent): void {
    if (stopped) return
    const current = store.getState()
    // Offer the event to the active CHILD first, then bubble to the parent —
    // the one level of nesting. A degenerate (flat) machine has no child, so
    // this is exactly the original flat lookup.
    const child = childNodeOf(current.value)
    const parent = nodeOf(current.value)
    const transition = (child?.on?.[event.type as TEvent['type']] ??
      parent?.on?.[event.type as TEvent['type']]) as
      | Transition<TState, TContext, TEvent>
      | undefined
    if (!transition) return
    if (transition.guard && !transition.guard(current.context, event)) return
    applyTransition(transition, event)
  }

  function stop(): void {
    stopped = true
    cancelPending()
  }

  // Initial entry: run the initial state's (and its child's) entry actions and
  // schedule its `after` timers. Back-compat: a flat machine with no entry/after
  // does nothing observable here (no setState, no timers) — store stays identical.
  enterState(config.initial, INIT_EVENT, true)

  return { store, send, stop }
}
