import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAuditLog } from './audit-log'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createAuditLog', () => {
  // ─── Ring limit ────────────────────────────────────────────────────────

  it('starts empty with depth 0', () => {
    const a = createAuditLog()
    expect(a.depth).toBe(0)
    expect(a.list()).toEqual([])
    expect(a.getVersion()).toBe(0)
  })

  it('trims the OLDEST entries once the ring exceeds the limit', () => {
    const a = createAuditLog({ limit: 3 })
    a.push({ type: 'edit', rowKey: 1, column: 'name', oldValue: 'A', newValue: 'B' })
    a.push({ type: 'insert', rowKey: 2 })
    a.push({ type: 'edit', rowKey: 3, column: 'age', oldValue: 1, newValue: 2 })
    expect(a.depth).toBe(3)
    a.push({ type: 'remove', rowKey: 4 })
    expect(a.depth).toBe(3)
    // The oldest (seq 1) is gone; the ring holds seqs 2-4 newest-first.
    expect(a.list().map((e) => e.seq)).toEqual([4, 3, 2])
    expect(a.list().some((e) => e.seq === 1)).toBe(false)
  })

  it('default limit is 200', () => {
    const a = createAuditLog()
    for (let i = 0; i < 210; i += 1) a.push({ type: 'edit', rowKey: i })
    expect(a.depth).toBe(200)
    expect(a.list()[0]!.seq).toBe(210)
    expect(a.list()[199]!.seq).toBe(11)
  })

  it('limit 0 disables the bound', () => {
    const a = createAuditLog({ limit: 0 })
    for (let i = 0; i < 250; i += 1) a.push({ type: 'edit', rowKey: i })
    expect(a.depth).toBe(250)
  })

  // ─── Newest-first order + seq/at fill ──────────────────────────────────

  it('lists newest-first with monotonic seq', () => {
    const a = createAuditLog()
    a.push({ type: 'insert', rowKey: 1 })
    a.push({ type: 'edit', rowKey: 2, column: 'name', oldValue: 'x', newValue: 'y' })
    a.push({ type: 'remove', rowKey: 3 })
    const list = a.list()
    expect(list.map((e) => e.seq)).toEqual([3, 2, 1])
    expect(list.map((e) => e.type)).toEqual(['remove', 'edit', 'insert'])
    expect(list[1]).toMatchObject({ rowKey: 2, column: 'name', oldValue: 'x', newValue: 'y' })
  })

  it('fills at (epoch ms) on push', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T10:00:00Z'))
    const a = createAuditLog()
    a.push({ type: 'edit', rowKey: 1 })
    expect(a.list()[0]!.at).toBe(Date.parse('2026-08-14T10:00:00Z'))
    vi.useRealTimers()
  })

  it('list() returns copies — mutating them does not touch the trail', () => {
    const a = createAuditLog()
    a.push({ type: 'edit', rowKey: 1 })
    const list = a.list()
    ;(list[0] as { rowKey?: unknown }).rowKey = 999
    expect(a.list()[0]!.rowKey).toBe(1)
  })

  // ─── Clear ─────────────────────────────────────────────────────────────

  it('clear() empties the trail but never resets the seq counter', () => {
    const a = createAuditLog()
    a.push({ type: 'edit', rowKey: 1 })
    a.push({ type: 'edit', rowKey: 2 })
    a.clear()
    expect(a.depth).toBe(0)
    expect(a.list()).toEqual([])
    // Audit integrity: a cleared trail resumes at a HIGHER seq, never at 0.
    a.push({ type: 'remove', rowKey: 3 })
    expect(a.list()[0]!.seq).toBe(3)
  })

  it('clear() on an empty trail is a no-op (no subscriber notification)', () => {
    const a = createAuditLog()
    const spy = vi.fn()
    a.subscribe(spy)
    a.clear()
    expect(spy).not.toHaveBeenCalled()
  })

  // ─── Subscribe / getVersion ────────────────────────────────────────────

  it('notifies subscribers on push and clear, with the version bumping', () => {
    const a = createAuditLog()
    const spy = vi.fn()
    const unsub = a.subscribe(spy)
    const v0 = a.getVersion()
    a.push({ type: 'edit', rowKey: 1 })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(a.getVersion()).toBe(v0 + 1)
    a.clear()
    expect(spy).toHaveBeenCalledTimes(2)
    expect(a.getVersion()).toBe(v0 + 2)
    unsub()
    a.push({ type: 'edit', rowKey: 2 })
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('is inert without any subscriber', () => {
    const a = createAuditLog()
    expect(() => a.push({ type: 'edit', rowKey: 1 })).not.toThrow()
    expect(a.depth).toBe(1)
  })
})
