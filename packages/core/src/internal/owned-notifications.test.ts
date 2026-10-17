import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOwnedNotificationPilot } from './owned-notifications'

const record = (id: string) => ({ id, title: id, tone: 'info', timeout: 4500 })
afterEach(() => vi.restoreAllMocks())

describe('private owned notification contract (not a public export)', () => {
  it('exposes an actual readonly facade and stable immutable revision views', () => {
    const center = createOwnedNotificationPilot()
    expect(Object.keys(center.store).sort()).toEqual(['getState', 'subscribe'])
    expect('setState' in center.store).toBe(false)
    expect(Object.isFrozen(center.store)).toBe(true)
    const view = center.getState()
    expect(view.revision).toBe(0)
    expect(center.store.getState()).toBe(view)
    expect(Object.isFrozen(view)).toBe(true)
    expect(Object.isFrozen(view.notifications)).toBe(true)
    expect(Object.getPrototypeOf(view.notifications)).toBe(Array.prototype)
  })

  it('posts newest first, normalizes admitted scalars and leaves old views intact', () => {
    const center = createOwnedNotificationPilot()
    const first = center.post({ title: 'first' })
    const old = center.getState()
    const second = center.post({ title: 'second', tone: null, timeout: -1 })
    const view = center.getState()
    expect(view.revision).toBe(2)
    expect(view.notifications.map((n) => n.id)).toEqual([second, first])
    expect(view.notifications[0]).toMatchObject({ title: 'second', tone: 'info', timeout: 4500 })
    expect(old.notifications.map((n) => n.title)).toEqual(['first'])
    expect(old.revision).toBe(1)
    expect(Object.isFrozen(view.notifications[0])).toBe(true)
    expect(center.getState()).toBe(view)
  })

  it('does not commit no-op dismiss/clear; replacement is a distinct transaction', () => {
    const center = createOwnedNotificationPilot()
    const empty = center.getState()
    center.dismiss('missing')
    center.dismissAll()
    expect(center.getState()).toBe(empty)
    center.importRecords([])
    expect(center.getState().revision).toBe(1)
    const id = center.post({ title: 'remove' })
    center.dismiss(id)
    expect(center.getState().revision).toBe(3)
    expect(center.getState().notifications).toEqual([])
  })

  it('copies import, returns fresh mutable exports, and re-admits public records', () => {
    const center = createOwnedNotificationPilot()
    const input = [record('a'), record('b')]
    center.importRecords(input)
    const view = center.getState()
    input[0]!.title = 'changed'
    input.pop()
    expect(view.notifications.map((n) => n.title)).toEqual(['a', 'b'])
    const first = center.exportRecords()
    const second = center.exportRecords()
    expect(first).not.toBe(second)
    expect(first[0]).not.toBe(second[0])
    first[0]!.title = 'export edit'
    first.pop()
    expect(center.getState()).toBe(view)
    center.importRecords(view.notifications)
    expect(center.getState().revision).toBe(2)
    expect(center.getState().notifications[0]).not.toBe(view.notifications[0])
    expect(center.exportRecords()).toEqual(second)
  })

  it('rejects aliased import records atomically instead of retaining a graph', () => {
    const center = createOwnedNotificationPilot()
    center.post({ title: 'keep' })
    const before = center.getState()
    const shared = record('duplicate')
    expect(() => center.importRecords([shared, shared])).toThrow()
    expect(center.getState()).toBe(before)
  })

  it('admits descriptors without a general input Get', () => {
    const center = createOwnedNotificationPilot()
    const trace: string[] = []
    const input = new Proxy(
      { title: 'captured', body: 'text' },
      {
        get() {
          throw new Error('general Get must not execute')
        },
        getPrototypeOf(target) {
          trace.push('prototype')
          return Reflect.getPrototypeOf(target)
        },
        ownKeys(target) {
          trace.push('keys')
          return Reflect.ownKeys(target)
        },
        getOwnPropertyDescriptor(target, key) {
          trace.push(String(key))
          return Reflect.getOwnPropertyDescriptor(target, key)
        },
      },
    )
    center.post(input)
    expect(trace).toEqual(['prototype', 'keys', 'title', 'body'])
    expect(center.getState().notifications[0]!.title).toBe('captured')
  })

  it('rejects accessors without invoking them and never freezes caller data', () => {
    const center = createOwnedNotificationPilot()
    const getter = vi.fn(() => 'title')
    expect(() =>
      center.post(Object.defineProperty({}, 'title', { enumerable: true, get: getter })),
    ).toThrow()
    expect(getter).not.toHaveBeenCalled()
    const input = { title: 'mutable' }
    center.post(input)
    expect(Object.isFrozen(input)).toBe(false)
    input.title = 'later'
    expect(center.getState().notifications[0]!.title).toBe('mutable')
  })

  it('rejects unknown/nested fields rather than silently dropping them', () => {
    const center = createOwnedNotificationPilot()
    const old = center.getState()
    expect(() => center.post({ title: 'a', extra: 'not admitted' })).toThrow()
    expect(() => center.post({ title: { nested: true } })).toThrow()
    expect(center.getState()).toBe(old)
  })

  it('does not materialize flat public views on unobserved mutations', () => {
    const center = createOwnedNotificationPilot()
    center.getState()
    const freeze = vi.spyOn(Object, 'freeze')
    for (let i = 0; i < 10; i++) center.post({ title: String(i) })
    expect(freeze.mock.calls.filter(([value]) => Array.isArray(value))).toHaveLength(0)
    const view = center.getState()
    expect(freeze.mock.calls.filter(([value]) => Array.isArray(value))).toHaveLength(1)
    expect(center.getState()).toBe(view)
    expect(freeze.mock.calls.filter(([value]) => Array.isArray(value))).toHaveLength(1)
  })

  it('preserves emit-start membership, duplicate identity and synchronous reentry', () => {
    const center = createOwnedNotificationPilot()
    const seen: string[] = []
    const later = (v: ReturnType<typeof center.getState>) => seen.push(`later:${v.revision}`)
    const second = (v: ReturnType<typeof center.getState>) => seen.push(`second:${v.revision}`)
    center.subscribe((v) => {
      seen.push(`first:${v.revision}`)
      if (v.revision === 1) {
        off()
        center.subscribe(later)
        center.post({ title: 'inner' })
        expect(center.getState().revision).toBe(2)
      }
    })
    const off = center.subscribe(second)
    center.subscribe(second)
    center.post({ title: 'outer' })
    expect(seen).toEqual(['first:1', 'first:2', 'later:2'])
  })

  it('keeps the outer captured view for remaining listeners after reentry', () => {
    const center = createOwnedNotificationPilot()
    const seen: number[] = []
    center.subscribe((v) => {
      if (v.revision === 1) center.post({ title: 'inner' })
    })
    center.subscribe((v) => seen.push(v.revision))
    center.post({ title: 'outer' })
    expect(seen).toEqual([2, 1])
    expect(center.getState().revision).toBe(2)
  })

  it('propagates listener errors AFTER commit and skips remaining listeners', () => {
    const center = createOwnedNotificationPilot()
    const sentinel = new Error('listener failed after commit')
    center.subscribe(() => {
      throw sentinel
    })
    const later = vi.fn()
    center.subscribe(later)
    expect(() => center.post({ title: 'committed' })).toThrow(sentinel)
    expect(center.getState().revision).toBe(1)
    expect(center.getState().notifications[0]!.title).toBe('committed')
    expect(later).not.toHaveBeenCalled()
  })
})
