import { useEffect, useRef } from 'react'
import { createDisposableScope, type DisposableScope } from '@iris-ui/core'

/**
 * React bridge for `createDisposableScope` — creates a disposable scope that
 * is automatically torn down when the component unmounts.
 *
 * Returns a stable `scope` ref that stays alive for the component's lifetime.
 * Call `scope.current.add(teardown)` to register cleanup callbacks.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const scope = useDisposableScope()
 *
 *   useEffect(() => {
 *     const timer = setInterval(() => {}, 1000)
 *     scope.current.addTimeout(timer)
 *   }, [])
 *
 *   return <div>Auto-cleaned on unmount</div>
 * }
 * ```
 */
export function useDisposableScope(): { readonly current: DisposableScope } {
  const scopeRef = useRef<DisposableScope | null>(null)

  if (scopeRef.current === null) {
    scopeRef.current = createDisposableScope()
  }

  useEffect(() => {
    const scope = scopeRef.current!
    return () => scope.destroy()
  }, [])

  return scopeRef as { readonly current: DisposableScope }
}
