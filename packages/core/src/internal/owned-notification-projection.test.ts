import { describe, expect, it, vi } from 'vitest'
import { createOwnedNotificationPilot } from './owned-notifications'
import type { OwnedNotificationView } from './owned-notification-state'
import type { ReadonlyStore } from '../store'
import { createOwnedNotificationProjection as project } from './owned-notification-projection'

const names = (view: OwnedNotificationView) => view.notifications.map((n) => n.title).join('|')
const post = (c: ReturnType<typeof createOwnedNotificationPilot>, title: string) =>
  c.post({ title, timeout: 0 })
function measured() {
  const core = createOwnedNotificationPilot()
  const counts = { reads: 0, subscriptions: 0, unsubscriptions: 0 }
  const source: ReadonlyStore<OwnedNotificationView> = {
    getState() {
      expect(this).toBe(source)
      counts.reads++
      return core.getState()
    },
    subscribe(fn) {
      expect(this).toBe(source)
      counts.subscriptions++
      const off = core.subscribe(fn)
      return () => {
        counts.unsubscriptions++
        off()
      }
    },
  }
  return { core, counts, source, ui: project(source) }
}
function thrown(action: () => void, expected: unknown) {
  let caught: unknown
  try {
    action()
  } catch (error) {
    caught = error
  }
  expect(caught).toBe(expected)
}

describe('private current-snapshot notification projection', () => {
  it('P01 freezes only the minimal read/subscribe facade', () => {
    const c = createOwnedNotificationPilot()
    const ui = project(c.store)
    expect(Object.isFrozen(ui)).toBe(true)
    expect(Reflect.ownKeys(ui).sort()).toEqual(['getState', 'subscribe'])
    expect('setState' in ui || 'batch' in ui || 'subscribeWith' in ui).toBe(false)
  })
  it('P02 creation is lazy and introduces no subscription or read', () => {
    const x = measured()
    expect(x.counts).toEqual({ reads: 0, subscriptions: 0, unsubscriptions: 0 })
  })
  it('P03 detached reads preserve receiver and exact owned view identity', () => {
    const x = measured()
    const { getState } = x.ui
    const before = getState()
    expect(before).toBe(x.core.getState())
    post(x.core, 'new')
    expect(getState()).toBe(x.core.getState())
    expect(names(before)).toBe('')
    expect(x.counts.reads).toBe(2)
  })
  it('P04 detached subscribe registers once without priming callbacks or reads', () => {
    const x = measured()
    const { subscribe } = x.ui
    const fn = vi.fn()
    const off = subscribe(fn)
    expect(fn).not.toHaveBeenCalled()
    expect(x.counts.reads).toBe(0)
    expect(x.counts.subscriptions).toBe(1)
    off()
    expect(x.counts.unsubscriptions).toBe(1)
  })
  it('P05 samples once for each delivered source event, with no snapshot clone', () => {
    const x = measured()
    const fn = vi.fn()
    const off = x.ui.subscribe(fn)
    post(x.core, 'one')
    post(x.core, 'two')
    expect(fn).toHaveBeenCalledTimes(2)
    expect(x.counts.reads).toBe(2)
    expect(fn.mock.calls[1][0]).toBe(x.core.getState())
    off()
  })
  it('P06 earlier reentry preserves raw captured events but projects current twice', () => {
    const c = createOwnedNotificationPilot()
    let nested = false
    c.subscribe(() => {
      if (!nested) {
        nested = true
        post(c, 'inner')
      }
    })
    const ui = project(c.store)
    const projected: OwnedNotificationView[] = []
    const raw: OwnedNotificationView[] = []
    ui.subscribe((v) => projected.push(v))
    c.subscribe((v) => raw.push(v))
    post(c, 'outer')
    expect(raw.map(names)).toEqual(['inner|outer', 'outer'])
    expect(projected.map(names)).toEqual(['inner|outer', 'inner|outer'])
    expect(projected[0]).toBe(c.getState())
    expect(projected[1]).toBe(c.getState())
    expect(raw[1].revision).toBe(1)
    expect(raw[0].revision).toBe(2)
  })
  it('P07 projected listener reentry does not stale a later projected listener', () => {
    const c = createOwnedNotificationPilot()
    const ui = project(c.store)
    let nested = false
    const first: string[] = []
    const second: string[] = []
    const raw: string[] = []
    ui.subscribe((v) => {
      first.push(names(v))
      if (!nested) {
        nested = true
        post(c, 'inner')
      }
    })
    ui.subscribe((v) => second.push(names(v)))
    c.subscribe((v) => raw.push(names(v)))
    post(c, 'outer')
    expect(first).toEqual(['outer', 'inner|outer'])
    expect(second).toEqual(['inner|outer', 'inner|outer'])
    expect(raw).toEqual(['inner|outer', 'outer'])
  })
  it('P08 repeated callback uses source Set identity and either off removes it', () => {
    const x = measured()
    const fn = vi.fn()
    const off1 = x.ui.subscribe(fn)
    const off2 = x.ui.subscribe(fn)
    post(x.core, 'one')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(x.counts.reads).toBe(1)
    off1()
    post(x.core, 'two')
    off2()
    expect(fn).toHaveBeenCalledTimes(1)
  })
  it('P09 remove and readd same callback mid-emit preserves source membership semantics', () => {
    const c = createOwnedNotificationPilot()
    const ui = project(c.store)
    const fn = vi.fn()
    let off = () => {}
    let changed = false
    c.subscribe(() => {
      if (!changed) {
        changed = true
        off()
        ui.subscribe(fn)
      }
    })
    off = ui.subscribe(fn)
    post(c, 'one')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn.mock.calls[0][0]).toBe(c.getState())
  })
  it('P10 old unsubscribe also removes a re-registration of the same callback', () => {
    const c = createOwnedNotificationPilot()
    const ui = project(c.store)
    const fn = vi.fn()
    const oldOff = ui.subscribe(fn)
    oldOff()
    ui.subscribe(fn)
    oldOff()
    post(c, 'one')
    expect(fn).not.toHaveBeenCalled()
  })
  it('P11 removed-before-turn callbacks are skipped without extra source reads', () => {
    const x = measured()
    let off = () => {}
    const fn = vi.fn()
    x.core.subscribe(() => off())
    off = x.ui.subscribe(fn)
    post(x.core, 'one')
    expect(fn).not.toHaveBeenCalled()
    expect(x.counts.reads).toBe(0)
  })
  it('P12 newly added callback is not injected into an already captured emission', () => {
    const c = createOwnedNotificationPilot()
    const ui = project(c.store)
    const fn = vi.fn()
    let added = false
    c.subscribe(() => {
      if (!added) {
        added = true
        ui.subscribe(fn)
      }
    })
    post(c, 'one')
    expect(fn).not.toHaveBeenCalled()
    post(c, 'two')
    expect(fn).toHaveBeenCalledTimes(1)
  })
  it('P13 earlier raw throw remains fail-fast, with commit retained and no UI read', () => {
    const x = measured()
    const error = { kind: 'raw failure' }
    const fn = vi.fn()
    x.core.subscribe(() => {
      throw error
    })
    x.ui.subscribe(fn)
    thrown(() => post(x.core, 'committed'), error)
    expect(names(x.core.getState())).toBe('committed')
    expect(fn).not.toHaveBeenCalled()
    expect(x.counts.reads).toBe(0)
  })
  it('P14 projected listener error propagates unchanged after commit without replay', () => {
    const x = measured()
    const error = { kind: 'projection listener failure' }
    const later = vi.fn()
    x.ui.subscribe(() => {
      throw error
    })
    x.core.subscribe(later)
    thrown(() => post(x.core, 'committed'), error)
    expect(names(x.core.getState())).toBe('committed')
    expect(later).not.toHaveBeenCalled()
    expect(x.counts.reads).toBe(1)
  })
  it('P15 extra read failure propagates postcommit and does not call UI or later listeners', () => {
    const c = createOwnedNotificationPilot()
    const error = { kind: 'read failure' }
    let reads = 0
    const ui = project({
      getState() {
        reads++
        throw error
      },
      subscribe: c.subscribe,
    })
    const fn = vi.fn()
    const later = vi.fn()
    ui.subscribe(fn)
    c.subscribe(later)
    thrown(() => post(c, 'committed'), error)
    expect(names(c.getState())).toBe('committed')
    expect(reads).toBe(1)
    expect(fn).not.toHaveBeenCalled()
    expect(later).not.toHaveBeenCalled()
  })
  it('P16 reentrant failing read is neither rolled back nor automatically replayed', () => {
    const c = createOwnedNotificationPilot()
    const error = { kind: 'reentrant read' }
    let entered = false
    let reads = 0
    const ui = project({
      subscribe: c.subscribe,
      getState() {
        reads++
        if (!entered) {
          entered = true
          post(c, 'inner')
          throw error
        }
        return c.getState()
      },
    })
    const seen: string[] = []
    ui.subscribe((v) => seen.push(names(v)))
    thrown(() => post(c, 'outer'), error)
    expect(names(c.getState())).toBe('inner|outer')
    expect(seen).toEqual(['inner|outer'])
    expect(reads).toBe(2)
  })
  it('P17 direct read errors propagate unchanged without retry', () => {
    const c = createOwnedNotificationPilot()
    const error = Symbol('read')
    let calls = 0
    const ui = project({
      subscribe: c.subscribe,
      getState() {
        calls++
        throw error
      },
    })
    thrown(() => ui.getState(), error)
    expect(calls).toBe(1)
  })
  it('P18 independent owned centers do not share subscriptions or snapshots', () => {
    const a = createOwnedNotificationPilot()
    const b = createOwnedNotificationPilot()
    const first = project(a.store)
    const second = project(b.store)
    const fn = vi.fn()
    first.subscribe(fn)
    second.subscribe(fn)
    post(a, 'A')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(names(second.getState())).toBe('')
    post(b, 'B')
    expect(fn).toHaveBeenCalledTimes(2)
    expect(names(first.getState())).toBe('A')
  })
  it('P19 separate projections on one owner have separate callback identities', () => {
    const c = createOwnedNotificationPilot()
    const a = project(c.store)
    const b = project(c.store)
    const fn = vi.fn()
    const offA = a.subscribe(fn)
    const offB = b.subscribe(fn)
    post(c, 'one')
    expect(fn).toHaveBeenCalledTimes(2)
    offA()
    post(c, 'two')
    expect(fn).toHaveBeenCalledTimes(3)
    offB()
    post(c, 'three')
    expect(fn).toHaveBeenCalledTimes(3)
  })
  it('P20 import replacement is one event, preserves IDs, and keeps old view immutable', () => {
    const c = createOwnedNotificationPilot()
    post(c, 'one')
    const old = c.getState()
    const records = c.exportRecords()
    const fn = vi.fn()
    project(c.store).subscribe(fn)
    c.importRecords(records)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn.mock.calls[0][0]).toBe(c.getState())
    expect(c.getState().notifications[0].id).toBe(old.notifications[0].id)
    expect(c.getState()).not.toBe(old)
    expect(names(old)).toBe('one')
  })
  it('P21 no-op commands and disposed callbacks do not cause projection reads', () => {
    const x = measured()
    const fn = vi.fn()
    const off = x.ui.subscribe(fn)
    x.core.dismiss('missing')
    x.core.dismissAll()
    expect(x.counts.reads).toBe(0)
    off()
    off()
    post(x.core, 'unobserved')
    expect(fn).not.toHaveBeenCalled()
    expect(x.counts.reads).toBe(0)
  })
  it('P22 invalid callbacks are refused before source registration', () => {
    const x = measured()
    for (const invalid of [undefined, null, 0, '', {}])
      expect(() => Reflect.apply(x.ui.subscribe, undefined, [invalid])).toThrow(TypeError)
    expect(x.counts.subscriptions).toBe(0)
  })
  it('P23 callbacks are plain calls; caller source is not frozen or mutated', () => {
    const x = measured()
    const descriptors = Object.getOwnPropertyDescriptors(x.source)
    const received: unknown[] = []
    x.ui.subscribe(function (this: unknown, view) {
      received.push(this, view)
    })
    post(x.core, 'one')
    expect(received).toEqual([undefined, x.core.getState()])
    expect(Object.getOwnPropertyDescriptors(x.source)).toEqual(descriptors)
    expect(Object.isFrozen(x.source)).toBe(false)
  })
  it('P24 subscription result and registration exceptions are forwarded without retry', () => {
    const c = createOwnedNotificationPilot()
    const off = vi.fn()
    const error = Symbol('subscribe')
    let fail = false
    let calls = 0
    const source: ReadonlyStore<OwnedNotificationView> = {
      getState: c.getState,
      subscribe() {
        calls++
        if (fail) throw error
        return off
      },
    }
    const ui = project(source)
    expect(ui.subscribe(() => {})).toBe(off)
    fail = true
    thrown(() => ui.subscribe(() => {}), error)
    expect(calls).toBe(2)
  })
})
