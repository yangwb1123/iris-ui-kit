import { describe, expect, it, vi } from 'vitest'
import {
  composeEventHandlers,
  generateId,
  mergeProps,
  normalizeKeys,
  safeArray,
  safeNumber,
} from './utils'

describe('composeEventHandlers', () => {
  it('calls all handlers when event is not prevented', () => {
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    const fn3 = vi.fn()
    const composed = composeEventHandlers(fn1, fn2, fn3)
    composed({ defaultPrevented: false } as any)
    expect(fn1).toHaveBeenCalledOnce()
    expect(fn2).toHaveBeenCalledOnce()
    expect(fn3).toHaveBeenCalledOnce()
  })

  it('stops calling handlers after defaultPrevented', () => {
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    const fn3 = vi.fn()
    const composed = composeEventHandlers(fn1, fn2, fn3)
    composed({ defaultPrevented: true } as any)
    expect(fn1).not.toHaveBeenCalled()
    expect(fn2).not.toHaveBeenCalled()
    expect(fn3).not.toHaveBeenCalled()
  })

  it('skips undefined handlers', () => {
    const fn = vi.fn()
    const composed = composeEventHandlers(undefined, fn, undefined)
    composed({ defaultPrevented: false } as any)
    expect(fn).toHaveBeenCalledOnce()
  })

  it('stops on defaultPrevented set during a handler', () => {
    const fn1 = vi.fn((e: { defaultPrevented: boolean }) => {
      e.defaultPrevented = true
    })
    const fn2 = vi.fn()
    const composed = composeEventHandlers(fn1, fn2)
    composed({ defaultPrevented: false } as any)
    expect(fn1).toHaveBeenCalledOnce()
    expect(fn2).not.toHaveBeenCalled()
  })
})

describe('mergeProps', () => {
  it('merges two objects with right winning', () => {
    const a = { x: 1, y: 2 }
    const b = { y: 3, z: 4 }
    expect(mergeProps(a, b)).toEqual({ x: 1, y: 3, z: 4 })
  })

  it('returns shallow copy', () => {
    const a = { x: 1 }
    const b = { y: 2 }
    const merged = mergeProps(a, b)
    merged.x = 99
    expect(a.x).toBe(1)
  })
})

describe('generateId', () => {
  it('generates incrementing ids with default prefix', () => {
    const id1 = generateId()
    const id2 = generateId()
    expect(id1).toBe('iris-1')
    expect(id2).toBe('iris-2')
  })

  it('uses custom prefix', () => {
    const id = generateId('custom')
    expect(id).toBe('custom-3')
  })
})

describe('normalizeKeys', () => {
  it('deduplicates in multiple mode', () => {
    expect(normalizeKeys(['a', 'b', 'a', 'c'], 'multiple')).toEqual(['a', 'b', 'c'])
  })

  it('keeps only last key in single mode', () => {
    expect(normalizeKeys(['a', 'b', 'c'], 'single')).toEqual(['c'])
  })

  it('preserves single key', () => {
    expect(normalizeKeys(['x'], 'single')).toEqual(['x'])
    expect(normalizeKeys(['y'], 'multiple')).toEqual(['y'])
  })

  it('handles empty array', () => {
    expect(normalizeKeys([], 'single')).toEqual([])
    expect(normalizeKeys([], 'multiple')).toEqual([])
  })
})

describe('safeArray', () => {
  it('returns the array when defined', () => {
    expect(safeArray([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('returns empty array for null', () => {
    expect(safeArray(null)).toEqual([])
  })

  it('returns empty array for undefined', () => {
    expect(safeArray(undefined)).toEqual([])
  })

  it('preserves readonly input', () => {
    const arr: readonly string[] = ['a', 'b']
    expect(safeArray(arr)).toEqual(['a', 'b'])
  })
})

describe('safeNumber', () => {
  it('returns the number when finite', () => {
    expect(safeNumber(42)).toBe(42)
    expect(safeNumber(-3.14)).toBe(-3.14)
    expect(safeNumber(0)).toBe(0)
  })

  it('returns fallback for NaN', () => {
    expect(safeNumber(NaN)).toBe(0)
    expect(safeNumber(NaN, -1)).toBe(-1)
  })

  it('returns fallback for Infinity', () => {
    expect(safeNumber(Infinity)).toBe(0)
    expect(safeNumber(-Infinity, 10)).toBe(10)
  })
})
