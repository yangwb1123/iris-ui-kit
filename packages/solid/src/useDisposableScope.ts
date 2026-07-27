import { onCleanup } from 'solid-js'
import { createDisposableScope, type DisposableScope } from '@iris-ui-kit/core'

/**
 * Solid primitive for `createDisposableScope` — creates a disposable scope
 * that is automatically torn down when the component is cleaned up.
 *
 * Returns a `DisposableScope` that stays alive for the component's lifetime.
 * Call `scope.add(teardown)` to register cleanup callbacks.
 */
export function useDisposableScope(): DisposableScope {
  const scope = createDisposableScope()

  onCleanup(() => scope.destroy())

  return scope
}
