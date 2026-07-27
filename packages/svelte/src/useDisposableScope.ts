import { onMount, onDestroy } from 'svelte'
import { createDisposableScope, type DisposableScope } from '@iris-ui-kit/core'

/**
 * Svelte helper for `createDisposableScope` — creates a disposable scope
 * that is automatically torn down when the component is destroyed.
 *
 * Call `scope.add(teardown)` to register cleanup callbacks.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { toDisposableScope } from '@iris-ui-kit/svelte'
 *   const scope = toDisposableScope()
 *   scope.add(() => console.log('cleanup'))
 * </script>
 * ```
 */
export function toDisposableScope(): DisposableScope {
  const scope = createDisposableScope()

  onMount(() => {
    onDestroy(() => scope.destroy())
  })

  return scope
}
