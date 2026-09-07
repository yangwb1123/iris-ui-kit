import { describe, expect, it, vi } from 'vitest'
import { createReconnectingSource, type RealtimeSink } from './realtime'
import { harness } from './realtime.test-support'

describe('createReconnectingSource', () => {
  it('reports a synchronous connect failure and retries normally', () => {
    const h = harness()
    const error = new Error('connect failed')
    const onError = vi.fn()
    h.connect.mockImplementation(() => {
      throw error
    })
    const src = createReconnectingSource<number>(
      h.connect,
      { onMessage: () => {}, onError },
      { backoffMs: 10, schedule: h.schedule },
    )

    expect(() => src.open()).not.toThrow()
    expect(onError).toHaveBeenCalledWith(error)
    expect(src.status).toBe('reconnecting')
    expect(src.attempts).toBe(1)
    expect(h.pending).toHaveLength(1)
    expect(h.pending[0]!.ms).toBe(10)
  })

  it('still schedules reconnect when onStatus throws during a reconnect transition', () => {
    const h = harness()
    const error = new Error('status failed')
    const onStatus = vi.fn((status: string) => {
      if (status === 'reconnecting') throw error
    })
    const src = createReconnectingSource<number>(
      h.connect,
      { onMessage: () => {}, onStatus },
      { backoffMs: 10, schedule: h.schedule },
    )

    src.open()
    h.last().open()
    expect(() => h.last().close()).toThrow(error)

    expect(src.status).toBe('reconnecting')
    expect(src.attempts).toBe(1)
    expect(h.pending).toHaveLength(1)
    expect(h.pending[0]!.ms).toBe(10)
  })

  it('preserves a synchronous connect teardown when onOpen throws', () => {
    const h = harness()
    const error = new Error('open failed')
    const returnedDisconnect = vi.fn()
    h.connect.mockImplementationOnce((sink: RealtimeSink<number>) => {
      h.sinks.push(sink)
      sink.open()
      return returnedDisconnect
    })
    const src = createReconnectingSource<number>(
      h.connect,
      {
        onMessage: () => {},
        onOpen: () => {
          throw error
        },
      },
      { schedule: h.schedule },
    )

    expect(() => src.open()).toThrow(error)
    expect(src.status).toBe('open')
    src.close()
    expect(src.status).toBe('closed')
    expect(returnedDisconnect).toHaveBeenCalledTimes(1)
  })

  it('exhausts retries when reconnect connects throw synchronously', () => {
    const h = harness()
    const error = new Error('connect failed')
    const onError = vi.fn()
    h.connect.mockImplementation(() => {
      throw error
    })
    const src = createReconnectingSource<number>(
      h.connect,
      { onMessage: () => {}, onError },
      { backoffMs: 10, maxRetries: 2, schedule: h.schedule },
    )

    src.open()
    h.runNext()
    expect(src.status).toBe('reconnecting')
    expect(src.attempts).toBe(2)
    expect(h.pending).toHaveLength(1)
    h.runNext()

    expect(src.status).toBe('closed')
    expect(src.attempts).toBe(2)
    expect(h.pending).toHaveLength(0)
    expect(h.connect).toHaveBeenCalledTimes(3)
    expect(onError).toHaveBeenCalledTimes(3)
  })

  it('reports a replacement teardown failure and still connects once', () => {
    const h = harness()
    const error = new Error('disconnect failed')
    const onError = vi.fn()
    h.disconnect.mockImplementationOnce(() => {
      throw error
    })
    const src = createReconnectingSource<number>(
      h.connect,
      { onMessage: () => {}, onError },
      { backoffMs: 10, schedule: h.schedule },
    )

    src.open()
    h.last().close()
    h.runNext()

    expect(h.disconnect).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(error)
    expect(h.connect).toHaveBeenCalledTimes(2)
    expect(src.status).toBe('reconnecting')
    expect(src.attempts).toBe(1)
    expect(h.pending).toHaveLength(0)
  })

  it('reports a terminal close teardown failure and stays permanently closed', () => {
    const h = harness()
    const error = new Error('disconnect failed')
    const onError = vi.fn()
    h.disconnect.mockImplementationOnce(() => {
      throw error
    })
    const src = createReconnectingSource<number>(
      h.connect,
      { onMessage: () => {}, onError },
      { schedule: h.schedule },
    )

    src.open()
    const sink = h.last()
    src.close()

    expect(onError).toHaveBeenCalledWith(error)
    expect(src.status).toBe('closed')
    expect(h.pending).toHaveLength(0)
    expect(h.connect).toHaveBeenCalledTimes(1)
    src.open()
    sink.message(1)
    sink.open()
    sink.close()
    expect(h.connect).toHaveBeenCalledTimes(1)
    expect(src.status).toBe('closed')
  })

  it('disposes a teardown returned after a synchronous sink close', () => {
    const h = harness()
    const returnedDisconnect = vi.fn()
    const onClose = vi.fn()
    h.connect.mockImplementationOnce((sink: RealtimeSink<number>) => {
      h.sinks.push(sink)
      sink.close()
      return returnedDisconnect
    })
    const src = createReconnectingSource<number>(
      h.connect,
      { onMessage: () => {}, onClose },
      { backoffMs: 10, schedule: h.schedule },
    )

    src.open()

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(returnedDisconnect).toHaveBeenCalledTimes(1)
    expect(src.status).toBe('reconnecting')
    expect(src.attempts).toBe(1)
    expect(h.pending).toHaveLength(1)
  })

  it('schedules a retry even when onClose throws', () => {
    const h = harness()
    const error = new Error('close callback failed')
    const onClose = vi.fn(() => {
      throw error
    })
    const src = createReconnectingSource<number>(
      h.connect,
      { onMessage: () => {}, onClose },
      { backoffMs: 10, schedule: h.schedule },
    )

    src.open()
    expect(() => h.last().close()).toThrow(error)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(src.status).toBe('reconnecting')
    expect(src.attempts).toBe(1)
    expect(h.pending).toHaveLength(1)
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
