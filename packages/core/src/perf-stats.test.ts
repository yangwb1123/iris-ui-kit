import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPerfStats, nowMs } from './perf-stats'

afterEach(() => {
  vi.restoreAllMocks()
})

const sample = (
  over: Partial<{ durationMs: number; rows: number; columns: number; changes: number }> = {},
) => ({
  durationMs: 1.25,
  rows: 3,
  columns: 2,
  changes: 0,
  ...over,
})

describe('createPerfStats', () => {
  // ─── Latest-snapshot semantics ────────────────────────────────────────

  it('starts with no sample and version 0', () => {
    const p = createPerfStats()
    expect(p.latest()).toBeNull()
    expect(p.getVersion()).toBe(0)
  })

  it('push stores the latest sample (values round-trip)', () => {
    const p = createPerfStats()
    p.push(sample())
    expect(p.latest()).toEqual(sample())
    expect(p.latest()!.durationMs).toBe(1.25)
    expect(p.latest()!.rows).toBe(3)
    expect(p.latest()!.columns).toBe(2)
    expect(p.latest()!.changes).toBe(0)
  })

  it('push REPLACES the previous sample (only the latest is kept)', () => {
    const p = createPerfStats()
    p.push(sample({ durationMs: 0.5, rows: 2 }))
    p.push(sample({ durationMs: 2.5, rows: 9 }))
    expect(p.latest()).toEqual(sample({ durationMs: 2.5, rows: 9 }))
  })

  it('latest() returns a copy — mutating it does not touch the stored sample', () => {
    const p = createPerfStats()
    p.push(sample())
    p.latest()!.rows = 999
    p.latest()!.durationMs = 999
    expect(p.latest()!.rows).toBe(3)
    expect(p.latest()!.durationMs).toBe(1.25)
  })

  // ─── Subscribe / getVersion ───────────────────────────────────────────

  it('notifies subscribers on push, bumping the version', () => {
    const p = createPerfStats()
    const spy = vi.fn()
    p.subscribe(spy)
    const v0 = p.getVersion()
    p.push(sample())
    expect(spy).toHaveBeenCalledTimes(1)
    expect(p.getVersion()).toBe(v0 + 1)
    p.push(sample({ durationMs: 3 }))
    expect(spy).toHaveBeenCalledTimes(2)
    expect(p.getVersion()).toBe(v0 + 2)
  })

  it('unsubscribe stops notifications', () => {
    const p = createPerfStats()
    const spy = vi.fn()
    const unsub = p.subscribe(spy)
    unsub()
    p.push(sample())
    expect(spy).not.toHaveBeenCalled()
    expect(p.getVersion()).toBe(1) // version still bumps — getSnapshot stays consistent
  })

  it('is inert without any subscriber', () => {
    const p = createPerfStats()
    expect(() => p.push(sample())).not.toThrow()
    expect(p.latest()).not.toBeNull()
  })

  it('has no clear API — a render-commit sample is monotonic (panel displays the latest)', () => {
    // PerfStats deliberately has NO clear: a render-commit sample is
    // monotonic, and the panel only displays the latest (audit clear is
    // handled by the audit controller's own subscription).
    const p = createPerfStats()
    const spy = vi.fn()
    p.subscribe(spy)
    p.push(sample())
    expect(spy).toHaveBeenCalledTimes(1)
    expect(p.latest()).not.toBeNull()
  })
})

describe('nowMs', () => {
  it('returns a finite non-negative number via performance.now', () => {
    const t = nowMs()
    expect(Number.isFinite(t)).toBe(true)
    expect(t).toBeGreaterThanOrEqual(0)
  })

  it('is monotonic across consecutive calls', () => {
    const a = nowMs()
    const b = nowMs()
    expect(b).toBeGreaterThanOrEqual(a)
  })

  it('falls back to Date.now when performance is unavailable', () => {
    vi.stubGlobal('performance', undefined)
    const before = Date.now()
    const t = nowMs()
    expect(t).toBeGreaterThanOrEqual(before)
    expect(t).toBeLessThanOrEqual(Date.now())
  })

  it('falls back when performance.now is missing (SSR runtime)', () => {
    vi.stubGlobal('performance', { now: undefined })
    const t = nowMs()
    expect(Number.isFinite(t)).toBe(true)
    expect(t).toBeGreaterThanOrEqual(0)
  })
})
