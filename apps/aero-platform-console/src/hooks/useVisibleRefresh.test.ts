import { describe, expect, it, vi } from 'vitest'
import { startVisibleRefresh, type VisibleRefreshHost } from './useVisibleRefresh'

function fakeHost(initiallyVisible = true): VisibleRefreshHost & {
  fireVisibilityChange(): void
  setVisible(value: boolean): void
} {
  let visible = initiallyVisible
  let listener: () => void = () => undefined
  return {
    isVisible: () => visible,
    schedule: (callback, delayMs) => window.setTimeout(callback, delayMs),
    cancel: (handle) => window.clearTimeout(handle),
    subscribe: (callback) => {
      listener = callback
      return () => {
        listener = () => undefined
      }
    },
    fireVisibilityChange: () => listener(),
    setVisible: (value) => {
      visible = value
    },
  }
}

describe('visible refresh scheduler', () => {
  it('refreshes at one interval while the page remains visible', () => {
    vi.useFakeTimers()
    const refresh = vi.fn()
    const dispose = startVisibleRefresh(refresh, 1_000, fakeHost())

    vi.advanceTimersByTime(3_000)

    expect(refresh).toHaveBeenCalledTimes(3)
    dispose()
    vi.advanceTimersByTime(1_000)
    expect(refresh).toHaveBeenCalledTimes(3)
    vi.useRealTimers()
  })

  it('pauses while hidden and refreshes immediately when visible again', () => {
    vi.useFakeTimers()
    const host = fakeHost()
    const refresh = vi.fn()
    const dispose = startVisibleRefresh(refresh, 1_000, host)

    host.setVisible(false)
    host.fireVisibilityChange()
    vi.advanceTimersByTime(5_000)
    expect(refresh).not.toHaveBeenCalled()

    host.setVisible(true)
    host.fireVisibilityChange()
    expect(refresh).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1_000)
    expect(refresh).toHaveBeenCalledTimes(2)
    dispose()
    vi.useRealTimers()
  })
})
