/**
 * `@iris-ui-kit/core` realtime source — framework-agnostic reconnection with
 * exponential backoff over any push transport. All of Iris's data engines are
 * pull-based Promise fetchers; there is no primitive for a live stream. This is
 * that primitive: it owns connection state and the reconnect/backoff loop while
 * staying transport-agnostic — the actual `WebSocket` / `EventSource` (both DOM
 * types) is created inside the caller's `connect` callback, so core itself
 * imports no DOM. Adapters wrap this as a `useSubscription`-style hook.
 */

export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed'

/** Callbacks the source hands to your transport on each (re)connect. */
export interface RealtimeSink<T> {
  /** Deliver a message from the transport. */
  message: (data: T) => void
  /** The transport became ready. Resets the backoff. */
  open: () => void
  /** A transport error (informational; a `close` drives reconnect). */
  error: (err: unknown) => void
  /** The transport ended — triggers a backoff reconnect unless closed. */
  close: () => void
}

/**
 * Establish one connection wired to `sink`; return a disconnect function. Called
 * once per (re)connect. Create your `WebSocket`/`EventSource` here.
 */
export type RealtimeConnect<T> = (sink: RealtimeSink<T>) => () => void

export interface RealtimeHandlers<T> {
  onMessage: (data: T) => void
  onOpen?: () => void
  onError?: (err: unknown) => void
  onClose?: () => void
  onStatus?: (status: RealtimeStatus) => void
}

export interface RealtimeOptions {
  /** Base backoff delay in ms. Default `500`. */
  backoffMs?: number
  /** Maximum backoff delay in ms. Default `30_000`. */
  maxBackoffMs?: number
  /** Backoff growth factor. Default `2`. */
  factor?: number
  /** Give up after this many consecutive reconnect attempts. Default `Infinity`. */
  maxRetries?: number
  /** Schedule a delayed callback; return a cancel fn. Injectable for tests.
   *  Defaults to `setTimeout`/`clearTimeout`. */
  schedule?: (fn: () => void, ms: number) => () => void
}

export interface RealtimeSource {
  readonly status: RealtimeStatus
  /** Consecutive failed attempts since the last successful open. */
  readonly attempts: number
  /** Open the connection (idempotent while already active). */
  open(): void
  /** Close permanently — cancels any pending reconnect; no further attempts. */
  close(): void
  /** Observe status transitions; returns an unsubscribe. */
  subscribe(listener: (status: RealtimeStatus) => void): () => void
}

const defaultSchedule = (fn: () => void, ms: number): (() => void) => {
  const id = setTimeout(fn, ms)
  return () => clearTimeout(id)
}

export function createReconnectingSource<T>(
  connect: RealtimeConnect<T>,
  handlers: RealtimeHandlers<T>,
  options: RealtimeOptions = {},
): RealtimeSource {
  const backoffMs = options.backoffMs ?? 500
  const maxBackoffMs = options.maxBackoffMs ?? 30_000
  const factor = options.factor ?? 2
  const maxRetries = options.maxRetries ?? Infinity
  const schedule = options.schedule ?? defaultSchedule

  let status: RealtimeStatus = 'idle'
  let attempts = 0
  let closed = false
  let disconnect: (() => void) | undefined
  let cancelReconnect: (() => void) | undefined
  const listeners = new Set<(status: RealtimeStatus) => void>()

  const setStatus = (next: RealtimeStatus): void => {
    if (status === next) return
    status = next
    handlers.onStatus?.(next)
    for (const l of listeners) l(next)
  }

  const backoffFor = (attempt: number): number =>
    Math.min(maxBackoffMs, backoffMs * factor ** attempt)

  const doConnect = (): void => {
    if (closed) return
    // Tear down any prior connection before opening a new one.
    disconnect?.()
    disconnect = undefined
    setStatus(attempts === 0 ? 'connecting' : 'reconnecting')
    const sink: RealtimeSink<T> = {
      message: (data) => {
        if (!closed) handlers.onMessage(data)
      },
      open: () => {
        if (closed) return
        attempts = 0
        setStatus('open')
        handlers.onOpen?.()
      },
      error: (err) => {
        if (!closed) handlers.onError?.(err)
      },
      close: () => {
        if (closed) return
        handlers.onClose?.()
        disconnect = undefined
        scheduleReconnect()
      },
    }
    disconnect = connect(sink)
  }

  const scheduleReconnect = (): void => {
    if (closed) return
    if (attempts >= maxRetries) {
      setStatus('closed')
      return
    }
    const delay = backoffFor(attempts)
    attempts += 1
    setStatus('reconnecting')
    cancelReconnect = schedule(() => {
      cancelReconnect = undefined
      doConnect()
    }, delay)
  }

  return {
    get status() {
      return status
    },
    get attempts() {
      return attempts
    },
    open() {
      if (closed || status === 'open' || status === 'connecting' || status === 'reconnecting') {
        return
      }
      attempts = 0
      doConnect()
    },
    close() {
      if (closed) return
      closed = true
      cancelReconnect?.()
      cancelReconnect = undefined
      disconnect?.()
      disconnect = undefined
      setStatus('closed')
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
