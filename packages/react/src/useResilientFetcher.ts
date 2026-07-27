import { useEffect, useRef } from 'react'
import {
  createResilientFetcher,
  type ResilientFetcher,
  type ResilientFetcherOptions,
} from '@iris-ui-kit/core'

/**
 * React hook for `createResilientFetcher` — a hardened async fetcher with
 * cache dedup/TTL/SWR, circuit breaker, and optional rate limiting.
 *
 * The resilient fetcher is created once and lives for the component's lifetime.
 * The cache is cleared on unmount.
 *
 * @example
 * ```tsx
 * function UserProfile({ userId }: { userId: string }) {
 *   const rf = useResilientFetcher<User>({ ttlMs: 30_000 })
 *   const [user, setUser] = useState<User | null>(null)
 *
 *   useEffect(() => {
 *     rf.fetch(`user:${userId}`, async () => {
 *       const res = await fetch(`/api/users/${userId}`)
 *       return res.json()
 *     }).then(setUser)
 *   }, [userId])
 *
 *   return <div>{user?.name}</div>
 * }
 * ```
 */
export function useResilientFetcher<T>(options?: ResilientFetcherOptions): ResilientFetcher<T> {
  const ref = useRef<ResilientFetcher<T> | null>(null)

  if (ref.current === null) {
    ref.current = createResilientFetcher<T>(options)
  }

  // Clear cache on unmount to prevent stale data
  useEffect(() => {
    return () => {
      ref.current?.cache.clear()
    }
  }, [])

  return ref.current
}
