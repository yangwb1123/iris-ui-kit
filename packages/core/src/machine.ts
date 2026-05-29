import { createStore, type Store } from './store'

export type MachineEvent = { type: string }

export interface MachineState<TState extends string, TContext> {
  value: TState
  context: TContext
}

export interface Transition<TState extends string, TContext, TEvent extends MachineEvent> {
  /** Target state to transition to. If absent, the transition only runs actions. */
  target?: TState
  /** Optional guard: returns true to permit the transition. */
  guard?: (context: TContext, event: TEvent) => boolean
  /** Optional context updates applied when this transition fires. */
  actions?: (context: TContext, event: TEvent) => Partial<TContext> | void
}

export type StateNode<TState extends string, TContext, TEvent extends MachineEvent> = {
  /** Event-driven transitions for this state. */
  on?: {
    [K in TEvent['type']]?: Transition<TState, TContext, Extract<TEvent, { type: K }>>
  }
}

export interface MachineConfig<TState extends string, TContext, TEvent extends MachineEvent> {
  initial: TState
  context: TContext
  states: Record<TState, StateNode<TState, TContext, TEvent>>
}

export interface Machine<TState extends string, TContext, TEvent extends MachineEvent> {
  store: Store<MachineState<TState, TContext>>
  send(event: TEvent): void
}

/**
 * Tiny statechart factory. Frame-agnostic; the returned store can be bridged
 * into any reactive system via the store's subscribe contract.
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
  const store = createStore<MachineState<TState, TContext>>({
    value: config.initial,
    context: config.context,
  })

  function send(event: TEvent) {
    const current = store.getState()
    const node = config.states[current.value]
    const transition = node?.on?.[event.type as TEvent['type']] as
      | Transition<TState, TContext, TEvent>
      | undefined
    if (!transition) return
    if (transition.guard && !transition.guard(current.context, event)) return

    const ctxUpdate = transition.actions?.(current.context, event) ?? undefined
    const nextContext =
      ctxUpdate === undefined ? current.context : { ...current.context, ...ctxUpdate }
    const nextValue = transition.target ?? current.value

    store.setState({ value: nextValue, context: nextContext })
  }

  return { store, send }
}
