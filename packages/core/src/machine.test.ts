import { describe, expect, it, vi } from 'vitest'
import { createMachine, type Scheduler } from './machine'

/**
 * A deterministic, manually-advanced fake scheduler. Tests step time explicitly
 * via `advance(ms)` so `after` transitions fire reproducibly — no real-time
 * waits, no jsdom flake (the flaky-Solid-tooltip cautionary tale).
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
  }
  const advance = (ms: number): void => {
    const target = now + ms
    // Fire due timers in chronological order, accounting for timers scheduled
    // by firing callbacks (chained `after`s).
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

describe('createMachine (back-compat flat behavior)', () => {
  type State = 'closed' | 'open'
  type Ctx = { reason?: string }
  type Event = { type: 'OPEN' } | { type: 'CLOSE'; reason?: string } | { type: 'TOGGLE' }

  const make = () =>
    createMachine<State, Ctx, Event>({
      initial: 'closed',
      context: {},
      states: {
        closed: { on: { OPEN: { target: 'open' }, TOGGLE: { target: 'open' } } },
        open: {
          on: {
            CLOSE: { target: 'closed', actions: (_c, e) => ({ reason: e.reason }) },
            TOGGLE: { target: 'closed' },
          },
        },
      },
    })

  it('starts in the initial state', () => {
    expect(make().store.getState().value).toBe('closed')
  })

  it('event transitions move state', () => {
    const m = make()
    m.send({ type: 'OPEN' })
    expect(m.store.getState().value).toBe('open')
  })

  it('runs transition actions to update context', () => {
    const m = make()
    m.send({ type: 'OPEN' })
    m.send({ type: 'CLOSE', reason: 'esc' })
    expect(m.store.getState()).toEqual({ value: 'closed', context: { reason: 'esc' } })
  })

  it('respects guards', () => {
    const m = createMachine<State, Ctx, Event>({
      initial: 'closed',
      context: {},
      states: {
        closed: { on: { OPEN: { target: 'open', guard: () => false } } },
        open: {},
      },
    })
    m.send({ type: 'OPEN' })
    expect(m.store.getState().value).toBe('closed')
  })

  it('ignores unhandled events with no spurious notification', () => {
    const m = make()
    let count = 0
    m.store.subscribe(() => count++)
    m.send({ type: 'CLOSE' }) // not handled in `closed`
    expect(count).toBe(0)
    expect(m.store.getState().value).toBe('closed')
  })

  it('emits a single notification per transition', () => {
    const m = make()
    let count = 0
    m.store.subscribe(() => count++)
    m.send({ type: 'OPEN' })
    expect(count).toBe(1)
  })
})

describe('createMachine — after (delayed transitions)', () => {
  type State = 'idle' | 'pending' | 'done'
  type Event = { type: 'START' } | { type: 'CANCEL' }

  const make = (scheduler: Scheduler, delay = 100) =>
    createMachine<State, Record<string, never>, Event>({
      initial: 'idle',
      context: {},
      scheduler,
      states: {
        idle: { on: { START: { target: 'pending' } } },
        pending: {
          after: { [delay]: { target: 'done' } },
          on: { CANCEL: { target: 'idle' } },
        },
        done: {},
      },
    })

  it('does not fire before the timer advances', () => {
    const fake = fakeScheduler()
    const m = make(fake.scheduler)
    m.send({ type: 'START' })
    expect(m.store.getState().value).toBe('pending')
    fake.advance(99)
    expect(m.store.getState().value).toBe('pending')
  })

  it('fires the transition only after the delay elapses', () => {
    const fake = fakeScheduler()
    const m = make(fake.scheduler)
    m.send({ type: 'START' })
    fake.advance(100)
    expect(m.store.getState().value).toBe('done')
  })

  it('auto-cancels the pending timer when the state is left', () => {
    const fake = fakeScheduler()
    const m = make(fake.scheduler)
    m.send({ type: 'START' })
    expect(fake.pending).toBe(1)
    m.send({ type: 'CANCEL' }) // leaves `pending` -> cancels the after timer
    expect(fake.pending).toBe(0)
    fake.advance(1000)
    expect(m.store.getState().value).toBe('idle') // transition did NOT fire
  })

  it('honors a delayed transition guard', () => {
    const fake = fakeScheduler()
    const m = createMachine<State, { ok: boolean }, Event>({
      initial: 'idle',
      context: { ok: false },
      scheduler: fake.scheduler,
      states: {
        idle: { on: { START: { target: 'pending' } } },
        pending: { after: { 50: { target: 'done', guard: (c) => c.ok } } },
        done: {},
      },
    })
    m.send({ type: 'START' })
    fake.advance(50)
    expect(m.store.getState().value).toBe('pending') // guard blocked it
  })

  it('stop() cancels pending timers (no fire into a disposed machine)', () => {
    const fake = fakeScheduler()
    const m = make(fake.scheduler)
    m.send({ type: 'START' })
    m.stop()
    expect(fake.pending).toBe(0)
    fake.advance(1000)
    expect(m.store.getState().value).toBe('pending')
  })

  it('works with vi.useFakeTimers via the default scheduler', () => {
    vi.useFakeTimers()
    try {
      const m = make(
        {
          setTimeout: (fn, ms) => setTimeout(fn, ms),
          clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
        },
        20,
      )
      m.send({ type: 'START' })
      vi.advanceTimersByTime(19)
      expect(m.store.getState().value).toBe('pending')
      vi.advanceTimersByTime(1)
      expect(m.store.getState().value).toBe('done')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('createMachine — entry/exit actions', () => {
  type State = 'a' | 'b'
  type Event = { type: 'GO' }

  it('runs initial entry, then exit-then-entry in order on transition', () => {
    const log: string[] = []
    const m = createMachine<State, Record<string, never>, Event>({
      initial: 'a',
      context: {},
      states: {
        a: {
          entry: [() => log.push('enter:a')],
          exit: [() => log.push('exit:a')],
          on: { GO: { target: 'b' } },
        },
        b: {
          entry: [() => log.push('enter:b')],
          exit: [() => log.push('exit:b')],
        },
      },
    })
    expect(log).toEqual(['enter:a'])
    m.send({ type: 'GO' })
    expect(log).toEqual(['enter:a', 'exit:a', 'enter:b'])
  })

  it('passes context and event to actions', () => {
    const seen: Array<[unknown, unknown]> = []
    const m = createMachine<State, { n: number }, Event>({
      initial: 'a',
      context: { n: 1 },
      states: {
        a: { on: { GO: { target: 'b' } } },
        b: { entry: [(ctx, ev) => seen.push([ctx.n, ev.type])] },
      },
    })
    m.send({ type: 'GO' })
    expect(seen).toEqual([[1, 'GO']])
  })

  it('a target-less transition runs actions WITHOUT exit/entry (internal)', () => {
    const log: string[] = []
    const m = createMachine<State, { n: number }, Event>({
      initial: 'a',
      context: { n: 0 },
      states: {
        a: {
          entry: [() => log.push('enter:a')],
          exit: [() => log.push('exit:a')],
          on: { GO: { actions: (c) => ({ n: c.n + 1 }) } },
        },
        b: {},
      },
    })
    log.length = 0
    m.send({ type: 'GO' })
    expect(m.store.getState()).toEqual({ value: 'a', context: { n: 1 } })
    expect(log).toEqual([]) // no exit/entry for an internal (target-less) transition
  })
})

describe('createMachine — one level of nested states', () => {
  // Parent `running` delegates to child `fast`; child handles SLOW, parent BUBBLE.
  type State = 'idle' | 'running' | 'fast' | 'slow' | 'stopped'
  type Event = { type: 'START' } | { type: 'SLOW' } | { type: 'HALT' }

  const make = () =>
    createMachine<State, Record<string, never>, Event>({
      initial: 'idle',
      context: {},
      states: {
        idle: { on: { START: { target: 'running' } } },
        running: {
          initial: 'fast',
          // Parent handles HALT for any child (bubbling).
          on: { HALT: { target: 'stopped' } },
          states: {
            fast: { on: { SLOW: { target: 'slow' } } },
            slow: {},
          },
        },
        fast: {},
        slow: {},
        stopped: {},
      },
    })

  it('entering a compound state activates its initial child', () => {
    const m = make()
    m.send({ type: 'START' })
    expect(m.store.getState().value).toBe('running')
    // The child handles SLOW even though `running.on` does not.
    m.send({ type: 'SLOW' })
    expect(m.store.getState().value).toBe('slow')
  })

  it('an event unhandled by the child bubbles to the parent', () => {
    const m = make()
    m.send({ type: 'START' })
    m.send({ type: 'HALT' }) // child `fast` has no HALT -> bubbles to `running`
    expect(m.store.getState().value).toBe('stopped')
  })

  it('runs parent-then-child entry on entering a compound state', () => {
    const log: string[] = []
    const m = createMachine<State, Record<string, never>, Event>({
      initial: 'idle',
      context: {},
      states: {
        idle: { on: { START: { target: 'running' } } },
        running: {
          initial: 'fast',
          entry: [() => log.push('enter:running')],
          states: { fast: { entry: [() => log.push('enter:fast')] }, slow: {} },
        },
        fast: {},
        slow: {},
        stopped: {},
      },
    })
    m.send({ type: 'START' })
    expect(log).toEqual(['enter:running', 'enter:fast'])
  })

  it('child after timers are scheduled and cancelled with the parent', () => {
    const fake = fakeScheduler()
    const m = createMachine<State, Record<string, never>, Event>({
      initial: 'idle',
      context: {},
      scheduler: fake.scheduler,
      states: {
        idle: { on: { START: { target: 'running' } } },
        running: {
          initial: 'fast',
          on: { HALT: { target: 'stopped' } },
          states: { fast: { after: { 30: { target: 'slow' } } }, slow: {} },
        },
        fast: {},
        slow: {},
        stopped: {},
      },
    })
    m.send({ type: 'START' })
    expect(fake.pending).toBe(1)
    m.send({ type: 'HALT' }) // leaves the compound state -> cancels child timer
    expect(fake.pending).toBe(0)
    fake.advance(100)
    expect(m.store.getState().value).toBe('stopped')
  })
})
