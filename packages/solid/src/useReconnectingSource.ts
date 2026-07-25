import { createSignal, onCleanup, type Accessor } from 'solid-js'
import {
  createReconnectingSource,
  type RealtimeStatus,
  type RealtimeHandlers,
  type RealtimeOptions,
} from '@iris-ui/core'

/**
 * Solid bridge for `createReconnectingSource` — a realtime subscription with
 * automatic exponential-backoff reconnection.
 *
 * Returns a signal accessor for the connection status. The source is opened
 * on mount and closed/cleaned up on unmount.
 */
export function useReconnectingSource<T>(
  connect: (sink: {
    message: (data: T) => void
    open: () => void
    error: (err: unknown) => void
    close: () => void
  }) => () => void,
  handlers: Pick<RealtimeHandlers<T>, 'onMessage' | 'onOpen' | 'onError' | 'onClose'>,
  options?: RealtimeOptions,
): Accessor<RealtimeStatus> {
  const [status, setStatus] = createSignal<RealtimeStatus>('idle')

  // Handlers ref to avoid stale closures
  const handlersRef = { current: handlers }
  handlersRef.current = handlers

  const source = createReconnectingSource<T>(
    connect,
    {
      onMessage: (data) => handlersRef.current.onMessage?.(data),
      onOpen: () => handlersRef.current.onOpen?.(),
      onError: (err) => handlersRef.current.onError?.(err),
      onClose: () => handlersRef.current.onClose?.(),
      onStatus: (s) => setStatus(s),
    },
    options,
  )

  source.open()
  onCleanup(() => source.close())

  return status
}
