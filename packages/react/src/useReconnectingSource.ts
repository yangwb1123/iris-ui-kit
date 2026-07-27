import { useEffect, useRef, useState } from 'react'
import {
  createReconnectingSource,
  type RealtimeStatus,
  type RealtimeHandlers,
  type RealtimeOptions,
} from '@iris-ui-kit/core'

/**
 * React bridge for `createReconnectingSource` — a realtime subscription with
 * automatic exponential-backoff reconnection.
 *
 * Returns the current connection status and a `close()` function. The source
 * is opened on mount and closed/cleaned up on unmount.
 *
 * @example
 * ```tsx
 * function StockTicker() {
 *   const [price, setPrice] = useState(0)
 *   const status = useReconnectingSource<{ price: number }>(
 *     (sink) => {
 *       const ws = new WebSocket('wss://api.example.com/stocks')
 *       ws.onmessage = (e) => sink.message(JSON.parse(e.data))
 *       ws.onopen = () => sink.open()
 *       ws.onclose = () => sink.close()
 *       return () => ws.close()
 *     },
 *     { onMessage: (t) => setPrice(t.price) },
 *     { backoffMs: 1000, maxBackoffMs: 30000 },
 *   )
 *   return <div>Price: ${price} ({status})</div>
 * }
 * ```
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
): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('idle')
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
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
    return () => source.close()
  }, [connect, options])

  return status
}
