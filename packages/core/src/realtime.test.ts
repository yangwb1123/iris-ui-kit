import { describe, it, expect, vi } from 'vitest'
import { createReconnectingSource, type RealtimeSink } from './realtime'

/** A controllable fake transport + a manual scheduler for deterministic tests. */
function harness() {
  const sinks: RealtimeSink<number>[] = []
  const disconnect = vi.fn()
  const connect = vi.fn((sink: RealtimeSink<number>) => {
    sinks.push(sink)
    return disconnect
  })
  const pending: Array<{ fn: () => void; ms: number }> = []
  const schedule = (fn: () => void, ms: number) => {
    const item = { fn, ms }
    pending.push(item)
    return () => {
      const i = pending.indexOf(item)
      if (i !== -1) pending.splice(i, 1)
    }
  }
  const runNext = () => {
    const item = pending.shift()
    item?.fn()
    return item?.ms
  }
  return {
    sinks,
    connect,
    disconnect,
    schedule,
    pending,
    runNext,
    last: () => sinks[sinks.length - 1]!,
  }
}

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
    src.close()
    expect(src.status).toBe('closed')
    expect(h.pending).toHaveLength(0) // cancelled, no further attempts
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

  it('open() is idempotent while active', () => {
    const h = harness()
    const src = createReconnectingSource<number>(
      h.connect,
      { onMessage: () => {} },
      { schedule: h.schedule },
    )
    src.open()
    src.open()
    src.open()
    expect(h.connect).toHaveBeenCalledTimes(1)
  })
})
