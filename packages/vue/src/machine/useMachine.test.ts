import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, effectScope, h, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createMachine, type MachineState } from '@iris-ui-kit/core'
import { useMachine } from './useMachine'

/** Empty context type for the AC2 event-only machine (lint: no bare `{}`). */
type Ctx = Record<string, never>

// AC1 fixture: a delayed `after` transition scheduled on initial entry, with an
// entry action on the target state. `entry` is `Action[]` in core (StateNode,
// machine.ts) — the array form is required, a lone function throws.
let entryCalls = 0
const makeDelayedMachine = () =>
  createMachine<'closed' | 'open', { n: number }, { type: 'OPEN' }>({
    initial: 'closed',
    context: { n: 0 },
    states: {
      closed: { after: { 100: { target: 'open' } } },
      open: {
        entry: [
          () => {
            entryCalls++
          },
        ],
      },
    },
  })

type DelayedMachine = ReturnType<typeof makeDelayedMachine>

function Probe(machine: DelayedMachine) {
  return defineComponent({
    setup() {
      const { state } = useMachine(machine)
      return () => h('div', state.value.value)
    },
  })
}

describe('useMachine teardown (vue)', () => {
  beforeEach(() => {
    entryCalls = 0
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('AC1: unmount cancels pending after-timers, so the delayed transition never fires into a disposed consumer', () => {
    const machine = makeDelayedMachine()
    const wrapper = mount(Probe(machine))

    // The machine is live: initial entry scheduled the 100ms `after` timer.
    expect(machine.store.getState().value).toBe('closed')
    expect(vi.getTimerCount()).toBe(1)

    wrapper.unmount()
    // stop() ran cancelPending: the pending timer was CLEARED, not left to fire dead.
    expect(vi.getTimerCount()).toBe(0)

    // Even long past the deadline the delayed transition must not fire.
    vi.advanceTimersByTime(1000)
    expect(machine.store.getState().value).toBe('closed')
    expect(entryCalls).toBe(0)

    // Negative control: an identical machine that stays mounted reaches 'open'
    // and runs its entry action — proves the fixture's timer genuinely fires,
    // so the assertions above cannot pass trivially.
    const live = makeDelayedMachine()
    const liveWrapper = mount(Probe(live))
    vi.advanceTimersByTime(100)
    expect(live.store.getState().value).toBe('open')
    expect(entryCalls).toBe(1)
    liveWrapper.unmount()
  })

  it('AC2: effectScope teardown detaches the subscription, stops by default, honors stopOnUnmount: false, and warns on neither path', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const makeEventMachine = () =>
      createMachine<'closed' | 'open', Ctx, { type: 'OPEN' }>({
        initial: 'closed',
        context: {},
        states: {
          closed: { on: { OPEN: { target: 'open' } } },
          open: {},
        },
      })

    // Opt-out path: subscription detached, machine kept running.
    const shared = makeEventMachine()
    let captured!: Ref<MachineState<'closed' | 'open', Ctx>>
    const scope = effectScope()
    scope.run(() => {
      captured = useMachine(shared, { stopOnUnmount: false }).state
    })
    scope.stop()
    // With the old onBeforeUnmount this would emit the "no active component
    // instance" dev warning; onScopeDispose must not.
    expect(
      warnSpy.mock.calls.some((c) => String(c[0]).includes('no active component instance')),
    ).toBe(false)

    shared.send({ type: 'OPEN' })
    expect(shared.store.getState().value).toBe('open') // machine kept running
    expect(captured.value.value).toBe('closed') // ...but the ref no longer tracks it

    // Default path: scope teardown stops the machine — send becomes a no-op.
    const owned = makeEventMachine()
    const scope2 = effectScope()
    scope2.run(() => {
      useMachine(owned)
    })
    scope2.stop()
    owned.send({ type: 'OPEN' })
    expect(owned.store.getState().value).toBe('closed')

    // Hardening (failSilently=true): calling the hook with NO active scope at
    // all is warning-free — no "no active effect scope" dev warning either.
    useMachine(makeEventMachine())
    expect(warnSpy.mock.calls.some((c) => String(c[0]).includes('no active effect scope'))).toBe(
      false,
    )
  })
})
