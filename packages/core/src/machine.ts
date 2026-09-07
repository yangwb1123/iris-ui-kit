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
  /**
   * Optional monotonic clock in ms. Consumers that need elapsed-time math across
   * pause/resume (e.g. `createAutoDismiss`) read this so timing stays
   * deterministic under a fake scheduler. When absent, callers fall back to
   * `Date.now()`. The `after`-transition machinery itself does not use it.
   */
  now?(): number
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

type ActiveMachineState<TState extends string> = {
  parent: TState
  child?: TState
}

type PendingTimer<TState extends string> = {
  handle: unknown
  scope: 'parent' | 'child'
  parent: TState
  child?: TState
}

interface MachineRuntimeDeps<TState extends string, TContext, TEvent extends MachineEvent> {
  config: MachineConfig<TState, TContext, TEvent>
  scheduler: Scheduler
  store: Store<MachineState<TState, TContext>>
  active: { value: ActiveMachineState<TState> }
  pendingTimers: { value: PendingTimer<TState>[] }
  stopped: { value: boolean }
  nodeOf(value: TState): StateNode<TState, TContext, TEvent> | undefined
  isChildTarget(value: TState): boolean
  childNodeOf(): StateNode<TState, TContext, TEvent> | undefined
  cancelPending(scope?: 'parent' | 'child'): void
  runActions(actions: Action<TContext, TEvent>[] | undefined, event: TEvent | InitEvent): void
}

interface MachineLifecycle<TState extends string, TContext, TEvent extends MachineEvent> {
  scheduleAfter(
    value: TState,
    fireDelayed: (
      fromValue: TState,
      delayed: DelayedTransition<TState, TContext>,
      scope: 'parent' | 'child',
      child?: TState,
    ) => void,
    onlyScope?: 'parent' | 'child',
  ): void
  enterState(
    next: TState,
    event: TEvent | InitEvent,
    isInitial: boolean,
    fireDelayed: (
      fromValue: TState,
      delayed: DelayedTransition<TState, TContext>,
      scope: 'parent' | 'child',
      child?: TState,
    ) => void,
    targetScope: 'parent' | 'child',
  ): void
}

function createMachineLifecycle<TState extends string, TContext, TEvent extends MachineEvent>(
  deps: MachineRuntimeDeps<TState, TContext, TEvent>,
): MachineLifecycle<TState, TContext, TEvent> {
  const isActive = (parent: TState, child?: TState): boolean => {
    const active = deps.active.value
    return active.parent === parent && (child === undefined || active.child === child)
  }

  const scheduleAfter = (
    _value: TState,
    fireDelayed: (
      fromValue: TState,
      delayed: DelayedTransition<TState, TContext>,
      scope: 'parent' | 'child',
      child?: TState,
    ) => void,
    onlyScope?: 'parent' | 'child',
  ): void => {
    if (deps.stopped.value) return
    const active = deps.active.value
    const parent = deps.nodeOf(active.parent)
    const child = deps.childNodeOf()
    const childAfterKeys = new Set(Object.keys(child?.after ?? {}))
    const entries: Array<[string, DelayedTransition<TState, TContext>, 'parent' | 'child']> = []

    if (onlyScope !== 'child') {
      for (const [key, delayed] of Object.entries(parent?.after ?? {})) {
        if (childAfterKeys.has(key)) continue
        entries.push([key, delayed, 'parent'])
      }
    }
    if (onlyScope !== 'parent') {
      for (const [key, delayed] of Object.entries(child?.after ?? {})) {
        entries.push([key, delayed, 'child'])
      }
    }

    for (const [key, delayed, scope] of entries) {
      const ms = Number(key)
      if (!Number.isFinite(ms) || ms < 0 || !delayed || typeof delayed !== 'object') continue
      const timer: PendingTimer<TState> = {
        handle: undefined,
        scope,
        parent: active.parent,
        ...(scope === 'child' ? { child: active.child } : {}),
      }
      timer.handle = deps.scheduler.setTimeout(() => {
        deps.pendingTimers.value = deps.pendingTimers.value.filter((item) => item !== timer)
        if (deps.stopped.value) return
        if (
          timer.scope === 'parent' ? !isActive(timer.parent) : !isActive(timer.parent, timer.child)
        ) {
          return
        }
        fireDelayed(timer.parent, delayed, timer.scope, timer.child)
      }, ms)
      deps.pendingTimers.value.push(timer)
    }
  }

  const enterState = (
    next: TState,
    event: TEvent | InitEvent,
    isInitial: boolean,
    fireDelayed: (
      fromValue: TState,
      delayed: DelayedTransition<TState, TContext>,
      scope: 'parent' | 'child',
      child?: TState,
    ) => void,
    targetScope: 'parent' | 'child',
  ): void => {
    const current = deps.active.value

    if (!isInitial && targetScope === 'child' && current.child !== undefined) {
      deps.runActions(deps.childNodeOf()?.exit, event)
      if (deps.stopped.value) return
      deps.cancelPending('child')
      deps.active.value = { parent: current.parent, child: next }
      if (deps.store.getState().value !== next) {
        deps.store.setState((state) => ({ ...state, value: next }))
      }
      deps.runActions(deps.childNodeOf()?.entry, event)
      if (deps.stopped.value || !isActive(current.parent, next)) return
      scheduleAfter(current.parent, fireDelayed, 'child')
      return
    }

    if (!isInitial) {
      deps.runActions(deps.childNodeOf()?.exit, event)
      if (deps.stopped.value) return
      deps.runActions(deps.nodeOf(current.parent)?.exit, event)
      if (deps.stopped.value) return
      deps.cancelPending()
    }

    const parent = deps.nodeOf(next)
    deps.active.value = {
      parent: next,
      ...(parent?.initial !== undefined && parent.states ? { child: parent.initial } : {}),
    }
    if (deps.store.getState().value !== next) {
      deps.store.setState((state) => ({ ...state, value: next }))
    }
    deps.runActions(deps.nodeOf(next)?.entry, event)
    if (deps.stopped.value || !isActive(next)) return
    deps.runActions(deps.childNodeOf()?.entry, event)
    if (deps.stopped.value || !isActive(next)) return
    scheduleAfter(next, fireDelayed)
  }

  return { scheduleAfter, enterState }
}

interface MachineTransitionHandlers<TState extends string, TContext, TEvent extends MachineEvent> {
  applyTransition(
    transition: Transition<TState, TContext, TEvent> | DelayedTransition<TState, TContext>,
    event: TEvent | InitEvent,
    targetScope: 'parent' | 'child',
  ): void
  fireDelayed(
    fromValue: TState,
    delayed: DelayedTransition<TState, TContext>,
    targetScope: 'parent' | 'child',
    child?: TState,
  ): void
}

function createMachineTransitionHandlers<
  TState extends string,
  TContext,
  TEvent extends MachineEvent,
>(
  deps: MachineRuntimeDeps<TState, TContext, TEvent>,
  lifecycle: MachineLifecycle<TState, TContext, TEvent>,
): MachineTransitionHandlers<TState, TContext, TEvent> {
  const applyTransition = (
    transition: Transition<TState, TContext, TEvent> | DelayedTransition<TState, TContext>,
    event: TEvent | InitEvent,
    targetScope: 'parent' | 'child',
  ): void => {
    const current = deps.store.getState()
    const update =
      (
        transition.actions as (
          context: TContext,
          actionEvent: TEvent | InitEvent,
        ) => Partial<TContext> | void
      )?.(current.context, event) ?? undefined
    deps.store.batch(() => {
      if (update !== undefined) {
        deps.store.setState((state) => ({ ...state, context: { ...state.context, ...update } }))
      }
      if (transition.target !== undefined) {
        lifecycle.enterState(transition.target, event, false, fireDelayed, targetScope)
      }
    })
  }
  const fireDelayed = (
    fromValue: TState,
    delayed: DelayedTransition<TState, TContext>,
    targetScope: 'parent' | 'child',
    child?: TState,
  ): void => {
    const context = deps.store.getState().context
    if (delayed.guard && !delayed.guard(context, INIT_EVENT)) return
    const active = deps.active.value
    if (active.parent !== fromValue || (targetScope === 'child' && active.child !== child)) return
    const transitionScope =
      targetScope === 'child' && delayed.target !== undefined && !deps.isChildTarget(delayed.target)
        ? 'parent'
        : targetScope
    applyTransition(delayed, INIT_EVENT, transitionScope)
  }
  return { applyTransition, fireDelayed }
}

function createMachineSender<TState extends string, TContext, TEvent extends MachineEvent>(
  deps: MachineRuntimeDeps<TState, TContext, TEvent>,
  applyTransition: MachineTransitionHandlers<TState, TContext, TEvent>['applyTransition'],
): (event: TEvent) => void {
  return (event) => {
    if (deps.stopped.value) return
    const current = deps.store.getState()
    const child = deps.childNodeOf()
    const parent = deps.nodeOf(deps.active.value.parent)
    const childTransition = child?.on?.[event.type as TEvent['type']]
    const transition = (childTransition ?? parent?.on?.[event.type as TEvent['type']]) as
      Transition<TState, TContext, TEvent> | undefined
    if (!transition || (transition.guard && !transition.guard(current.context, event))) return
    const targetScope =
      childTransition && transition.target !== undefined && !deps.isChildTarget(transition.target)
        ? 'parent'
        : childTransition
          ? 'child'
          : 'parent'
    applyTransition(transition, event, targetScope)
  }
}

function createMachineDeps<TState extends string, TContext, TEvent extends MachineEvent>(
  config: MachineConfig<TState, TContext, TEvent>,
  scheduler: Scheduler,
  store: Store<MachineState<TState, TContext>>,
): MachineRuntimeDeps<TState, TContext, TEvent> {
  const active: { value: ActiveMachineState<TState> } = { value: { parent: config.initial } }
  const pendingTimers: { value: PendingTimer<TState>[] } = { value: [] }
  const stopped: { value: boolean } = { value: false }
  const nodeOf = (value: TState): StateNode<TState, TContext, TEvent> | undefined =>
    config.states[value]
  const isChildTarget = (value: TState): boolean => {
    const states = nodeOf(active.value.parent)?.states
    return states !== undefined && Object.prototype.hasOwnProperty.call(states, value)
  }
  const childNodeOf = (): StateNode<TState, TContext, TEvent> | undefined => {
    const parent = nodeOf(active.value.parent)
    if (active.value.child === undefined || !parent?.states) return undefined
    return parent.states[active.value.child]
  }
  const cancelPending = (scope?: 'parent' | 'child'): void => {
    if (pendingTimers.value.length === 0) return
    const retained: PendingTimer<TState>[] = []
    for (const timer of pendingTimers.value) {
      if (scope !== undefined && timer.scope !== scope) {
        retained.push(timer)
      } else {
        scheduler.clearTimeout(timer.handle)
      }
    }
    pendingTimers.value = retained
  }
  const runActions = (
    actions: Action<TContext, TEvent>[] | undefined,
    event: TEvent | InitEvent,
  ): void => {
    if (!actions) return
    const context = store.getState().context
    for (const action of actions) action(context, event)
  }
  return {
    config,
    scheduler,
    store,
    active,
    pendingTimers,
    stopped,
    nodeOf,
    isChildTarget,
    childNodeOf,
    cancelPending,
    runActions,
  }
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
  const deps = createMachineDeps(config, scheduler, store)
  const lifecycle = createMachineLifecycle(deps)
  const transitions = createMachineTransitionHandlers(deps, lifecycle)
  const dispatch = createMachineSender(deps, transitions.applyTransition)
  const queue: Array<() => void> = []
  let processing = false
  const enqueue = (work: () => void): void => {
    if (deps.stopped.value) return
    queue.push(work)
    if (processing) return
    processing = true
    try {
      while (queue.length > 0 && !deps.stopped.value) queue.shift()?.()
    } finally {
      queue.length = 0
      processing = false
    }
  }
  const send = (event: TEvent): void => {
    enqueue(() => dispatch(event))
  }
  const fireDelayed = (
    fromValue: TState,
    delayed: DelayedTransition<TState, TContext>,
    targetScope: 'parent' | 'child',
    child?: TState,
  ): void => {
    enqueue(() => transitions.fireDelayed(fromValue, delayed, targetScope, child))
  }
  const stop = (): void => {
    deps.stopped.value = true
    queue.length = 0
    deps.cancelPending()
  }

  // Initial entry: run the initial state's (and its child's) entry actions and
  // schedule its `after` timers. Back-compat: a flat machine with no entry/after
  // does nothing observable here (no setState, no timers) — store stays identical.
  enqueue(() => lifecycle.enterState(config.initial, INIT_EVENT, true, fireDelayed, 'parent'))

  return { store, send, stop }
}
