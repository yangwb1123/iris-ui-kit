import { onScopeDispose, ref, type Ref } from 'vue'
import type { Machine, MachineEvent, MachineState } from '@iris-ui-kit/core'

/**
 * Bridge a framework-agnostic `Machine` into Vue reactivity.
 *
 * Returns a reactive ref of the current `{ value, context }` state and a
 * stable `send` function. Subscription is created eagerly and cleaned up on
 * scope dispose, so this hook is safe to call from any component's `setup()`.
 *
 * Teardown semantics: when the owning scope is disposed (component unmount,
 * `effectScope().stop()`, end of SSR render), the store subscription is
 * detached AND — by default — `machine.stop()` is called: pending `after`
 * timers are cancelled and further `send` calls become no-ops, so a delayed
 * transition can never fire into a disposed consumer (see the core `Machine`
 * contract). Pass `{ stopOnUnmount: false }` only when the machine is shared
 * with other consumers that outlive this scope — the subscription is still
 * detached, the machine keeps running.
 */
export function useMachine<TState extends string, TContext, TEvent extends MachineEvent>(
  machine: Machine<TState, TContext, TEvent>,
  options: { stopOnUnmount?: boolean } = {},
): {
  state: Ref<MachineState<TState, TContext>>
  send: (event: TEvent) => void
} {
  const state = ref(machine.store.getState()) as Ref<MachineState<TState, TContext>>
  const unsubscribe = machine.store.subscribe((next) => {
    state.value = next
  })
  onScopeDispose(
    () => {
      // Detach the bridge first (conservative order), then stop the machine.
      unsubscribe()
      if (options.stopOnUnmount !== false) machine.stop()
    },
    // failSilently: outside any effect scope there is nothing to dispose —
    // registering is a no-op and must not emit the "no active effect scope"
    // dev warning. Within a component/effectScope this arg changes nothing.
    true,
  )
  return { state, send: machine.send }
}
