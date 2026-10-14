import { describe, expect, it } from 'vitest'
import { createNotificationCenter, type DesktopNotification } from './notifications'

function withIterator(
  previous: DesktopNotification[],
  values: DesktopNotification[],
  run: () => void,
): void {
  const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, Symbol.iterator)!
  const original = Array.prototype[Symbol.iterator]
  try {
    Object.defineProperty(Array.prototype, Symbol.iterator, {
      ...descriptor,
      value: function (this: DesktopNotification[]) {
        return original.call(this === previous ? values : this)
      },
    })
    run()
  } finally {
    Object.defineProperty(Array.prototype, Symbol.iterator, descriptor)
  }
}

const titles = (center: ReturnType<typeof createNotificationCenter>): string[] =>
  center.list().map((notification) => notification.title)

describe('notification append proof compatibility', () => {
  it('keeps public snapshots frozen and private proof data outside their keys', () => {
    const center = createNotificationCenter()
    center.post({ title: 'first' })
    const first = center.getState()
    center.post({ title: 'second' })
    const second = center.getState()
    expect(Reflect.ownKeys(second)).toEqual(['notifications'])
    expect(Reflect.ownKeys(second.notifications)).toEqual(['0', '1', 'length'])
    expect(Reflect.ownKeys(second.notifications[0]!)).toEqual([
      'id',
      'title',
      'body',
      'icon',
      'appId',
      'tone',
      'timeout',
    ])
    expect(Object.isFrozen(second)).toBe(true)
    expect(Object.isFrozen(second.notifications)).toBe(true)
    expect(Object.isFrozen(second.notifications[0])).toBe(true)
    expect(second.notifications[1] === first.notifications[0]).toBe(true)
    const list = center.list()
    list[0]!.title = 'caller copy'
    expect(titles(center)).toEqual(['second', 'first'])
    expect(first.notifications.map((item) => item.title)).toEqual(['first'])
  })

  it('branches safely from a retained older snapshot and a different center', () => {
    const source = createNotificationCenter()
    source.post({ title: 'root' })
    const root = source.getState()
    source.post({ title: 'left' })
    const target = createNotificationCenter()
    target.store.setState(root)
    target.post({ title: 'right' })
    source.store.setState(root)
    source.post({ title: 'restored' })
    expect(titles(source)).toEqual(['restored', 'root'])
    expect(titles(target)).toEqual(['right', 'root'])
    expect(root.notifications.map((item) => item.title)).toEqual(['root'])
  })

  it('accepts actual reordered output and verifies later appends against that order', () => {
    const center = createNotificationCenter()
    center.post({ title: 'a' })
    center.post({ title: 'b' })
    const previous = center.getState().notifications
    withIterator(previous, [previous[1]!, previous[0]!], () => center.post({ title: 'c' }))
    center.post({ title: 'd' })
    expect(titles(center)).toEqual(['d', 'c', 'a', 'b'])
    expect(previous.map((item) => item.title)).toEqual(['b', 'a'])
  })

  it('detaches a same-length foreign frozen accessor record from a changed iterator', () => {
    const center = createNotificationCenter()
    center.post({ title: 'owned' })
    const previous = center.getState().notifications
    let title = 'foreign'
    let reads = 0
    const foreign = Object.freeze({
      id: 'foreign',
      get title() {
        reads++
        return title
      },
      tone: 'info' as const,
      timeout: 0,
    })
    withIterator(previous, [foreign], () => center.post({ title: 'new' }))
    title = 'mutated'
    center.post({ title: 'later' })
    expect(reads).toBe(1)
    expect(titles(center)).toEqual(['later', 'new', 'foreign'])
    expect(center.getState().notifications[2] === foreign).toBe(false)
  })

  it('preserves deletion fallback and subsequent iterator changes', () => {
    const center = createNotificationCenter()
    const removed = center.post({ title: 'removed' })
    center.post({ title: 'kept' })
    center.dismiss(removed)
    const previous = center.getState().notifications
    withIterator(previous, [], () => center.post({ title: 'replacement' }))
    center.post({ title: 'next' })
    expect(titles(center)).toEqual(['next', 'replacement'])
    expect(previous.map((item) => item.title)).toEqual(['kept'])
  })

  it('still consumes an overridden empty-list iterator after dismissAll', () => {
    const center = createNotificationCenter()
    center.post({ title: 'gone' })
    center.dismissAll()
    const empty = center.getState().notifications
    const foreign: DesktopNotification = { id: 'f', title: 'inserted', tone: 'info', timeout: 0 }
    withIterator(empty, [foreign], () => center.post({ title: 'new' }))
    foreign.title = 'mutated'
    expect(titles(center)).toEqual(['new', 'inserted'])
    expect(empty).toHaveLength(0)
  })

  it('lets actual iterator-next errors abort publication without changing state', () => {
    const center = createNotificationCenter()
    center.post({ title: 'retained' })
    const state = center.getState()
    const iterator = state.notifications[Symbol.iterator]()
    const prototype = Object.getPrototypeOf(iterator)
    const next = Object.getOwnPropertyDescriptor(prototype, 'next')!
    const method = Object.getOwnPropertyDescriptor(Array.prototype, Symbol.iterator)!
    const failure = new Error('owned array iterator next failed')
    let caught: unknown
    try {
      Object.defineProperty(Array.prototype, Symbol.iterator, {
        ...method,
        value: function (this: DesktopNotification[]) {
          return this === state.notifications ? iterator : method.value.call(this)
        },
      })
      Object.defineProperty(prototype, 'next', {
        ...next,
        value: function (this: object) {
          if (this === iterator) throw failure
          return next.value.call(this)
        },
      })
      try {
        center.post({ title: 'rejected' })
      } catch (error) {
        caught = error
      }
    } finally {
      Object.defineProperty(prototype, 'next', next)
      Object.defineProperty(Array.prototype, Symbol.iterator, method)
    }
    expect(caught === failure).toBe(true)
    expect(center.getState() === state).toBe(true)
    expect(titles(center)).toEqual(['retained'])
  })

  it('detaches same-length foreign output after a deletion rebuilt the dense list', () => {
    const center = createNotificationCenter()
    const id = center.post({ title: 'remove' })
    center.post({ title: 'keep' })
    center.dismiss(id)
    const previous = center.getState().notifications
    const foreign: DesktopNotification = { id: 'f', title: 'foreign', tone: 'info', timeout: 0 }
    withIterator(previous, [foreign], () => center.post({ title: 'new' }))
    foreign.title = 'mutated'
    center.post({ title: 'later' })
    expect(titles(center)).toEqual(['later', 'new', 'foreign'])
    expect(previous.map((item) => item.title)).toEqual(['keep'])
  })

  it('preserves synchronous iterator reentry and subscriber publication order', () => {
    const center = createNotificationCenter()
    center.post({ title: 'root' })
    const previous = center.getState().notifications
    const method = Object.getOwnPropertyDescriptor(Array.prototype, Symbol.iterator)!
    const events: string[][] = []
    const off = center.subscribe((state) => {
      events.push(state.notifications.map((item) => item.title))
    })
    let entered = false
    try {
      Object.defineProperty(Array.prototype, Symbol.iterator, {
        ...method,
        value: function (this: DesktopNotification[]) {
          if (this === previous && !entered) {
            entered = true
            center.post({ title: 'inner' })
          }
          return method.value.call(this)
        },
      })
      center.post({ title: 'outer' })
    } finally {
      Object.defineProperty(Array.prototype, Symbol.iterator, method)
      off()
    }
    expect(events).toEqual([
      ['inner', 'root'],
      ['outer', 'root'],
    ])
    expect(titles(center)).toEqual(['outer', 'root'])
  })

  it('does not disguise list provenance lookup work by changing its container', () => {
    const center = createNotificationCenter()
    const has = Object.getOwnPropertyDescriptor(WeakSet.prototype, 'has')!
    const get = Object.getOwnPropertyDescriptor(WeakMap.prototype, 'get')!
    let calls = 0
    try {
      Object.defineProperty(WeakSet.prototype, 'has', {
        ...has,
        value: function (this: WeakSet<object>, key: object) {
          calls++
          return has.value.call(this, key)
        },
      })
      Object.defineProperty(WeakMap.prototype, 'get', {
        ...get,
        value: function (this: WeakMap<object, unknown>, key: object) {
          calls++
          return get.value.call(this, key)
        },
      })
      for (let index = 0; index < 200; index++) center.post({ title: String(index) })
    } finally {
      Object.defineProperty(WeakMap.prototype, 'get', get)
      Object.defineProperty(WeakSet.prototype, 'has', has)
    }
    expect(calls).toBe(200)
    expect(center.list()).toHaveLength(200)
  })
})
