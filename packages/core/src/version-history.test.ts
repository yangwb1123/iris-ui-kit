import { afterEach, describe, expect, it, vi } from 'vitest'
import { createVersionHistory } from './version-history'

afterEach(() => {
  vi.restoreAllMocks()
})

interface Row {
  id: number
  name: string
}

const S0: Row[] = [
  { id: 1, name: 'A' },
  { id: 2, name: 'B' },
]
const S1: Row[] = [
  { id: 1, name: 'A1' },
  { id: 2, name: 'B' },
]
const S2: Row[] = [
  { id: 1, name: 'A1' },
  { id: 2, name: 'B2' },
]

describe('createVersionHistory', () => {
  // ─── Ring bound ────────────────────────────────────────────────────────

  it('starts empty with depth 0', () => {
    const h = createVersionHistory<Row>()
    expect(h.depth).toBe(0)
    expect(h.list()).toEqual([])
    expect(h.getVersion()).toBe(0)
  })

  it('pushes the PRE-change rows + type hint and fills index/at', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-15T08:00:00Z'))
    const h = createVersionHistory<Row>()
    const entry = h.push(S0, 'edit')
    expect(entry).toMatchObject({ index: 0, type: 'edit' })
    expect(entry.rows).toBe(S0)
    expect(entry.at).toBe(Date.parse('2026-08-15T08:00:00Z'))
    vi.useRealTimers()
  })

  it('defaults the type to edit', () => {
    const h = createVersionHistory<Row>()
    expect(h.push(S0).type).toBe('edit')
  })

  it('default max is 20', () => {
    const h = createVersionHistory<Row>()
    for (let i = 0; i < 25; i += 1) h.push(S0)
    expect(h.depth).toBe(20)
    expect(h.list()[0]!.index).toBe(24)
    expect(h.list()[19]!.index).toBe(5)
  })

  it('trims the OLDEST versions once the ring exceeds max', () => {
    const h = createVersionHistory<Row>({ max: 3 })
    h.push(S0, 'insert')
    h.push(S1, 'edit')
    h.push(S2, 'edit')
    expect(h.depth).toBe(3)
    h.push(S2, 'remove')
    expect(h.depth).toBe(3)
    // The oldest (index 0) is gone; the ring holds indexes 1-3 newest-first.
    expect(h.list().map((e) => e.index)).toEqual([3, 2, 1])
    expect(h.get(0)).toBeUndefined()
  })

  it('max 0 disables the bound', () => {
    const h = createVersionHistory<Row>({ max: 0 })
    for (let i = 0; i < 250; i += 1) h.push(S0)
    expect(h.depth).toBe(250)
  })

  // ─── Newest-first order + get ──────────────────────────────────────────

  it('lists newest-first with monotonic index', () => {
    const h = createVersionHistory<Row>()
    h.push(S0, 'insert')
    h.push(S1, 'edit')
    h.push(S2, 'remove')
    const list = h.list()
    expect(list.map((e) => e.index)).toEqual([2, 1, 0])
    expect(list.map((e) => e.type)).toEqual(['remove', 'edit', 'insert'])
    expect(list[1]).toMatchObject({ index: 1, type: 'edit' })
    expect(list[1]!.rows).toBe(S1)
  })

  it('get(index) returns the entry copy (rows shared reference)', () => {
    const h = createVersionHistory<Row>()
    h.push(S0, 'insert')
    h.push(S1, 'edit')
    const e = h.get(0)
    expect(e).toMatchObject({ index: 0, type: 'insert' })
    expect(e!.rows).toBe(S0)
    // Copies: mutating the returned entry does not touch the ring.
    ;(e as { index?: unknown }).index = 999
    expect(h.get(0)!.index).toBe(0)
  })

  it('get() is undefined for unknown / trimmed / cleared indexes', () => {
    const h = createVersionHistory<Row>({ max: 2 })
    h.push(S0)
    h.push(S1)
    h.push(S2) // trims index 0
    expect(h.get(0)).toBeUndefined()
    expect(h.get(99)).toBeUndefined()
    h.clear()
    expect(h.get(2)).toBeUndefined()
  })

  it('list() returns copies — mutating them does not touch the ring', () => {
    const h = createVersionHistory<Row>()
    h.push(S0, 'edit')
    const list = h.list()
    ;(list[0] as { index?: unknown }).index = 999
    expect(h.list()[0]!.index).toBe(0)
  })

  // ─── Clear ─────────────────────────────────────────────────────────────

  it('clear() empties the ring but never resets the index counter', () => {
    const h = createVersionHistory<Row>()
    h.push(S0)
    h.push(S1)
    h.clear()
    expect(h.depth).toBe(0)
    expect(h.list()).toEqual([])
    // Monotonic stream: a cleared history resumes at a HIGHER index, never 0.
    h.push(S2)
    expect(h.list()[0]!.index).toBe(2)
  })

  it('clear() on an empty ring is a no-op (no subscriber notification)', () => {
    const h = createVersionHistory<Row>()
    const spy = vi.fn()
    h.subscribe(spy)
    h.clear()
    expect(spy).not.toHaveBeenCalled()
  })

  // ─── Subscribe / getVersion ────────────────────────────────────────────

  it('notifies subscribers on push and clear, with the version bumping', () => {
    const h = createVersionHistory<Row>()
    const spy = vi.fn()
    const unsub = h.subscribe(spy)
    const v0 = h.getVersion()
    h.push(S0)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(h.getVersion()).toBe(v0 + 1)
    h.clear()
    expect(spy).toHaveBeenCalledTimes(2)
    expect(h.getVersion()).toBe(v0 + 2)
    unsub()
    h.push(S1)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('is inert without any subscriber', () => {
    const h = createVersionHistory<Row>()
    expect(() => h.push(S0)).not.toThrow()
    expect(h.depth).toBe(1)
  })
})
