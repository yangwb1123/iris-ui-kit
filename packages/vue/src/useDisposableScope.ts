import { onUnmounted, ref } from 'vue'
import { createDisposableScope, type DisposableScope } from '@iris-ui-kit/core'

/**
 * Vue composable for `createDisposableScope` — creates a disposable scope
 * that is automatically torn down when the component is unmounted.
 *
 * Returns a reactive `scope` ref that stays alive for the component's lifetime.
 * Call `scope.value.add(teardown)` to register cleanup callbacks.
 */
export function useDisposableScope(): { value: DisposableScope } {
  const scope = ref<DisposableScope>(createDisposableScope()) as { value: DisposableScope }

  onUnmounted(() => {
    scope.value.destroy()
  })

  return scope
}
