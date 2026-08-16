import { describe, expect, it, vi } from 'vitest'
import { createRecentFilters } from './recent-filters'

describe('createRecentFilters', () => {
  it('records entries newest-first', () => {
    const recent = createRecentFilters()
    recent.record('status', ['active'])
    recent.record('name', ['ab'])
    expect(recent.depth).toBe(2)
    expect(recent.list().map((e) => e.key)).toEqual(['name', 'status'])
    expect(recent.list()[0]!.values).toEqual(['ab'])
  })

  it('de-dupes the same key + values SET to the top (MRU, ts bumped)', () => {
    const recent = createRecentFilters()
    recent.record('status', ['active', 'paused'])
    const firstTs = recent.list()[0]!.ts
    recent.record('name', ['ab'])
    recent.record('status', ['paused', 'active']) // same set, reversed order
    const list = recent.list()
    expect(recent.depth).toBe(2)
    expect(list.map((e) => e.key)).toEqual(['status', 'name'])
    expect(list[0]!.values).toEqual(['paused', 'active']) // raw re-record values
    expect(list[0]!.ts).toBeGreaterThanOrEqual(firstTs)
  })

  it('keeps distinct entries for the same key with different value sets', () => {
    const recent = createRecentFilters()
    recent.record('status', ['active'])
    recent.record('status', ['paused'])
    expect(recent.depth).toBe(2)
    expect(recent.list().map((e) => e.values)).toEqual([['paused'], ['active']])
  })

  it('is ring-bounded at 10 by default — the oldest drops off', () => {
    const recent = createRecentFilters()
    for (let i = 0; i < 12; i += 1) recent.record(`k${i}`, [`v${i}`])
    expect(recent.depth).toBe(10)
    const keys = recent.list().map((e) => e.key)
    expect(keys[0]).toBe('k11')
    expect(keys).not.toContain('k0')
    expect(keys).not.toContain('k1')
  })

  it('list returns deep copies — mutating them does not corrupt the ring', () => {
    const recent = createRecentFilters()
    recent.record('status', ['active'])
    const snapshot = recent.list()
    snapshot[0]!.values.push('tampered')
    snapshot[0]!.key = 'tampered'
    expect(recent.list()[0]!.values).toEqual(['active'])
    expect(recent.list()[0]!.key).toBe('status')
  })

  it('clear empties the ring and notifies subscribers', () => {
    const recent = createRecentFilters()
    const cb = vi.fn()
    recent.subscribe(cb)
    recent.record('status', ['active'])
    expect(cb).toHaveBeenCalledTimes(1)
    recent.clear()
    expect(recent.depth).toBe(0)
    expect(recent.list()).toEqual([])
    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('subscribe notifies on record; unsubscribe stops notifications', () => {
    const recent = createRecentFilters()
    const cb = vi.fn()
    const off = recent.subscribe(cb)
    recent.record('a', ['1'])
    off()
    recent.record('b', ['2'])
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('getVersion increments per mutation and depth reflects retention', () => {
    const recent = createRecentFilters({ limit: 2 })
    const v0 = recent.getVersion()
    recent.record('a', ['1'])
    recent.record('b', ['2'])
    recent.record('c', ['3']) // over the bound — drops 'a'
    expect(recent.getVersion()).toBe(v0 + 3)
    expect(recent.depth).toBe(2)
    expect(recent.list().map((e) => e.key)).toEqual(['c', 'b'])
  })
})
