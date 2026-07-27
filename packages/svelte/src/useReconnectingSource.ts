import { onMount, onDestroy } from 'svelte'
import { writable, type Readable } from 'svelte/store'
import {
  createReconnectingSource,
  type RealtimeStatus,
  type RealtimeHandlers,
  type RealtimeOptions,
} from '@iris-ui-kit/core'

/**
 * Svelte bridge for `createReconnectingSource` — a realtime subscription with
 * automatic exponential-backoff reconnection.
 *
 * Returns a readable Svelte store for the connection status. The source is
 * opened on mount and closed/cleaned up on destroy.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { toReconnectingSource } from '@iris-ui-kit/svelte'
 *   const status = toReconnectingSource<string>((sink) => {
 *     const ws = new WebSocket('wss://example.com')
 *     ws.onmessage = (e) => sink.message(e.data)
 *     ws.onopen = () => sink.open()
 *     ws.onclose = () => sink.close()
 *     return () => ws.close()
 *   }, { onMessage: (d) => console.log(d) })
 * </script>
 * <p>Status: {$status}</p>
 * ```
 */
export function toReconnectingSource<T>(
  connect: (sink: {
    message: (data: T) => void
    open: () => void
    error: (err: unknown) => void
    close: () => void
  }) => () => void,
  handlers: Pick<RealtimeHandlers<T>, 'onMessage' | 'onOpen' | 'onError' | 'onClose'>,
  options?: RealtimeOptions,
): Readable<RealtimeStatus> {
  const status = writable<RealtimeStatus>('idle')

  // Use a mutable ref-like object to avoid stale handler references
  const handlersRef = { current: handlers }
  handlersRef.current = handlers

  onMount(() => {
    const source = createReconnectingSource<T>(
      connect,
      {
        onMessage: (data) => handlersRef.current.onMessage?.(data),
        onOpen: () => handlersRef.current.onOpen?.(),
        onError: (err) => handlersRef.current.onError?.(err),
        onClose: () => handlersRef.current.onClose?.(),
        onStatus: (s) => status.set(s),
      },
      options,
    )

    source.open()
    onDestroy(() => source.close())
  })

  return { subscribe: status.subscribe }
}
