import { cleanup, fireEvent, render } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tick } from 'svelte'
import CountdownFeedbackHarness from './CountdownFeedbackHarness.svelte'
import IrisCountdown from './IrisCountdown.svelte'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1000)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('countdown feedback ownership', () => {
  it('fires once when an expired callback reads and writes parent reactive state', async () => {
    const { container, getByRole, rerender, unmount } = render(CountdownFeedbackHarness, {
      props: { value: 999, now: 1000 },
    })
    await tick()
    expect(container.querySelector('[data-finish-count]')?.textContent).toBe('1')
    expect(vi.getTimerCount()).toBe(0)

    await fireEvent.click(getByRole('button', { name: 'Unrelated: 0' }))
    await tick()
    expect(getByRole('button', { name: 'Unrelated: 1' })).toBeTruthy()
    expect(container.querySelector('[data-finish-count]')?.textContent).toBe('1')

    await rerender({ value: 2000, now: 1000 })
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(1000)
    await tick()
    expect(container.querySelector('[data-finish-count]')?.textContent).toBe('2')
    expect(vi.getTimerCount()).toBe(0)

    await vi.advanceTimersByTimeAsync(5000)
    expect(container.querySelector('[data-finish-count]')?.textContent).toBe('2')
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('uses the current callback without restarting a pending timer on callback replacement', async () => {
    const first = vi.fn()
    const replacement = vi.fn()
    const { getByRole, unmount } = render(CountdownFeedbackHarness, {
      props: { value: 2000, now: 1000, onfinish: first, replacement },
    })
    await vi.advanceTimersByTimeAsync(500)
    // Native per-prop reactivity: testing-library rerender replaces one aggregate
    // raw props object and invalidates configuration reads even if unchanged.
    await fireEvent.click(getByRole('button', { name: 'Replace callback' }))
    await vi.advanceTimersByTimeAsync(500)
    await tick()
    expect(first).not.toHaveBeenCalled()
    expect(replacement).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    unmount()
  })

  it('does not restart each tick and disposes an unfinished interval on unmount', async () => {
    const finish = vi.fn()
    const { container, unmount } = render(IrisCountdown, {
      props: { value: 4000, now: 1000, onfinish: finish },
    })
    await vi.advanceTimersByTimeAsync(1000)
    await tick()
    expect(container.querySelector('[data-iris-countdown-time]')?.textContent).toBe('00:00:02')
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(5000)
    expect(finish).not.toHaveBeenCalled()
  })
})
