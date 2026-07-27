import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { IrisCountdown } from './Countdown'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const time = (c: HTMLElement) => c.querySelector('[data-iris-countdown-time]')?.textContent

describe('@iris-ui-kit/react IrisCountdown', () => {
  it('renders the remaining time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const { container } = render(<IrisCountdown value={3661000} />)
    expect(time(container)).toBe('01:01:01')
  })

  it('ticks down each second', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const { container } = render(<IrisCountdown value={5000} />)
    expect(time(container)).toBe('00:00:05')
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(time(container)).toBe('00:00:03')
  })

  it('fires onFinish at zero and shows zeros', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const onFinish = vi.fn()
    const { container } = render(<IrisCountdown value={2000} onFinish={onFinish} />)
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(time(container)).toBe('00:00:00')
  })

  it('supports a custom format with days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const { container } = render(<IrisCountdown value={90061000} format="DD HH:mm:ss" />)
    expect(time(container)).toBe('01 01:01:01')
  })

  it('renders with title', () => {
    vi.useFakeTimers()
    const { container } = render(<IrisCountdown value={3661000} title="Time left" />)
    const title = container.querySelector('[data-iris-countdown-title]')
    expect(title?.textContent).toBe('Time left')
  })

  it('renders with prefix and suffix', () => {
    vi.useFakeTimers()
    const { container } = render(<IrisCountdown value={3661000} prefix="⏱" suffix="remaining" />)
    expect(container.textContent).toContain('⏱')
    expect(container.textContent).toContain('remaining')
  })

  it('forwards className', () => {
    vi.useFakeTimers()
    const { container } = render(<IrisCountdown value={3661000} className="my-counter" />)
    const el = container.querySelector('[data-iris-countdown]')
    expect(el?.className).toContain('my-counter')
  })

  it('handles size variants without error', () => {
    vi.useFakeTimers()
    const { container: sm } = render(<IrisCountdown value={3661000} size="sm" />)
    const { container: lg } = render(<IrisCountdown value={3661000} size="lg" />)
    expect(sm.querySelector('[data-iris-countdown]')).toBeTruthy()
    expect(lg.querySelector('[data-iris-countdown]')).toBeTruthy()
  })

  it('shows finished state with past date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1000000)
    const { container } = render(<IrisCountdown value={500} />)
    const el = container.querySelector('[data-iris-countdown]')
    expect(el?.getAttribute('data-finished')).toBe('true')
  })
})
