import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisCountdown, formatRemaining } from './IrisCountdown'

afterEach(cleanup)

describe('formatRemaining', () => {
  it('formats HH:mm:ss correctly', () => {
    expect(formatRemaining(3661000, 'HH:mm:ss')).toBe('01:01:01')
  })

  it('formats with days', () => {
    expect(formatRemaining(90061000, 'DD:HH:mm:ss')).toBe('01:01:01:01')
  })

  it('clamps negative to 0', () => {
    expect(formatRemaining(-1000, 'HH:mm:ss')).toBe('00:00:00')
  })
})

describe('IrisCountdown', () => {
  it('renders without crashing', () => {
    const target = Date.now() + 60000
    const { container } = render(() => <IrisCountdown value={target} />)
    expect(container.querySelector('[data-iris-countdown]')).not.toBeNull()
  })

  it('shows finished state for past target', () => {
    const past = Date.now() - 1000
    const { container } = render(() => <IrisCountdown value={past} />)
    expect(container.querySelector('[data-finished="true"]')).not.toBeNull()
  })

  it('calls onFinish when target is in past', () => {
    const onFinish = vi.fn()
    const past = Date.now() - 1000
    render(() => <IrisCountdown value={past} onFinish={onFinish} />)
    expect(onFinish).toHaveBeenCalled()
  })

  it('renders title and prefix', () => {
    const target = Date.now() + 60000
    const { getByText } = render(() => (
      <IrisCountdown value={target} title="Time Left" prefix="→" />
    ))
    expect(getByText('Time Left')).toBeTruthy()
    expect(getByText('→')).toBeTruthy()
  })

  it('renders suffix', () => {
    const target = Date.now() + 60000
    const { getByText } = render(() => <IrisCountdown value={target} suffix="remaining" />)
    expect(getByText('remaining')).toBeTruthy()
  })

  it('forwards class', () => {
    const target = Date.now() + 60000
    const { container } = render(() => <IrisCountdown value={target} class="my-counter" />)
    expect(container.querySelector('[data-iris-countdown]')?.className).toContain('my-counter')
  })

  it('handles custom format', () => {
    const target = Date.now() + 90061000
    const { container } = render(() => <IrisCountdown value={target} format="DD:HH:mm:ss" />)
    const el = container.querySelector('[data-iris-countdown-value]')
    expect(el?.textContent).toMatch(/\d{2}:\d{2}:\d{2}:\d{2}/)
  })

  it('displays formatted time in HH:mm:ss format', () => {
    // The Solid render takes a few ms, so the remaining time may be slightly less
    const target = Date.now() + 3600000 + 60000 + 1000  // 1h 1m 1s
    const { container } = render(() => <IrisCountdown value={target} format="HH:mm:ss" />)
    const el = container.querySelector('[data-iris-countdown-value]')
    // Should show 01:01:01 or close to it (render delay may subtract 1 second)
    expect(el?.textContent).toMatch(/01:01:(0[0-9]|10)/)
  })
})
