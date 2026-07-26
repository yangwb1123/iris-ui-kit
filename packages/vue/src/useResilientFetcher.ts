import { onUnmounted, ref, type Ref } from 'vue'
import {
  createResilientFetcher,
  type ResilientFetcher,
  type ResilientFetcherOptions,
} from '@iris-ui/core'

/**
 * Vue composable for `createResilientFetcher` — a hardened async fetcher with
 * cache dedup/TTL/SWR, circuit breaker, and optional rate limiting.
 *
 * The resilient fetcher is created once and lives for the component's lifetime.
 * The cache is cleared on unmount.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useResilientFetcher } from '@iris-ui/vue'
 * import { ref, onMounted } from 'vue'
 *
 * const rf = useResilientFetcher<{ name: string }>({ ttlMs: 30_000 })
 * const user = ref<{ name: string } | null>(null)
 *
 * onMounted(async () => {
 *   user.value = await rf.fetch('user:1', async () => {
 *     const res = await fetch('/api/users/1')
 *     return res.json()
 *   })
 * })
 * </script>
 * ```
 */
export function useResilientFetcher<T>(
  options?: ResilientFetcherOptions,
): Ref<ResilientFetcher<T>> {
  const rf = ref<ResilientFetcher<T>>(createResilientFetcher<T>(options))

  onUnmounted(() => {
    rf.value.cache.clear()
  })

  return rf
}
