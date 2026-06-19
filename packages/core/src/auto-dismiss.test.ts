import { describe, expect, it, vi } from 'vitest'
import { createAutoDismiss } from './auto-dismiss'
import type { Scheduler } from './machine'

/**
 * Deterministic, manually-advanced fake scheduler. It exposes `now()` (the same
 * monotonic clock it advances) so `createAutoDismiss`'s pause/resume elapsed math
 * is reproducible — no real-time waits, no jsdom flake.
 */
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
    now: () => now,
  }
  const advance = (ms: number): void => {
    const target = now + ms
    let safety = 0
    for (;;) {
      let next: { id: number; at: number; fn: () => void } | undefined
      for (const [id, t] of timers) {
        if (t.at <= target && (!next || t.at < next.at)) next = { id, ...t }
      }
      if (!next) break
      now = next.at
      timers.delete(next.id)
      next.fn()
      if (++safety > 10_000) throw new Error('timer loop')
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

describe('createAutoDismiss', () => {
  it('fires onDismiss after duration elapses', () => {
    const fake = fakeScheduler()
    const onDismiss = vi.fn()
    const d = createAutoDismiss({ duration: 500, onDismiss, scheduler: fake.scheduler })
    d.start()
    expect(d.state()).toBe('running')
    fake.advance(499)
    expect(onDismiss).not.toHaveBeenCalled()
    fake.advance(1)
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(d.state()).toBe('done')
  })

  it('pause prevents the fire and stops the clock', () => {
    const fake = fakeScheduler()
    const onDismiss = vi.fn()
    const d = createAutoDismiss({ duration: 500, onDismiss, scheduler: fake.scheduler })
    d.start()
    fake.advance(200)
    d.pause()
    expect(d.state()).toBe('paused')
    expect(fake.pending).toBe(0) // timer detached while paused
    fake.advance(10_000) // far past the original duration
    expect(onDismiss).not.toHaveBeenCalled()
    expect(d.state()).toBe('paused')
  })

  it('resume continues for the remaining time only', () => {
    const fake = fakeScheduler()
    const onDismiss = vi.fn()
    const d = createAutoDismiss({ duration: 500, onDismiss, scheduler: fake.scheduler })
    d.start()
    fake.advance(200) // 300ms remaining
    d.pause()
    fake.advance(1_000) // paused — clock irrelevant
    d.resume()
    expect(d.state()).toBe('running')
    fake.advance(299)
    expect(onDismiss).not.toHaveBeenCalled()
    fake.advance(1) // total running time = 200 + 300 = duration
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(d.state()).toBe('done')
  })

  it('cancel detaches: no fire, no pending timer', () => {
    const fake = fakeScheduler()
    const onDismiss = vi.fn()
    const d = createAutoDismiss({ duration: 500, onDismiss, scheduler: fake.scheduler })
    d.start()
    fake.advance(100)
    d.cancel()
    expect(fake.pending).toBe(0)
    fake.advance(10_000)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('duration=0 never arms (persistent)', () => {
    const fake = fakeScheduler()
    const onDismiss = vi.fn()
    const d = createAutoDismiss({ duration: 0, onDismiss, scheduler: fake.scheduler })
    d.start()
    expect(d.state()).toBe('idle')
    expect(fake.pending).toBe(0)
    fake.advance(10_000)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('duration=Infinity never arms (persistent)', () => {
    const fake = fakeScheduler()
    const onDismiss = vi.fn()
    const d = createAutoDismiss({ duration: Infinity, onDismiss, scheduler: fake.scheduler })
    d.start()
    expect(d.state()).toBe('idle')
    fake.advance(10_000)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('pause on a non-running instance is a no-op', () => {
    const fake = fakeScheduler()
    const onDismiss = vi.fn()
    const d = createAutoDismiss({ duration: 500, onDismiss, scheduler: fake.scheduler })
    d.pause() // never started
    expect(d.state()).toBe('idle')
    d.resume() // not paused
    expect(d.state()).toBe('idle')
  })
})
