import { describe, expect, it, vi } from 'vitest'
import { createReconnectingSource, type RealtimeSink } from './realtime'
import { harness } from './realtime.test-support'

describe('createReconnectingSource', () => {
  it('connects and transitions idle → connecting → open', () => {
    const h = harness()
    const statuses: string[] = []
    const src = createReconnectingSource<number>(
      h.connect,
      { onMessage: () => {}, onStatus: (s) => statuses.push(s) },
      { schedule: h.schedule },
    )
    expect(src.status).toBe('idle')
    src.open()
    expect(src.status).toBe('connecting')
    h.last().open()
    expect(src.status).toBe('open')
    expect(statuses).toEqual(['connecting', 'open'])
  })

  it('delivers messages to onMessage', () => {
    const h = harness()
    const onMessage = vi.fn()
    const src = createReconnectingSource<number>(h.connect, { onMessage }, { schedule: h.schedule })
    src.open()
    h.last().open()
    h.last().message(1)
    h.last().message(2)
    expect(onMessage).toHaveBeenCalledTimes(2)
    expect(onMessage).toHaveBeenLastCalledWith(2)
  })

  it('reconnects with exponential backoff after a close', () => {
    const h = harness()
    const src = createReconnectingSource<number>(
      h.connect,
      { onMessage: () => {} },
      { backoffMs: 100, factor: 2, schedule: h.schedule },
    )
    src.open()
    h.last().open()
    expect(h.connect).toHaveBeenCalledTimes(1)

    h.last().close() // transport dropped
    expect(src.status).toBe('reconnecting')
    expect(h.pending[0]!.ms).toBe(100) // first backoff = base
    h.runNext()
    expect(h.connect).toHaveBeenCalledTimes(2)

    h.last().close()
    expect(h.pending[0]!.ms).toBe(200) // 100 * 2^1
    h.runNext()
    expect(h.connect).toHaveBeenCalledTimes(3)

    h.last().close()
    expect(h.pending[0]!.ms).toBe(400) // 100 * 2^2
  })

  it('caps backoff at maxBackoffMs', () => {
    const h = harness()
    const src = createReconnectingSource<number>(
      h.connect,
      { onMessage: () => {} },
      { backoffMs: 1000, factor: 10, maxBackoffMs: 5000, schedule: h.schedule },
    )
    src.open()
    h.last().close() // attempt 0 → 1000
    expect(h.pending[0]!.ms).toBe(1000)
    h.runNext()
    h.last().close() // attempt 1 → 10000 capped to 5000
    expect(h.pending[0]!.ms).toBe(5000)
  })

  it('normalizes NaN/Infinity/negative timing inputs to safe default backoff delays', () => {
    const h = harness()
    const src = createReconnectingSource<number>(
      h.connect,
      { onMessage: () => {} },
      {
        backoffMs: Number.POSITIVE_INFINITY,
        maxBackoffMs: Number.NaN,
        factor: -2,
        schedule: h.schedule,
      },
    )

    src.open()
    h.last().close()
    expect(h.pending[0]!.ms).toBe(500)
    h.runNext()
    h.last().close()
    expect(h.pending[0]!.ms).toBe(1000)
  })

  it('a successful open resets the backoff attempt counter', () => {
    const h = harness()
    const src = createReconnectingSource<number>(
      h.connect,
      { onMessage: () => {} },
      { backoffMs: 100, factor: 2, schedule: h.schedule },
    )
    src.open()
    h.last().close()
    expect(h.pending[0]!.ms).toBe(100)
    h.runNext()
    h.last().open() // reconnected successfully
    expect(src.attempts).toBe(0)
    h.last().close() // next backoff starts from base again
    expect(h.pending[0]!.ms).toBe(100)
  })

  it('gives up after maxRetries and goes to closed', () => {
    const h = harness()
    const src = createReconnectingSource<number>(
      h.connect,
      { onMessage: () => {} },
      { backoffMs: 10, maxRetries: 2, schedule: h.schedule },
    )
    src.open()
    h.last().close() // attempt 1 scheduled
    h.runNext()
    h.last().close() // attempt 2 scheduled
    h.runNext()
    h.last().close() // attempts (2) >= maxRetries (2) → give up
    expect(src.status).toBe('closed')
    expect(h.pending).toHaveLength(0)
  })

  it('floors fractional maxRetries to a non-negative retry budget', () => {
    const h = harness()
    const src = createReconnectingSource<number>(
      h.connect,
      { onMessage: () => {} },
      { backoffMs: 10, maxRetries: 1.9, schedule: h.schedule },
    )

    src.open()
    h.last().close()
    expect(src.status).toBe('reconnecting')
    expect(src.attempts).toBe(1)
    expect(h.pending).toHaveLength(1)
    h.runNext()
    h.last().close()
    expect(src.status).toBe('closed')
    expect(src.attempts).toBe(1)
    expect(h.pending).toHaveLength(0)
  })

  it.each([
    ['NaN', Number.NaN],
    ['negative', -1],
  ])('treats %s maxRetries as zero retries', (_label: string, maxRetries: number) => {
    const h = harness()
    const src = createReconnectingSource<number>(
      h.connect,
      { onMessage: () => {} },
      { backoffMs: 10, maxRetries, schedule: h.schedule },
    )

    src.open()
    h.last().close()

    expect(src.status).toBe('closed')
    expect(src.attempts).toBe(0)
    expect(h.pending).toHaveLength(0)
    expect(h.connect).toHaveBeenCalledTimes(1)
  })

  it('reports and disposes a throwing final teardown once at retry exhaustion', () => {
    const h = harness()
    const error = new Error('final disconnect failed')
    const onError = vi.fn()
    const finalDisconnect = vi.fn(() => {
      throw error
    })
    h.connect.mockImplementation((sink: RealtimeSink<number>) => {
      h.sinks.push(sink)
      return h.sinks.length === 3 ? finalDisconnect : h.disconnect
    })
    const src = createReconnectingSource<number>(
      h.connect,
      { onMessage: () => {}, onError },
      { backoffMs: 10, maxRetries: 2, schedule: h.schedule },
    )

    src.open()
    h.last().close()
    h.runNext()
    h.last().close()
    h.runNext()
    h.last().close()

    expect(onError).toHaveBeenCalledWith(error)
    expect(src.status).toBe('closed')
    expect(h.pending).toHaveLength(0)
    expect(finalDisconnect).toHaveBeenCalledTimes(1)
    expect(h.disconnect).toHaveBeenCalledTimes(2)
  })

  it('close() while open disconnects the live transport', () => {
    const h = harness()
    const src = createReconnectingSource<number>(
      h.connect,
      { onMessage: () => {} },
      { schedule: h.schedule },
    )
    src.open()
    h.last().open()
    src.close()
    expect(src.status).toBe('closed')
    expect(h.disconnect).toHaveBeenCalledTimes(1)
  })

  it('close() cancels a pending reconnect', () => {
    const h = harness()
    const src = createReconnectingSource<number>(
      h.connect,
      { onMessage: () => {} },
      { backoffMs: 100, schedule: h.schedule },
    )
    src.open()
    h.last().open()
    h.last().close() // transport dropped → reconnect scheduled, old conn dead
    expect(h.pending).toHaveLength(1)
    const staleReconnect = h.pending[0]!.fn
    src.close()
    expect(src.status).toBe('closed')
    expect(h.pending).toHaveLength(0) // cancelled, no further attempts
    staleReconnect()
    expect(h.connect).toHaveBeenCalledTimes(1)
  })

  it('ignores transport callbacks after close()', () => {
    const h = harness()
    const onMessage = vi.fn()
    const src = createReconnectingSource<number>(h.connect, { onMessage }, { schedule: h.schedule })
    src.open()
    const sink = h.last()
    src.close()
    sink.message(1)
    sink.open()
    sink.close()
    expect(onMessage).not.toHaveBeenCalled()
    expect(src.status).toBe('closed')
    expect(h.pending).toHaveLength(0)
  })

  it('ignores callbacks from an obsolete transport after reconnecting', () => {
    const h = harness()
    const onMessage = vi.fn()
    const onOpen = vi.fn()
    const onError = vi.fn()
    const onClose = vi.fn()
    const src = createReconnectingSource<number>(
      h.connect,
      { onMessage, onOpen, onError, onClose },
      { backoffMs: 10, schedule: h.schedule },
    )

    src.open()
    const first = h.last()
    first.open()
    first.close()
    h.runNext()
    expect(h.connect).toHaveBeenCalledTimes(2)
    expect(src.status).toBe('reconnecting')
    expect(src.attempts).toBe(1)
    expect(h.pending).toHaveLength(0)

    first.message(1)
    first.open()
    first.error(new Error('stale'))
    first.close()

    expect(onMessage).not.toHaveBeenCalled()
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(src.status).toBe('reconnecting')
    expect(src.attempts).toBe(1)
    expect(h.pending).toHaveLength(0)
    expect(h.connect).toHaveBeenCalledTimes(2)
  })

  it('ignores duplicate close callbacks from the current transport', () => {
    const h = harness()
    const onClose = vi.fn()
    const src = createReconnectingSource<number>(
      h.connect,
      { onMessage: () => {}, onClose },
      { backoffMs: 10, schedule: h.schedule },
    )

    src.open()
    const sink = h.last()
    sink.close()
    sink.close()

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(src.attempts).toBe(1)
    expect(h.pending).toHaveLength(1)
    h.runNext()
    expect(h.connect).toHaveBeenCalledTimes(2)
  })
})
