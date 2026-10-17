import { afterEach, describe, expect, it, vi } from 'vitest'
import * as ids from '../utils'
import * as roots from './owned-notification-state'
import { createOwnedNotificationPilot } from './owned-notifications'

const record = (id: string) => ({ id, title: id, tone: 'info', timeout: 4500 })
afterEach(() => vi.restoreAllMocks())

describe('owned notification transactions and read demand', () => {
  it('keeps detached facade methods bound to their own revision owner during cross-instance reentry', () => {
    const first = createOwnedNotificationPilot(),
      second = createOwnedNotificationPilot()
    const { getState, subscribe } = first.store
    const { post } = first
    expect(getState).toBe(first.getState)
    expect(subscribe).toBe(first.subscribe)
    const listener = vi.fn()
    const off = subscribe(listener)
    const input = new Proxy(
      { title: 'first' },
      {
        ownKeys(target) {
          second.post({ title: 'other owner' })
          return Reflect.ownKeys(target)
        },
      },
    )
    post(input)
    const view = getState()
    expect(view.revision).toBe(1)
    expect(view.notifications.map((n) => n.title)).toEqual(['first'])
    expect(second.getState().revision).toBe(1)
    expect(second.getState().notifications.map((n) => n.title)).toEqual(['other owner'])
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(view)
    off()
    second.dismissAll()
    expect(getState()).toBe(view)
    post({ title: 'unsubscribed' })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(second.getState().notifications).toEqual([])
  })

  it.each(['getPrototypeOf', 'ownKeys', 'getOwnPropertyDescriptor'] as const)(
    'refuses outer work when %s reentrantly commits; no replay or inner rollback',
    (trap) => {
      const center = createOwnedNotificationPilot()
      let fired = false
      const reenter = () => {
        if (!fired) {
          fired = true
          center.post({ title: 'inner' })
        }
      }
      const input = new Proxy(
        { title: 'outer' },
        {
          getPrototypeOf(target) {
            if (trap === 'getPrototypeOf') reenter()
            return Reflect.getPrototypeOf(target)
          },
          ownKeys(target) {
            if (trap === 'ownKeys') reenter()
            return Reflect.ownKeys(target)
          },
          getOwnPropertyDescriptor(target, key) {
            if (trap === 'getOwnPropertyDescriptor') reenter()
            return Reflect.getOwnPropertyDescriptor(target, key)
          },
        },
      )
      expect(() => center.post(input)).toThrow('SUPERSEDED')
      expect(center.getState().revision).toBe(1)
      expect(center.getState().notifications.map((n) => n.title)).toEqual(['inner'])
    },
  )

  it('refuses replacement after an array descriptor trap changes the engine', () => {
    const center = createOwnedNotificationPilot()
    const input = new Proxy([record('replacement')], {
      getOwnPropertyDescriptor(target, key) {
        if (key === '0') center.post({ title: 'inner' })
        return Reflect.getOwnPropertyDescriptor(target, key)
      },
    })
    expect(() => center.importRecords(input)).toThrow('SUPERSEDED')
    expect(center.getState().notifications.map((n) => n.title)).toEqual(['inner'])
  })

  it('preserves a trap exception and its committed inner side effect', () => {
    const center = createOwnedNotificationPilot(),
      sentinel = new Error('reflection failed')
    const input = new Proxy(
      {},
      {
        ownKeys() {
          center.post({ title: 'inner' })
          throw sentinel
        },
      },
    )
    expect(() => center.post(input)).toThrow(sentinel)
    expect(center.getState().revision).toBe(1)
  })

  it.each(['record', 'array', 'view'])(
    'does not commit or notify on %s preparation failure (consumed ID is not rolled back)',
    (kind) => {
      const center = createOwnedNotificationPilot(),
        before = center.getState()
      const listener = vi.fn(),
        sentinel = new Error('preparation failed')
      center.subscribe(listener)
      const generate = vi.spyOn(ids, 'generateId')
      const freeze = Object.freeze
      vi.spyOn(Object, 'freeze').mockImplementation((value) => {
        const matches =
          kind === 'array'
            ? Array.isArray(value)
            : typeof value === 'object' &&
              value !== null &&
              (kind === 'view' ? 'notifications' in value : 'title' in value)
        if (matches) {
          expect(center.getState()).toBe(before)
          throw sentinel
        }
        return freeze(value)
      })
      expect(() => center.post({ title: 'outer' })).toThrow(sentinel)
      expect(generate).toHaveBeenCalledTimes(1)
      expect(listener).not.toHaveBeenCalled()
      expect(center.getState()).toBe(before)
    },
  )

  it('materializes once BEFORE commit when listeners demand a view', () => {
    const center = createOwnedNotificationPilot(),
      before = center.getState()
    const freeze = Object.freeze,
      observed: number[] = []
    const spy = vi.spyOn(Object, 'freeze').mockImplementation((value) => {
      if (Array.isArray(value)) observed.push(center.getState().revision)
      return freeze(value)
    })
    const views: ReturnType<typeof center.getState>[] = []
    const listener = (view: ReturnType<typeof center.getState>) => {
      expect(center.getState()).toBe(view)
      expect(Object.isFrozen(view.notifications)).toBe(true)
      views.push(view)
    }
    const off1 = center.subscribe(listener),
      off2 = center.subscribe(listener)
    center.post({ title: 'one' })
    expect(observed).toEqual([before.revision])
    expect(views).toHaveLength(1)
    expect(spy.mock.calls.filter(([value]) => Array.isArray(value))).toHaveLength(1)
    off1()
    off2()
    center.post({ title: 'unobserved' })
    expect(views).toHaveLength(1)
    expect(observed).toHaveLength(1)
  })

  it('refuses outer materialization when a preparation hook commits reentrantly', () => {
    const center = createOwnedNotificationPilot()
    center.getState()
    center.subscribe(() => {})
    const freeze = Object.freeze
    let fired = false
    vi.spyOn(Object, 'freeze').mockImplementation((value) => {
      if (Array.isArray(value) && !fired) {
        fired = true
        center.post({ title: 'inner' })
      }
      return freeze(value)
    })
    expect(() => center.post({ title: 'outer' })).toThrow('SUPERSEDED')
    expect(center.getState().revision).toBe(1)
    expect(center.getState().notifications.map((n) => n.title)).toEqual(['inner'])
  })

  it('preserves the logical revision after a failed lazy read', () => {
    const center = createOwnedNotificationPilot()
    center.post({ title: 'committed but unread' })
    const freeze = Object.freeze
    const spy = vi.spyOn(Object, 'freeze').mockImplementation((value) => {
      if (Array.isArray(value)) throw new Error('read allocation failure')
      return freeze(value)
    })
    expect(() => center.getState()).toThrow('read allocation failure')
    spy.mockRestore()
    const view = center.getState()
    expect(view.revision).toBe(1)
    expect(view.notifications[0]!.title).toBe('committed but unread')
    expect(center.getState()).toBe(view)
  })

  it('does not let an interrupted lazy read install a stale view', () => {
    const center = createOwnedNotificationPilot(),
      freeze = Object.freeze
    let fired = false
    vi.spyOn(Object, 'freeze').mockImplementation((value) => {
      if (Array.isArray(value) && !fired) {
        fired = true
        center.post({ title: 'inner' })
      }
      return freeze(value)
    })
    expect(() => center.getState()).toThrow('SUPERSEDED')
    expect(center.getState().revision).toBe(1)
  })

  it('checks generated-ID collision once and rejects duplicate imported IDs atomically', () => {
    const center = createOwnedNotificationPilot()
    center.importRecords([record('collision')])
    const before = center.getState(),
      generate = vi.spyOn(ids, 'generateId').mockReturnValue('collision')
    expect(() => center.post({ title: 'new' })).toThrow('DUPLICATE_ID')
    expect(generate).toHaveBeenCalledTimes(1)
    expect(() => center.importRecords([record('same'), record('same')])).toThrow('DUPLICATE_ID')
    expect(center.getState()).toBe(before)
  })

  it('rechecks ownership after ID generation and counts generated ID text', () => {
    const center = createOwnedNotificationPilot()
    const generate = vi.spyOn(ids, 'generateId').mockImplementationOnce(() => {
      center.post({ title: 'inner' })
      return 'outer'
    })
    expect(() => center.post({ title: 'outer' })).toThrow('SUPERSEDED')
    expect(generate).toHaveBeenCalledTimes(2)
    const before = center.getState()
    generate.mockReturnValue('x'.repeat(65_537))
    expect(() => center.post({ title: 'oversized id' })).toThrow('TEXT_LIMIT')
    expect(center.getState()).toBe(before)
  })

  it('refuses revision exhaustion without wrapping or mutating the live state', () => {
    expect(roots.nextOwnedRevision(Number.MAX_SAFE_INTEGER - 1)).toBe(Number.MAX_SAFE_INTEGER)
    for (const value of [Number.MAX_SAFE_INTEGER, Infinity, NaN, -1, 0.5]) {
      expect(() => roots.nextOwnedRevision(value)).toThrow('REVISION_EXHAUSTED')
    }
    const center = createOwnedNotificationPilot()
    // Synthetic boundary injection, NOT 2^53 real operations or a public override.
    vi.spyOn(roots, 'nextOwnedRevision').mockReturnValueOnce(Number.MAX_SAFE_INTEGER)
    center.post({ title: 'last revision' })
    const before = center.getState()
    expect(() => center.post({ title: 'overflow' })).toThrow('REVISION_EXHAUSTED')
    expect(() => center.importRecords([])).toThrow('REVISION_EXHAUSTED')
    expect(() => center.dismissAll()).toThrow('REVISION_EXHAUSTED')
    center.dismiss('missing')
    expect(center.getState()).toBe(before)
  })

  it('never traverses a previous public array on mutation or export', () => {
    const center = createOwnedNotificationPilot()
    const first = center.post({ title: 'first' }),
      old = center.getState()
    const iterator = Array.prototype[Symbol.iterator]
    // A Vitest spy itself destructures arrays before calling its implementation;
    // spying on the global iterator recursively invokes the spy infrastructure.
    const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, Symbol.iterator)!
    Object.defineProperty(Array.prototype, Symbol.iterator, {
      ...descriptor,
      value: function <T>(this: T[]) {
        if (this === old.notifications) throw Error('old public array traversed')
        return iterator.call(this)
      },
    })
    try {
      center.post({ title: 'second' })
      center.dismiss(first)
      expect(center.exportRecords().map((n) => n.title)).toEqual(['second'])
      expect(old.notifications).toHaveLength(1)
    } finally {
      Object.defineProperty(Array.prototype, Symbol.iterator, descriptor)
    }
  })

  it('refuses stale detached export after reentry and retains no export object', () => {
    const center = createOwnedNotificationPilot()
    center.post({ title: 'first' })
    const define = Object.defineProperty
    let fired = false
    const spy = vi.spyOn(Object, 'defineProperty').mockImplementation((object, key, descriptor) => {
      if (Array.isArray(object) && !fired) {
        fired = true
        center.post({ title: 'inner' })
      }
      return define(object, key, descriptor)
    })
    expect(() => center.exportRecords()).toThrow('SUPERSEDED')
    spy.mockRestore()
    expect(center.getState().revision).toBe(2)
    const exported = center.exportRecords()
    exported.length = 0
    expect(center.exportRecords()).toHaveLength(2)
  })
})
