import { useMemo } from 'react'
import type { Machine, MachineEvent, MachineState } from '@iris-ui-kit/core'
import { useStore } from './useStore'

/**
 * Bridge a framework-agnostic `Machine` into React. Returns `[state, send]`
 * — `state` is reactive (re-renders on transition) and `send` is stable
 * across renders.
 *
 * Pass a **factory** (`() => createMachine(...)`) so each component instance
 * gets its own machine. Internally memoised so re-renders don't re-create.
 */
export function useMachine<TState extends string, TContext, TEvent extends MachineEvent>(
  factory: () => Machine<TState, TContext, TEvent>,
): [MachineState<TState, TContext>, (event: TEvent) => void] {
  const machine = useMemo(factory, [])
  const state = useStore(machine.store)
  return [state, machine.send]
}
