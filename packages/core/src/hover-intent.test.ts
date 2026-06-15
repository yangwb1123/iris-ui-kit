import { describe, expect, it } from 'vitest'
import { createHoverIntent } from './hover-intent'
import type { Scheduler } from './machine'

/** Deterministic, manually-advanced fake scheduler (no real-time waits). */
function fakeScheduler() {
  let now = 0
  let seq = 0
  const timers = new Map<number, { at: number; fn: () => void }>()
  const scheduler: Scheduler = {
    setTimeout(fn, ms) {
      const id = seq++
      timers.set(id, { at: now + ms, fn })
      return id
    },
    clearTimeout(handle) {
      timers.delete(handle as number)
    },
  }
  const advance = (ms: number): void => {
    const target = now + ms
    for (;;) {
      let next: { id: number; at: number; fn: () => void } | undefined
      for (const [id, t] of timers) {
        if (t.at <= target && (!next || t.at < next.at)) next = { id, ...t }
      }
      if (!next) break
      now = next.at
      timers.delete(next.id)
      next.fn()
    }
    now = target
  }
  return {
    scheduler,
    advance,
    get pending() {
      return timers.size
    },
  }
}

describe('createHoverIntent', () => {
  it('opens only after openDelay elapses', () => {
    const fake = fakeScheduler()
    const h = createHoverIntent({ openDelay: 100, closeDelay: 100, scheduler: fake.scheduler })
    expect(h.isOpen()).toBe(false)
    h.pointerEnter()
    expect(h.machine.store.getState().value).toBe('opening')
    expect(h.isOpen()).toBe(false)
    fake.advance(99)
    expect(h.isOpen()).toBe(false)
    fake.advance(1)
    expect(h.machine.store.getState().value).toBe('open')
    expect(h.isOpen()).toBe(true)
  })

  it('closes only after closeDelay elapses', () => {
    const fake = fakeScheduler()
    const h = createHoverIntent({ openDelay: 0, closeDelay: 200, scheduler: fake.scheduler })
    h.pointerEnter()
    fake.advance(0)
    expect(h.machine.store.getState().value).toBe('open')
    h.pointerLeave()
    expect(h.machine.store.getState().value).toBe('closing')
    expect(h.isOpen()).toBe(true) // still showing during the grace period
    fake.advance(199)
    expect(h.machine.store.getState().value).toBe('closing')
    fake.advance(1)
    expect(h.machine.store.getState().value).toBe('closed')
    expect(h.isOpen()).toBe(false)
  })

  it('re-entering during the close grace cancels the pending close', () => {
    const fake = fakeScheduler()
    const h = createHoverIntent({ openDelay: 0, closeDelay: 200, scheduler: fake.scheduler })
    h.pointerEnter()
    fake.advance(0)
    h.pointerLeave()
    expect(fake.pending).toBe(1)
    h.pointerEnter() // cancels the close timer, returns to open
    expect(fake.pending).toBe(0)
    expect(h.machine.store.getState().value).toBe('open')
    fake.advance(1000)
    expect(h.machine.store.getState().value).toBe('open') // never closed
  })

  it('leaving during the open dwell cancels the pending open', () => {
    const fake = fakeScheduler()
    const h = createHoverIntent({ openDelay: 150, closeDelay: 0, scheduler: fake.scheduler })
    h.pointerEnter()
    expect(h.machine.store.getState().value).toBe('opening')
    h.pointerLeave() // before the dwell completes
    expect(fake.pending).toBe(0)
    fake.advance(1000)
    expect(h.machine.store.getState().value).toBe('closed') // never opened
  })

  it('open()/close() bypass the delays', () => {
    const fake = fakeScheduler()
    const h = createHoverIntent({ openDelay: 500, closeDelay: 500, scheduler: fake.scheduler })
    h.open()
    expect(h.machine.store.getState().value).toBe('open')
    h.close()
    expect(h.machine.store.getState().value).toBe('closed')
  })

  it('stop() cancels pending timers', () => {
    const fake = fakeScheduler()
    const h = createHoverIntent({ openDelay: 100, scheduler: fake.scheduler })
    h.pointerEnter()
    h.stop()
    expect(fake.pending).toBe(0)
    fake.advance(1000)
    expect(h.machine.store.getState().value).toBe('opening')
  })
})
