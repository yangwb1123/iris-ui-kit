import { type Accessor } from 'solid-js'
import type { Machine, MachineEvent, MachineState } from '@iris-ui/core'
import { useStore } from './useStore'

/**
 * Bridge a framework-agnostic `Machine` into Solid. Returns `[state, send]` —
 * `state` is an accessor (reads re-run on transition) and `send` is stable.
 *
 * Pass a **factory** (`() => createMachine(...)`) so each component instance
 * gets its own machine. Solid setup runs once per instance, so no memo is
 * needed (unlike React's `useMemo`).
 */
export function useMachine<TState extends string, TContext, TEvent extends MachineEvent>(
  factory: () => Machine<TState, TContext, TEvent>,
): [Accessor<MachineState<TState, TContext>>, (event: TEvent) => void] {
  const machine = factory()
  const state = useStore(machine.store)
  return [state, machine.send]
}
