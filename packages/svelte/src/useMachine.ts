import type { Readable } from 'svelte/store'
import type { Machine, MachineEvent, MachineState } from '@iris-ui/core'
import { toStore } from './useStore'

export interface ToMachineReturn<TState extends string, TContext, TEvent extends MachineEvent> {
  /** Machine state as a Svelte store — `$state` reflects each transition. */
  state: Readable<MachineState<TState, TContext>>
  send: (event: TEvent) => void
}

/**
 * Bridge a framework-agnostic `Machine` into Svelte. Returns `{ state, send }` —
 * `state` is a Svelte readable (use `$state` in markup) and `send` is stable.
 * The mirror of Solid's `useMachine` / React's `useMachine`; the SAME core
 * machine powers Dropdown/Popover/Dialog on every framework. Svelte component
 * setup runs once per instance, so pass the machine instance directly.
 */
export function toMachine<TState extends string, TContext, TEvent extends MachineEvent>(
  machine: Machine<TState, TContext, TEvent>,
): ToMachineReturn<TState, TContext, TEvent> {
  return { state: toStore(machine.store), send: machine.send }
}
