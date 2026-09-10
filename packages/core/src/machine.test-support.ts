import type { Scheduler } from './machine'

/** Deterministic scheduler for delayed-transition tests. */
export function fakeScheduler() {
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
    let safety = 0
    for (;;) {
      let next: { id: number; at: number; fn: () => void } | undefined
      for (const [id, timer] of timers) {
        if (timer.at <= target && (!next || timer.at < next.at)) next = { id, ...timer }
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
