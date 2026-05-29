import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisCountdown } from './Countdown'

afterEach(() => vi.useRealTimers())

const time = (w: ReturnType<typeof mount>) => w.find('[data-iris-countdown-time]').text()

describe('IrisCountdown', () => {
  it('renders the remaining time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const w = mount(IrisCountdown, { props: { value: 3661000 } })
    expect(time(w)).toBe('01:01:01')
  })

  it('ticks down each second', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const w = mount(IrisCountdown, { props: { value: 5000 } })
    expect(time(w)).toBe('00:00:05')
    vi.advanceTimersByTime(2000)
    await nextTick()
    expect(time(w)).toBe('00:00:03')
  })

  it('emits finish at zero and shows zeros', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const w = mount(IrisCountdown, { props: { value: 2000 } })
    vi.advanceTimersByTime(2000)
    await nextTick()
    expect(w.emitted('finish')).toHaveLength(1)
    expect(time(w)).toBe('00:00:00')
  })

  it('supports a custom format with days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const w = mount(IrisCountdown, { props: { value: 90061000, format: 'DD HH:mm:ss' } })
    expect(time(w)).toBe('01 01:01:01')
  })
})
