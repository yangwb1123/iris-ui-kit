import { onUnmounted, ref, type Ref } from 'vue'
import {
  createReconnectingSource,
  type RealtimeStatus,
  type RealtimeHandlers,
  type RealtimeOptions,
} from '@iris-ui/core'

/**
 * Vue composable for `createReconnectingSource` — a realtime subscription with
 * automatic exponential-backoff reconnection.
 *
 * Returns a reactive `status` ref. The source is opened in `onMounted` and
 * closed/cleaned up in `onUnmounted`.
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
): Ref<RealtimeStatus> {
  const status = ref<RealtimeStatus>('idle')

  // Use a shallow wrapper so handlers can be updated without recreating the source.
  const handlersRef = { current: handlers }
  handlersRef.current = handlers

  const source = createReconnectingSource<T>(
    connect,
    {
      onMessage: (data) => handlersRef.current.onMessage?.(data),
      onOpen: () => handlersRef.current.onOpen?.(),
      onError: (err) => handlersRef.current.onError?.(err),
      onClose: () => handlersRef.current.onClose?.(),
      onStatus: (s) => {
        status.value = s
      },
    },
    options,
  )

  source.open()
  onUnmounted(() => source.close())

  return status
}
