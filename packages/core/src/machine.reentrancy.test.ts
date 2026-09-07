import { describe, expect, it } from 'vitest'
import { createMachine } from './machine'
import { fakeScheduler } from './machine.test-support'

describe('createMachine — runtime hardening and reentrancy', () => {
  type State = 'a' | 'b'
  type Event = { type: 'GO' } | { type: 'RESET' }

  it('ignores invalid after delays instead of scheduling them', () => {
    const fake = fakeScheduler()
    const m = createMachine<State, Record<string, never>, Event>({
      initial: 'a',
      context: {},
      scheduler: fake.scheduler,
      states: {
        a: {
          after: {
            [-1]: { target: 'b' },
            [Number.NaN]: { target: 'b' },
            [Number.POSITIVE_INFINITY]: { target: 'b' },
            10: { target: 'b' },
          } as Record<number, { target: State }>,
        },
        b: {},
      },
    })

    expect(fake.pending).toBe(1)
    fake.advance(10)
    expect(m.store.getState().value).toBe('b')
  })

  it('queues sends from entry actions until the current transition completes', () => {
    const fake = fakeScheduler()
    const machine = createMachine<State, Record<string, never>, Event>({
      initial: 'a',
      context: {},
      scheduler: fake.scheduler,
      states: {
        a: { on: { GO: { target: 'b' } } },
        b: {
          after: { 10: { target: 'a' } },
          entry: [() => machine.send({ type: 'RESET' })],
          on: { RESET: { target: 'a' } },
        },
      },
    })

    machine.send({ type: 'GO' })
    expect(machine.store.getState().value).toBe('a')
    expect(fake.pending).toBe(0)
  })
})
