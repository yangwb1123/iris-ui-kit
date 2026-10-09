import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createReconnectingSource, type RealtimeSink, type RealtimeStatus } from './realtime'
import { harness } from './realtime.test-support'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('release realtime branches', () => {
  it('uses the default timer scheduler and cancels it on permanent close', () => {
    const sinks: RealtimeSink<number>[] = []
    const disconnect = vi.fn()
    const connect = vi.fn((sink: RealtimeSink<number>) => {
      sinks.push(sink)
      return disconnect
    })
    const source = createReconnectingSource(connect, { onMessage: vi.fn() })
    source.open()
    sinks[0].close()
    expect(source.status).toBe('reconnecting')
    vi.advanceTimersByTime(499)
    expect(connect).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(1)
    expect(connect).toHaveBeenCalledTimes(2)
    expect(disconnect).toHaveBeenCalledOnce()
    sinks[1].close()
    source.close()
    vi.advanceTimersByTime(30_000)
    expect(source.status).toBe('closed')
    expect(connect).toHaveBeenCalledTimes(2)
    expect(disconnect).toHaveBeenCalledTimes(2)
  })

  it.each([
    { label: 'zero base', backoffMs: 0, maxBackoffMs: 40, factor: 2, delays: [0, 0] },
    { label: 'zero cap', backoffMs: 10, maxBackoffMs: 0, factor: 2, delays: [0, 0] },
    {
      label: 'overflowing growth',
      backoffMs: 1,
      maxBackoffMs: 40,
      factor: Number.MAX_VALUE,
      delays: [1, 40, 40],
    },
    {
      label: 'overflowing product',
      backoffMs: Number.MAX_VALUE,
      maxBackoffMs: 40,
      factor: 2,
      delays: [40, 40],
    },
  ])('keeps $label retry delays finite and bounded', ({ delays, ...options }) => {
    const h = harness()
    const source = createReconnectingSource(
      h.connect,
      { onMessage: vi.fn() },
      { ...options, schedule: h.schedule },
    )
    source.open()
    for (const delay of delays) {
      h.last().close()
      expect(h.pending[0].ms).toBe(delay)
      expect(h.runNext()).toBe(delay)
    }
    expect(source.attempts).toBe(delays.length)
    source.close()
    expect(source.status).toBe('closed')
  })

  it('allows a connecting observer to cancel before a transport is created', () => {
    const h = harness()
    const source = createReconnectingSource(
      h.connect,
      { onMessage: vi.fn() },
      { schedule: h.schedule },
    )
    const statuses: RealtimeStatus[] = []
    source.subscribe((status) => {
      statuses.push(status)
      if (status === 'connecting') source.close()
    })
    source.open()
    source.close()
    source.open()
    expect(statuses).toEqual(['connecting', 'closed'])
    expect(h.connect).not.toHaveBeenCalled()
    expect(source.status).toBe('closed')
  })

  it('honors owner cancellation inside the old transport teardown before replacement', () => {
    const h = harness()
    const source = createReconnectingSource(
      h.connect,
      { onMessage: vi.fn() },
      { schedule: h.schedule },
    )
    h.disconnect.mockImplementationOnce(() => source.close())
    source.open()
    h.last().close()
    h.runNext()
    expect(source.status).toBe('closed')
    expect(h.disconnect).toHaveBeenCalledOnce()
    expect(h.connect).toHaveBeenCalledOnce()
    expect(h.pending).toEqual([])
  })

  it('ignores a connect failure after the owner has already cancelled the source', () => {
    const h = harness()
    const onError = vi.fn()
    const source = createReconnectingSource(
      h.connect,
      { onMessage: vi.fn(), onError },
      { schedule: h.schedule },
    )
    h.connect.mockImplementationOnce(() => {
      source.close()
      throw new Error('connect failed after cancellation')
    })
    expect(() => source.open()).not.toThrow()
    expect(source.status).toBe('closed')
    expect(onError).not.toHaveBeenCalled()
    expect(h.pending).toEqual([])
  })

  it('reports live transport errors without reconnecting and ignores errors from ended transports', () => {
    const h = harness()
    const onError = vi.fn()
    const source = createReconnectingSource(
      h.connect,
      { onMessage: vi.fn(), onError },
      { schedule: h.schedule },
    )
    source.open()
    const old = h.last()
    old.open()
    const error = new Error('informational transport error')
    old.error(error)
    expect(onError).toHaveBeenCalledWith(error)
    expect(source.status).toBe('open')
    expect(source.attempts).toBe(0)
    expect(h.pending).toEqual([])
    old.close()
    h.runNext()
    old.error(new Error('obsolete error'))
    expect(onError).toHaveBeenCalledOnce()
    source.close()
  })

  it('propagates the first synchronous callback failure while retaining the returned teardown', () => {
    const h = harness()
    const first = new Error('message callback failed')
    const second = new Error('error callback failed')
    const onMessage = vi.fn(() => {
      throw first
    })
    const onError = vi.fn(() => {
      throw second
    })
    const onOpen = vi.fn()
    h.connect.mockImplementationOnce((sink) => {
      h.sinks.push(sink)
      sink.message(7)
      sink.error('transport warning')
      sink.open()
      return h.disconnect
    })
    const source = createReconnectingSource(
      h.connect,
      { onMessage, onError, onOpen },
      { schedule: h.schedule },
    )
    expect(() => source.open()).toThrow(first)
    expect(onMessage).toHaveBeenCalledWith(7)
    expect(onError).toHaveBeenCalledWith('transport warning')
    expect(onOpen).toHaveBeenCalledOnce()
    expect(source.status).toBe('open')
    source.close()
    expect(h.disconnect).toHaveBeenCalledOnce()
  })

  it('disposes a late teardown and skips onOpen when an open observer closes synchronously', () => {
    const h = harness()
    const onOpen = vi.fn()
    const source = createReconnectingSource(
      h.connect,
      {
        onMessage: vi.fn(),
        onOpen,
        onStatus: (status) => {
          if (status === 'open') source.close()
        },
      },
      { schedule: h.schedule },
    )
    h.connect.mockImplementationOnce((sink) => {
      sink.open()
      return h.disconnect
    })
    source.open()
    source.close()
    expect(source.status).toBe('closed')
    expect(onOpen).not.toHaveBeenCalled()
    expect(h.disconnect).toHaveBeenCalledOnce()
    expect(h.pending).toEqual([])
  })

  it.each(['onClose', 'onStatus'] as const)(
    'does not schedule retries after cancellation in %s',
    (callback) => {
      const h = harness()
      const schedule = vi.fn(h.schedule)
      const source = createReconnectingSource(
        h.connect,
        {
          onMessage: vi.fn(),
          onClose: () => {
            if (callback === 'onClose') source.close()
          },
          onStatus: (status) => {
            if (callback === 'onStatus' && status === 'reconnecting') source.close()
          },
        },
        { schedule },
      )
      source.open()
      h.last().close()
      expect(source.status).toBe('closed')
      expect(schedule).not.toHaveBeenCalled()
      expect(h.disconnect).toHaveBeenCalledOnce()
      source.open()
      expect(h.connect).toHaveBeenCalledOnce()
    },
  )

  it('propagates scheduler failure and still releases the ended transport on close', () => {
    const h = harness()
    const failure = new Error('scheduler unavailable')
    const schedule = vi.fn(() => {
      throw failure
    })
    const source = createReconnectingSource(h.connect, { onMessage: vi.fn() }, { schedule })
    source.open()
    expect(() => h.last().close()).toThrow(failure)
    expect(source.status).toBe('reconnecting')
    expect(source.attempts).toBe(1)
    source.close()
    expect(source.status).toBe('closed')
    expect(h.disconnect).toHaveBeenCalledOnce()
  })

  it('completes permanent cleanup and preserves the first handler error when cancellation and teardown throw', () => {
    const h = harness()
    const cancelError = new Error('cancel failed')
    const disconnectError = new Error('disconnect failed')
    const first = new Error('cancel error handler failed')
    const later = new Error('later handler failed')
    let retry!: () => void
    const cancel = vi.fn(() => {
      throw cancelError
    })
    const schedule = (fn: () => void) => {
      retry = fn
      return cancel
    }
    const onError = vi.fn((error: unknown) => {
      throw error === cancelError ? first : later
    })
    h.disconnect.mockImplementationOnce(() => {
      throw disconnectError
    })
    const source = createReconnectingSource(
      h.connect,
      {
        onMessage: vi.fn(),
        onError,
        onStatus: (status) => {
          if (status === 'closed') throw later
        },
      },
      { schedule },
    )
    source.open()
    h.last().close()
    expect(() => source.close()).toThrow(first)
    expect(onError.mock.calls).toEqual([[cancelError], [disconnectError]])
    expect(source.status).toBe('closed')
    expect(cancel).toHaveBeenCalledOnce()
    expect(h.disconnect).toHaveBeenCalledOnce()
    expect(() => source.close()).not.toThrow()
    retry()
    source.open()
    expect(h.connect).toHaveBeenCalledOnce()
  })

  it('disposes at retry exhaustion and preserves teardown-handler failure over a status failure', () => {
    const h = harness()
    const disconnectError = new Error('terminal teardown failed')
    const first = new Error('terminal error handler failed')
    const later = new Error('closed status failed')
    const onError = vi.fn(() => {
      throw first
    })
    h.disconnect.mockImplementationOnce(() => {
      throw disconnectError
    })
    const source = createReconnectingSource(
      h.connect,
      {
        onMessage: vi.fn(),
        onError,
        onStatus: (status) => {
          if (status === 'closed') throw later
        },
      },
      { maxRetries: 0, schedule: h.schedule },
    )
    source.open()
    expect(() => h.last().close()).toThrow(first)
    expect(onError).toHaveBeenCalledWith(disconnectError)
    expect(source.status).toBe('closed')
    expect(source.attempts).toBe(0)
    expect(h.pending).toEqual([])
    source.close()
    expect(h.disconnect).toHaveBeenCalledOnce()
  })
})
