import { onMount, onDestroy } from 'svelte'
import {
  createResilientFetcher,
  type ResilientFetcher,
  type ResilientFetcherOptions,
} from '@iris-ui-kit/core'

/**
 * Svelte helper for `createResilientFetcher` — a hardened async fetcher with
 * cache dedup/TTL/SWR, circuit breaker, and optional rate limiting.
 *
 * The resilient fetcher is created once and lives for the component's lifetime.
 * The cache is cleared on destroy.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { toResilientFetcher } from '@iris-ui-kit/svelte'
 *   import { onMount } from 'svelte'
 *
 *   const rf = toResilientFetcher<{ name: string }>({ ttlMs: 30_000 })
 *   let user: { name: string } | null = $state(null)
 *
 *   onMount(async () => {
 *     user = await rf.fetch('user:1', async () => {
 *       const res = await fetch('/api/users/1')
 *       return res.json()
 *     })
 *   })
 * </script>
 * <p>{user?.name}</p>
 * ```
 */
export function toResilientFetcher<T>(options?: ResilientFetcherOptions): ResilientFetcher<T> {
  const rf = createResilientFetcher<T>(options)

  onMount(() => {
    onDestroy(() => rf.cache.clear())
  })

  return rf
}
