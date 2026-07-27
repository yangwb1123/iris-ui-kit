import { onCleanup } from 'solid-js'
import {
  createResilientFetcher,
  type ResilientFetcher,
  type ResilientFetcherOptions,
} from '@iris-ui-kit/core'

/**
 * Solid primitive for `createResilientFetcher` — a hardened async fetcher with
 * cache dedup/TTL/SWR, circuit breaker, and optional rate limiting.
 *
 * The resilient fetcher is created once and lives for the component's lifetime.
 * The cache is cleared on cleanup.
 *
 * @example
 * ```tsx
 * import { useResilientFetcher } from '@iris-ui-kit/solid'
 * import { createSignal, onMount } from 'solid-js'
 *
 * function UserProfile() {
 *   const rf = useResilientFetcher<{ name: string }>({ ttlMs: 30_000 })
 *   const [user, setUser] = createSignal<{ name: string } | null>(null)
 *
 *   onMount(async () => {
 *     const data = await rf.fetch('user:1', async () => {
 *       const res = await fetch('/api/users/1')
 *       return res.json()
 *     })
 *     setUser(data)
 *   })
 *
 *   return <div>{user()?.name}</div>
 * }
 * ```
 */
export function useResilientFetcher<T>(options?: ResilientFetcherOptions): ResilientFetcher<T> {
  const rf = createResilientFetcher<T>(options)

  onCleanup(() => {
    rf.cache.clear()
  })

  return rf
}
