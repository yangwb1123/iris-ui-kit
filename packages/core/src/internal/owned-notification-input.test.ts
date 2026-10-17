import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { createOwnedNotificationPilot } from './owned-notifications'

const record = (id: string) => ({
  id,
  title: '',
  body: undefined as string | undefined,
  icon: undefined,
  appId: undefined,
  tone: 'info',
  timeout: 4500,
})

// Independent fixture accounting: includes array length/index keys and undefined leaves.
function textUnits(value: unknown): number {
  if (typeof value === 'string') return value.length
  if (value === null || typeof value !== 'object') return 0
  return Reflect.ownKeys(value).reduce(
    (sum, key) =>
      sum + String(key).length + textUnits(Object.getOwnPropertyDescriptor(value, key)!.value),
    0,
  )
}

describe('owned notification declared tone contract', () => {
  it.each(['info', 'success', 'warning', 'danger'] as const)(
    'preserves posted %s through immutable views and detached round-trip',
    (tone) => {
      const center = createOwnedNotificationPilot()
      center.post({ title: 'posted', tone })
      const view = center.getState()
      expect(view.notifications[0]!.tone).toBe(tone)
      expect(Object.isFrozen(view.notifications[0])).toBe(true)
      const exported = center.exportRecords()
      expect(exported[0]!.tone).toBe(tone)
      const other = createOwnedNotificationPilot()
      other.importRecords(exported)
      expect(other.getState().notifications[0]!.tone).toBe(tone)
      expect(other.getState().notifications[0]).not.toBe(view.notifications[0])
    },
  )

  it.each(['info', 'success', 'warning', 'danger'] as const)(
    'admits normalized imported %s without converting it to another tone',
    (tone) => {
      const center = createOwnedNotificationPilot()
      const input = [{ ...record('a'), tone }]
      expect(() => center.importRecords(input)).not.toThrow()
      expect(center.getState().notifications[0]!.tone).toBe(tone)
      expect(center.exportRecords()[0]!.tone).toBe(tone)
      center.importRecords(center.exportRecords())
      expect(center.getState().notifications[0]!.tone).toBe(tone)
      expect(center.getState().revision).toBe(2)
    },
  )

  it('normalizes unsupported posted error scalar to info without changing input', () => {
    const center = createOwnedNotificationPilot()
    const input = { title: 'unsupported', tone: 'error' }
    center.post(input)
    expect(center.getState().notifications[0]!.tone).toBe('info')
    expect(center.exportRecords()[0]!.tone).toBe('info')
    expect(input.tone).toBe('error')
  })

  it('refuses unsupported imported error atomically instead of treating it as normalized', () => {
    const center = createOwnedNotificationPilot()
    center.post({ title: 'keep' })
    const before = center.getState(),
      listener = vi.fn()
    center.subscribe(listener)
    expect(() => center.importRecords([{ ...record('bad'), tone: 'error' }])).toThrow(
      'NORMALIZED_RECORD',
    )
    expect(center.getState()).toBe(before)
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('owned notification admission and fixed PRIVATE limits', () => {
  it.each(
    [
      undefined,
      null,
      42,
      'title',
      true,
      [],
      new Date(),
      new Map(),
      new Set(),
      new Uint8Array(),
      new (class Payload {
        title = 'a'
      })(),
      runInNewContext('({ title: "a" })'),
    ].map((value) => [value]),
  )('refuses non-record/root prototypes %# without committing', (input) => {
    const center = createOwnedNotificationPilot(),
      before = center.getState()
    expect(() => center.post(input)).toThrow()
    expect(center.getState()).toBe(before)
  })

  it.each(
    [NaN, Infinity, -Infinity, 1n, Symbol('x'), () => 1, {}, [], new Date()].map((value) => [
      value,
    ]),
  )('refuses non-admitted leaves %# before tone/timeout normalization', (value) => {
    const center = createOwnedNotificationPilot(),
      before = center.getState()
    expect(() => center.post({ title: 'a', tone: value })).toThrow()
    expect(() => center.post({ title: 'a', timeout: value })).toThrow()
    expect(center.getState()).toBe(before)
  })

  it('preserves -0 and undefined and normalizes only admitted scalar controls', () => {
    const center = createOwnedNotificationPilot()
    center.post({ title: '', tone: false, timeout: -0, body: undefined })
    const notification = center.getState().notifications[0]!
    expect(Object.is(notification.timeout, -0)).toBe(true)
    expect(notification.tone).toBe('info')
    expect(Object.hasOwn(notification, 'body')).toBe(true)
    center.importRecords(center.exportRecords())
    expect(Object.is(center.getState().notifications[0]!.timeout, -0)).toBe(true)
    center.post({ title: 'default', tone: 42, timeout: '1' })
    expect(center.getState().notifications[0]).toMatchObject({ tone: 'info', timeout: 4500 })
  })

  it('accepts null-prototype and frozen records but still makes fresh ordinary records', () => {
    const center = createOwnedNotificationPilot()
    const input = Object.freeze(Object.assign(Object.create(null), { title: 'null prototype' }))
    center.post(input)
    expect(Object.getPrototypeOf(center.getState().notifications[0])).toBe(Object.prototype)
    const old = center.getState()
    center.importRecords(old.notifications)
    expect(center.getState().notifications[0]).not.toBe(old.notifications[0])
  })

  it.each(['__proto__', 'constructor', 'prototype', 'other', 'id', Symbol('key')])(
    'rejects reserved, unknown and symbol keys without reading their values %#',
    (key) => {
      const center = createOwnedNotificationPilot()
      const value = Object.defineProperty({ title: 'x' }, key, {
        value: 'secret',
        enumerable: true,
      })
      expect(() => center.post(value)).toThrow()
      expect(center.getState().revision).toBe(0)
    },
  )

  it('rejects hidden/disappearing properties, cycles and nested containers', () => {
    const center = createOwnedNotificationPilot()
    const cycle: { title: string; body?: unknown } = { title: 'cyclic' }
    cycle.body = cycle
    for (const input of [
      cycle,
      { title: 'x', body: { child: 'x' } },
      Object.defineProperty({}, 'title', { value: 'hidden' }),
    ]) {
      expect(() => center.post(input)).toThrow()
    }
    const disappearing = new Proxy({ title: 'x' }, { getOwnPropertyDescriptor: () => undefined })
    expect(() => center.post(disappearing)).toThrow('DATA_PROPERTY')
  })

  it('rejects sparse, inherited, custom, symbolic and noncanonical array shapes', () => {
    const center = createOwnedNotificationPilot()
    const extra = [record('a')]
    Object.defineProperty(extra, '01', { value: record('b'), enumerable: true })
    const symbolic = [record('a')]
    Object.defineProperty(symbolic, Symbol.iterator, {
      value: () => {
        throw Error('never invoke')
      },
    })
    const inherited = new Array(1)
    Object.setPrototypeOf(inherited, { 0: record('a') })
    for (const input of [
      new Array(1),
      extra,
      symbolic,
      inherited,
      new (class extends Array {})(),
      runInNewContext('[]'),
    ]) {
      expect(() => center.importRecords(input)).toThrow()
    }
    let calls = 0
    const accessor = Object.defineProperty([record('a')], '0', {
      get() {
        calls++
        return record('b')
      },
    })
    expect(() => center.importRecords(accessor)).toThrow('DATA_PROPERTY')
    expect(calls).toBe(0)
  })

  it('captures dense array descriptors in index order, without Get/iterator use', () => {
    const center = createOwnedNotificationPilot(),
      trace: string[] = []
    const input = new Proxy([record('a'), record('b')], {
      get() {
        throw Error('no general Get')
      },
      ownKeys() {
        trace.push('keys')
        return ['1', 'length', '0']
      },
      getOwnPropertyDescriptor(target, key) {
        trace.push(String(key))
        return Reflect.getOwnPropertyDescriptor(target, key)
      },
    })
    center.importRecords(input)
    expect(trace).toEqual(['keys', 'length', '0', '1'])
    expect(center.exportRecords().map((n) => n.id)).toEqual(['a', 'b'])
  })

  it.each([
    { id: '' },
    { id: 1 },
    { title: null },
    { body: null },
    { icon: false },
    { appId: [] },
    { tone: 'unknown' },
    { tone: undefined },
    { timeout: -1 },
    { timeout: undefined },
    { timeout: Infinity },
  ])('requires typed normalized import fields %#', (patch) => {
    const center = createOwnedNotificationPilot()
    expect(() => center.importRecords([{ ...record('a'), ...patch }])).toThrow()
    expect(center.getState().revision).toBe(0)
  })

  it('bounds strings, key width/count and diagnostics without leaking values', () => {
    const center = createOwnedNotificationPilot()
    center.post({ title: 'x'.repeat(65_536) })
    const before = center.getState()
    expect(() => center.post({ title: 'SECRET'.repeat(11_000) })).toThrow('TEXT_LIMIT')
    expect(() => center.post({ ['k'.repeat(257)]: 'x' })).toThrow('TEXT_LIMIT')
    const wide = Object.fromEntries(Array.from({ length: 257 }, (_, i) => [`k${i}`, 'x']))
    expect(() => center.post(wide)).toThrow('KEY_LIMIT')
    let failure: unknown
    try {
      center.post({ title: { SECRET: 'must not appear' } })
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(TypeError)
    expect(String(failure)).not.toContain('SECRET')
    expect(String(failure).length).toBeLessThan(512)
    expect(center.getState()).toBe(before)
  })

  it('enforces 10000 live records without eviction and round-trips a full export', () => {
    const center = createOwnedNotificationPilot()
    const input = Array.from({ length: 10_000 }, (_, i) => record(String(i)))
    center.importRecords(input)
    const before = center.getState()
    expect(() => center.post({ title: 'overflow' })).toThrow('LIVE_LIMIT')
    expect(center.getState()).toBe(before)
    const exported = center.exportRecords()
    const other = createOwnedNotificationPilot()
    other.importRecords(exported)
    expect(other.exportRecords()).toEqual(exported)
    expect(other.getState().revision).toBe(1)
    expect(() => center.importRecords([...input, record('extra')])).toThrow('ARRAY_LIMIT')
    center.dismiss('5000')
    center.post({ title: 'one free slot' })
    expect(center.getState().notifications).toHaveLength(10_000)
    center.dismissAll()
    center.post({ title: 'fresh budget' })
    expect(center.getState().notifications).toHaveLength(1)
  })

  it('round-trips exactly 1048576 text units, including IDs/default keys/index keys', () => {
    const input = Array.from({ length: 17 }, (_, i) => record(String(i)))
    let remaining = 1_048_576 - textUnits(input)
    for (const item of input) {
      const count = Math.min(65_536, remaining)
      item.title = 'x'.repeat(count)
      remaining -= count
    }
    expect(remaining).toBe(0)
    expect(textUnits(input)).toBe(1_048_576)
    const center = createOwnedNotificationPilot()
    center.importRecords(input)
    const exported = center.exportRecords()
    expect(textUnits(exported)).toBe(1_048_576)
    center.importRecords(exported)
    const before = center.getState()
    expect(() => center.post({ title: '' })).toThrow('LIVE_LIMIT')
    input[16]!.title += 'x'
    expect(() => center.importRecords(input)).toThrow('TEXT_LIMIT')
    expect(center.getState()).toBe(before)
    center.dismiss('0')
    center.post({ title: 'space released' })
    expect(textUnits(center.exportRecords())).toBeLessThan(1_048_576)
  })

  it('rejects an oversized reported array key before scanning its characters', () => {
    const center = createOwnedNotificationPilot()
    const key = '9'.repeat(257)
    const input = new Proxy([record('a')], { ownKeys: () => [key, 'length'] })
    const scan = vi.spyOn(RegExp.prototype, 'test')
    try {
      expect(() => center.importRecords(input)).toThrow()
      expect(scan.mock.calls.some(([value]) => value === key)).toBe(false)
    } finally {
      scan.mockRestore()
    }
  })

  it('accounts for canonical defaults even when the admitted input omits them', () => {
    const input = Array.from({ length: 17 }, (_, i) => ({
      id: String(i),
      title: '',
      tone: 'info',
      timeout: 4500,
    }))
    let remaining = 1_048_576 - textUnits(input)
    for (const item of input) {
      const count = Math.min(65_536, remaining)
      item.title = 'x'.repeat(count)
      remaining -= count
    }
    const center = createOwnedNotificationPilot(),
      before = center.getState()
    expect(textUnits(input)).toBe(1_048_576)
    expect(() => center.importRecords(input)).toThrow('LIVE_LIMIT')
    expect(center.getState()).toBe(before)
  })
})
