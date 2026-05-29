import { onBeforeUnmount, ref, type Ref } from 'vue'
import type { Machine, MachineEvent, MachineState } from '@iris-ui/core'

/**
 * Bridge a framework-agnostic `Machine` into Vue reactivity.
 *
 * Returns a reactive ref of the current `{ value, context }` state and a
 * stable `send` function. Subscription is created eagerly and cleaned up on
 * unmount, so this hook is safe to call from any component's `setup()`.
 *
 * No primitive consumes this yet (Phase 0 ships the bridge for Phase 1).
 */
export function useMachine<TState extends string, TContext, TEvent extends MachineEvent>(
  machine: Machine<TState, TContext, TEvent>,
): {
  state: Ref<MachineState<TState, TContext>>
  send: (event: TEvent) => void
} {
  const state = ref(machine.store.getState()) as Ref<MachineState<TState, TContext>>
  const unsubscribe = machine.store.subscribe((next) => {
    state.value = next
  })
  onBeforeUnmount(() => {
    unsubscribe()
  })
  return { state, send: machine.send }
}
