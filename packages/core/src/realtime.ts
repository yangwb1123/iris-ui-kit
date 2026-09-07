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

const DEFAULT_BACKOFF_MS = 500
const DEFAULT_MAX_BACKOFF_MS = 30_000
const DEFAULT_FACTOR = 2

const isFiniteNonNegative = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value) && value >= 0

const normalizeFiniteNonNegative = (value: number | undefined, fallback: number): number =>
  isFiniteNonNegative(value) ? value : fallback

const normalizeMaxRetries = (value: number | undefined): number => {
  if (value === undefined || value === Infinity) return Infinity
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

type TransportRecord = {
  id: number
  ended: boolean
  disconnect?: () => void
}

type PendingReconnect = {
  cancelled: boolean
  cancel?: () => void
}

export function createReconnectingSource<T>(
  connect: RealtimeConnect<T>,
  handlers: RealtimeHandlers<T>,
  options: RealtimeOptions = {},
): RealtimeSource {
  const backoffMs = normalizeFiniteNonNegative(options.backoffMs, DEFAULT_BACKOFF_MS)
  const maxBackoffMs = normalizeFiniteNonNegative(options.maxBackoffMs, DEFAULT_MAX_BACKOFF_MS)
  const factor = normalizeFiniteNonNegative(options.factor, DEFAULT_FACTOR)
  const maxRetries = normalizeMaxRetries(options.maxRetries)
  const schedule = options.schedule ?? defaultSchedule

  let status: RealtimeStatus = 'idle'
  let attempts = 0
  let permanentlyClosed = false
  let activeRecord: TransportRecord | undefined
  let nextRecordId = 0
  let pendingReconnect: PendingReconnect | undefined
  let connectInFlight = false
  let connectingRecord: TransportRecord | undefined
  let captureConnectCallbackError: ((error: unknown) => void) | undefined
  const listeners = new Set<(status: RealtimeStatus) => void>()

  const invokeUserCallback = (record: TransportRecord | undefined, callback: () => void): void => {
    try {
      callback()
    } catch (error) {
      if (connectInFlight && connectingRecord === record && captureConnectCallbackError) {
        captureConnectCallbackError(error)
        return
      }
      throw error
    }
  }

  const setStatus = (next: RealtimeStatus, record?: TransportRecord): void => {
    if (status === next) return
    status = next
    invokeUserCallback(record, () => handlers.onStatus?.(next))
    for (const listener of listeners) invokeUserCallback(record, () => listener(next))
  }

  const isCurrent = (record: TransportRecord): boolean =>
    !permanentlyClosed && activeRecord === record && !record.ended

  const detach = (record: TransportRecord): (() => void) | undefined => {
    record.ended = true
    if (activeRecord === record) activeRecord = undefined
    const teardown = record.disconnect
    record.disconnect = undefined
    return teardown
  }

  const reportErrorAndCaptureHandlerThrow = (
    error: unknown,
    capture: (handlerError: unknown) => void,
  ): void => {
    try {
      handlers.onError?.(error)
    } catch (handlerError) {
      capture(handlerError)
    }
  }

  const safelyDispose = (
    teardown: (() => void) | undefined,
    capture: (handlerError: unknown) => void,
  ): void => {
    if (!teardown) return
    try {
      teardown()
    } catch (error) {
      reportErrorAndCaptureHandlerThrow(error, capture)
    }
  }

  const backoffFor = (attempt: number): number => {
    if (backoffMs === 0 || maxBackoffMs === 0) return 0
    const growth = factor ** attempt
    if (!Number.isFinite(growth) || growth < 0) return maxBackoffMs
    const delay = backoffMs * growth
    if (!Number.isFinite(delay) || delay < 0) return maxBackoffMs
    return Math.min(maxBackoffMs, delay)
  }

  const doConnect = (): void => {
    if (permanentlyClosed || connectInFlight) return

    connectInFlight = true
    let deferredHandlerError: unknown
    let hasDeferredHandlerError = false
    const deferHandlerError = (error: unknown): void => {
      if (hasDeferredHandlerError) return
      deferredHandlerError = error
      hasDeferredHandlerError = true
    }
    captureConnectCallbackError = deferHandlerError

    try {
      const oldRecord = activeRecord
      const oldDisconnect = oldRecord ? detach(oldRecord) : undefined

      try {
        oldDisconnect?.()
      } catch (error) {
        reportErrorAndCaptureHandlerThrow(error, deferHandlerError)
      }

      if (!permanentlyClosed) {
        try {
          setStatus(attempts === 0 ? 'connecting' : 'reconnecting')
        } catch (error) {
          deferHandlerError(error)
        }
      }

      if (!permanentlyClosed) {
        const record: TransportRecord = {
          id: ++nextRecordId,
          ended: false,
        }
        activeRecord = record
        const sink: RealtimeSink<T> = {
          message: (data) => {
            if (!isCurrent(record)) return
            invokeUserCallback(record, () => handlers.onMessage(data))
          },
          open: () => {
            if (!isCurrent(record)) return
            attempts = 0
            setStatus('open', record)
            if (isCurrent(record)) invokeUserCallback(record, () => handlers.onOpen?.())
          },
          error: (err) => {
            if (!isCurrent(record)) return
            invokeUserCallback(record, () => handlers.onError?.(err))
          },
          close: () => {
            if (!isCurrent(record)) return
            record.ended = true
            try {
              invokeUserCallback(record, () => handlers.onClose?.())
            } finally {
              scheduleReconnect(record)
            }
          },
        }

        let returnedDisconnect: (() => void) | undefined
        let connectFailed = false
        connectingRecord = record
        try {
          returnedDisconnect = connect(sink)
        } catch (error) {
          connectFailed = true

          if (!permanentlyClosed) {
            detach(record)
            reportErrorAndCaptureHandlerThrow(error, deferHandlerError)
            scheduleReconnect(record)
          }
        } finally {
          connectingRecord = undefined
        }

        if (!connectFailed) {
          if (isCurrent(record)) {
            record.disconnect = returnedDisconnect
          } else {
            safelyDispose(returnedDisconnect, deferHandlerError)
          }
        }
      }
    } finally {
      captureConnectCallbackError = undefined
      connectInFlight = false
    }

    if (hasDeferredHandlerError) throw deferredHandlerError
  }

  const scheduleReconnect = (record?: TransportRecord): void => {
    if (permanentlyClosed || pendingReconnect) return
    if (attempts >= maxRetries) {
      let deferredError: unknown
      let hasDeferredError = false
      const deferError = (error: unknown): void => {
        if (hasDeferredError) return
        deferredError = error
        hasDeferredError = true
      }

      const endedRecord = activeRecord
      const teardown = endedRecord?.ended ? detach(endedRecord) : undefined
      safelyDispose(teardown, deferError)
      try {
        setStatus('closed', record)
      } catch (error) {
        deferError(error)
      }

      if (hasDeferredError) throw deferredError
      return
    }

    const attempt = attempts
    attempts += 1
    const token: PendingReconnect = { cancelled: false }
    pendingReconnect = token

    let deferredStatusError: unknown
    let hasDeferredStatusError = false
    const deferStatusError = (error: unknown): void => {
      if (hasDeferredStatusError) return
      deferredStatusError = error
      hasDeferredStatusError = true
    }

    try {
      try {
        setStatus('reconnecting', record)
      } catch (error) {
        deferStatusError(error)
      }
      if (permanentlyClosed || pendingReconnect !== token || token.cancelled) return

      token.cancel = schedule(() => {
        if (permanentlyClosed || pendingReconnect !== token || token.cancelled) return
        pendingReconnect = undefined
        doConnect()
      }, backoffFor(attempt))
    } finally {
      if (pendingReconnect === token && !token.cancel) {
        pendingReconnect = undefined
        token.cancelled = true
      }
    }

    if (hasDeferredStatusError) throw deferredStatusError
  }

  return {
    get status() {
      return status
    },
    get attempts() {
      return attempts
    },
    open() {
      if (
        permanentlyClosed ||
        status === 'open' ||
        status === 'connecting' ||
        status === 'reconnecting'
      ) {
        return
      }
      attempts = 0
      doConnect()
    },
    close() {
      if (permanentlyClosed) return
      permanentlyClosed = true

      let deferredError: unknown
      let hasDeferredError = false
      const deferError = (error: unknown): void => {
        if (hasDeferredError) return
        deferredError = error
        hasDeferredError = true
      }

      const pending = pendingReconnect
      pendingReconnect = undefined
      if (pending) {
        pending.cancelled = true
        const cancel = pending.cancel
        pending.cancel = undefined
        if (cancel) {
          try {
            cancel()
          } catch (error) {
            reportErrorAndCaptureHandlerThrow(error, deferError)
          }
        }
      }

      const record = activeRecord
      const teardown = record ? detach(record) : undefined
      try {
        teardown?.()
      } catch (error) {
        reportErrorAndCaptureHandlerThrow(error, deferError)
      } finally {
        try {
          setStatus('closed')
        } catch (error) {
          deferError(error)
        }
      }

      if (hasDeferredError) throw deferredError
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
