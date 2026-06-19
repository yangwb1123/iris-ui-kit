import { describe, it, expect, vi } from 'vitest'
import { createLongPress } from './long-press'
import type { Scheduler } from './machine'

/** A deterministic scheduler whose clock is advanced manually. */
function fakeScheduler(): { scheduler: Scheduler; advance: (ms: number) => void } {
  let id = 0
  let clock = 0
  const timers = new Map<number, { fn: () => void; at: number }>()
  return {
    scheduler: {
      setTimeout: (fn, ms) => {
        const t = ++id
        timers.set(t, { fn, at: clock + ms })
        return t
      },
      clearTimeout: (h) => {
        timers.delete(h as number)
      },
      now: () => clock,
    },
    advance: (ms) => {
      clock += ms
      for (const [t, timer] of [...timers]) {
        if (timer.at <= clock) {
          timers.delete(t)
          timer.fn()
        }
      }
    },
  }
}

describe('createLongPress', () => {
  it('fires onLongPress after holdDelay of continuous press', () => {
    const { scheduler, advance } = fakeScheduler()
    const onLongPress = vi.fn()
    const lp = createLongPress({ holdDelay: 500, onLongPress, scheduler })
    lp.press()
    expect(lp.state()).toBe('pressing')
    advance(499)
    expect(onLongPress).not.toHaveBeenCalled()
    advance(1)
    expect(onLongPress).toHaveBeenCalledTimes(1)
    expect(lp.state()).toBe('fired')
  })

  it('release before holdDelay does NOT fire', () => {
    const { scheduler, advance } = fakeScheduler()
    const onLongPress = vi.fn()
    const lp = createLongPress({ holdDelay: 500, onLongPress, scheduler })
    lp.press()
    advance(300)
    lp.release()
    expect(lp.state()).toBe('idle')
    advance(1000)
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('cancel before holdDelay does NOT fire', () => {
    const { scheduler, advance } = fakeScheduler()
    const onLongPress = vi.fn()
    const lp = createLongPress({ holdDelay: 500, onLongPress, scheduler })
    lp.press()
    lp.cancel()
    advance(1000)
    expect(onLongPress).not.toHaveBeenCalled()
    expect(lp.state()).toBe('idle')
  })

  it('release after fire resets to idle for the next press', () => {
    const { scheduler, advance } = fakeScheduler()
    const onLongPress = vi.fn()
    const lp = createLongPress({ holdDelay: 100, onLongPress, scheduler })
    lp.press()
    advance(100)
    expect(lp.state()).toBe('fired')
    lp.release()
    expect(lp.state()).toBe('idle')
    lp.press()
    advance(100)
    expect(onLongPress).toHaveBeenCalledTimes(2)
  })

  it('holdDelay of Infinity never fires', () => {
    const { scheduler, advance } = fakeScheduler()
    const onLongPress = vi.fn()
    const lp = createLongPress({ holdDelay: Infinity, onLongPress, scheduler })
    lp.press()
    advance(1_000_000)
    expect(onLongPress).not.toHaveBeenCalled()
  })
})
