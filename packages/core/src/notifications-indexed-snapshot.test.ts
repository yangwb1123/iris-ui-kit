import { describe, expect, it, vi } from 'vitest'
import { createNotificationCenter, type DesktopNotification } from './notifications'

const record = (id: string, title = id): DesktopNotification => ({
  id,
  title,
  tone: 'info',
  timeout: 0,
})

function dismissProduced(produced: DesktopNotification[]) {
  const center = createNotificationCenter()
  const input = [record('removed')]
  input.filter = (() => produced) as typeof input.filter
  center.store.setState({ notifications: input })
  center.dismiss('removed')
  return center
}

describe('notification indexed snapshot compatibility', () => {
  it('does not recheck record provenance after actual spread matches dense owned records', () => {
    const center = createNotificationCenter()
    const has = vi.spyOn(WeakSet.prototype, 'has')
    let calls = 0
    try {
      for (let index = 0; index < 200; index++) center.post({ title: String(index) })
      calls = has.mock.calls.length
    } finally {
      has.mockRestore()
    }
    expect(calls).toBeLessThanOrEqual(200)
    expect(center.getState().notifications.length).toBe(200)
  })

  it.each(['empty', 'throwing'] as const)(
    'ignores a filter species result %s iterator like indexed map',
    (mode) => {
      const center = createNotificationCenter()
      center.post({ title: 'survivor' })
      const removed = center.post({ title: 'removed' })
      const descriptor = Object.getOwnPropertyDescriptor(Array, Symbol.species)!
      function Species() {
        Object.defineProperty(Array, Symbol.species, descriptor)
        const produced: DesktopNotification[] = []
        produced[Symbol.iterator] = () => ({
          next() {
            if (mode === 'throwing') throw new Error('produced iterator must not run')
            return { done: true, value: undefined }
          },
        })
        return produced
      }
      try {
        Object.defineProperty(Array, Symbol.species, { configurable: true, value: Species })
        expect(() => center.dismiss(removed)).not.toThrow()
      } finally {
        Object.defineProperty(Array, Symbol.species, descriptor)
      }
      expect(center.getState().notifications.map((item) => item.title)).toEqual(['survivor'])
    },
  )

  it('keeps sparse holes and uses inherited indices, never a produced iterator or map', () => {
    const produced = new Array<DesktopNotification>(3)
    produced[0] = record('first')
    produced[2] = record('third')
    let reads = 0
    const prototype = Object.create(Array.prototype)
    Object.defineProperty(prototype, '1', {
      get: () => {
        reads++
        return record('inherited')
      },
    })
    Object.setPrototypeOf(produced, prototype)
    produced.length = 4
    produced.map = (() => {
      throw new Error('foreign map must not run')
    }) as typeof produced.map
    produced[Symbol.iterator] = () => ({
      next() {
        throw new Error('foreign iterator must not run')
      },
    })
    const center = dismissProduced(produced)
    const snapshot = center.getState().notifications
    expect(reads).toBe(1)
    expect(snapshot.length).toBe(4)
    expect(3 in snapshot).toBe(false)
    expect(snapshot.slice(0, 3).map((item) => item.id)).toEqual(['first', 'inherited', 'third'])
    expect(Object.getPrototypeOf(snapshot)).toBe(Array.prototype)
  })

  it('reads length once and preserves HasProperty/get/getter ordering under source mutation', () => {
    const events: string[] = []
    const produced = new Array<DesktopNotification>(3)
    produced[0] = record('first')
    produced[2] = record('third')
    Object.defineProperty(produced[0]!, 'title', {
      enumerable: true,
      get() {
        events.push('title0')
        produced[1] = record('late')
        produced.push(record('out-of-window'))
        return 'first'
      },
    })
    const proxy = new Proxy(produced, {
      get(target, key, receiver) {
        events.push('get:' + String(key))
        return Reflect.get(target, key, receiver)
      },
      has(target, key) {
        events.push('has:' + String(key))
        return Reflect.has(target, key)
      },
    })
    const center = dismissProduced(proxy)
    expect(events).toEqual([
      'get:length',
      'has:0',
      'get:0',
      'title0',
      'has:1',
      'get:1',
      'has:2',
      'get:2',
    ])
    expect(center.getState().notifications.map((item) => item.id)).toEqual([
      'first',
      'late',
      'third',
    ])
    expect(produced.length).toBe(4)
  })

  it('does not invoke numeric prototype setters installed while reading a foreign record', () => {
    const produced: DesktopNotification[] = []
    produced.length = 101
    const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, '100')
    let setterCalls = 0
    produced[100] = {
      ...record('foreign'),
      get title() {
        Object.defineProperty(Array.prototype, '100', {
          configurable: true,
          set() {
            setterCalls++
            throw new Error('indexed snapshot must not invoke inherited setter')
          },
        })
        return 'original'
      },
    }
    let center: ReturnType<typeof createNotificationCenter>
    try {
      center = dismissProduced(produced)
    } finally {
      if (descriptor) Object.defineProperty(Array.prototype, '100', descriptor)
      else delete (Array.prototype as unknown as Record<string, unknown>)['100']
    }
    expect(setterCalls).toBe(0)
    expect(center!.getState().notifications[100]!.title).toBe('original')
    expect(Object.getPrototypeOf(center!.getState().notifications)).toBe(Array.prototype)
  })

  it('honors an overridden iterator even on an owned list and detaches its foreign records', () => {
    const center = createNotificationCenter()
    center.post({ title: 'first' })
    const previous = center.getState().notifications
    const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, Symbol.iterator)!
    const original = Array.prototype[Symbol.iterator]
    let title = 'original'
    const foreign = Object.freeze({
      ...record('foreign'),
      get title() {
        return title
      },
    })
    let calls = 0
    try {
      Object.defineProperty(Array.prototype, Symbol.iterator, {
        configurable: true,
        value: function (this: DesktopNotification[]) {
          if (this !== previous) return original.call(this)
          calls++
          return original.call([foreign])
        },
      })
      center.post({ title: 'new' })
    } finally {
      Object.defineProperty(Array.prototype, Symbol.iterator, descriptor)
    }
    title = 'outside'
    expect(calls).toBe(1)
    expect(center.list().map((item) => item.title)).toEqual(['new', 'original'])
  })

  it.each(['constructor', Symbol.isConcatSpreadable] as const)(
    'does not read a non-default concat protocol %s on post',
    (key) => {
      const center = createNotificationCenter()
      center.post({ title: 'first' })
      const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, key)
      let reads = 0
      try {
        Object.defineProperty(Array.prototype, key, {
          configurable: true,
          get() {
            reads++
            throw new Error('spread post never consumes concat protocol')
          },
        })
        center.post({ title: 'new' })
      } finally {
        if (descriptor) Object.defineProperty(Array.prototype, key, descriptor)
        else Reflect.deleteProperty(Array.prototype, key)
      }
      expect(reads).toBe(0)
      expect(center.list().map((item) => item.title)).toEqual(['new', 'first'])
    },
  )

  it.each(['throwing', 'empty'] as const)(
    'runs overridden iterator next before deciding post ownership: %s',
    (mode) => {
      const center = createNotificationCenter()
      center.post({ title: 'first' })
      const before = center.getState()
      const prototype = Object.getPrototypeOf([][Symbol.iterator]())
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'next')!
      let error: unknown
      let calls = 0
      try {
        Object.defineProperty(prototype, 'next', {
          configurable: true,
          value() {
            calls++
            if (mode === 'throwing') throw new Error('iterator failure')
            return { done: true, value: undefined }
          },
        })
        try {
          center.post({ title: 'second' })
        } catch (caught) {
          error = caught
        }
      } finally {
        Object.defineProperty(prototype, 'next', descriptor)
      }
      expect(calls).toBeGreaterThan(0)
      if (mode === 'throwing') {
        expect(error instanceof Error && error.message).toBe('iterator failure')
        expect(center.getState() === before).toBe(true)
      } else {
        expect(error).toBeUndefined()
        expect(center.list().map((item) => item.title)).toEqual(['second'])
      }
    },
  )

  it('detaches a foreign record yielded by next without changing the array iterator method', () => {
    const center = createNotificationCenter()
    center.post({ title: 'first' })
    const prototype = Object.getPrototypeOf([][Symbol.iterator]())
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'next')!
    let title = 'original'
    const foreign = Object.freeze({
      ...record('foreign'),
      get title() {
        return title
      },
    })
    const seen = new WeakSet<object>()
    try {
      Object.defineProperty(prototype, 'next', {
        configurable: true,
        value(this: object) {
          if (seen.has(this)) return { done: true, value: undefined }
          seen.add(this)
          // Restore before store notification iteration so only the actual post
          // spread gets the foreign record.
          Object.defineProperty(prototype, 'next', descriptor)
          return { done: false, value: foreign }
        },
      })
      center.post({ title: 'second' })
    } finally {
      Object.defineProperty(prototype, 'next', descriptor)
    }
    title = 'outside'
    expect(center.list().map((item) => item.title)).toEqual(['second', 'original'])
  })

  it('detaches indexed frozen foreign accessors and keeps list copies detached', () => {
    let title = 'original'
    const foreign = Object.freeze({
      ...record('foreign'),
      get title() {
        return title
      },
    })
    const center = dismissProduced([foreign])
    const retained = center.getState()
    title = 'outside'
    expect(retained.notifications[0]!.title).toBe('original')
    expect(retained.notifications[0]).not.toBe(foreign)
    const listed = center.list()
    listed[0]!.title = 'list edit'
    expect(retained.notifications[0]!.title).toBe('original')
  })
})
