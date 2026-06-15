import { describe, expect, it } from 'vitest'
import {
  parsePath,
  formatPath,
  getByPath,
  setByPath,
  deleteByPath,
  rekeyByArrayMutation,
} from './path'

describe('parsePath', () => {
  it('parses a flat key as a 1-segment path', () => {
    expect(parsePath('email')).toEqual(['email'])
  })
  it('parses dotted + bracket-index paths', () => {
    expect(parsePath('a.b[2].c')).toEqual(['a', 'b', 2, 'c'])
    expect(parsePath('items[0]')).toEqual(['items', 0])
  })
  it('parses bracket-key (quoted) segments as string keys, not indices', () => {
    expect(parsePath("a['b c']")).toEqual(['a', 'b c'])
    expect(parsePath('a["b"]')).toEqual(['a', 'b'])
  })
  it('passes a segment array through (copying)', () => {
    const arr = ['a', 2, 'c'] as const
    const out = parsePath(arr)
    expect(out).toEqual(['a', 2, 'c'])
    expect(out).not.toBe(arr)
  })
  it('round-trips through formatPath canonically', () => {
    for (const key of ['email', 'a.b[2].c', 'items[0].sku', 'x']) {
      expect(formatPath(parsePath(key))).toBe(key)
    }
  })
})

describe('formatPath', () => {
  it('formats a segment array to a canonical key', () => {
    expect(formatPath(['a', 2, 'b'])).toBe('a[2].b')
    expect(formatPath(['email'])).toBe('email')
  })
})

describe('getByPath', () => {
  const obj = { a: { b: [{ c: 1 }, { c: 2 }] }, flat: 'x' }
  it('reads a flat key', () => {
    expect(getByPath(obj, 'flat')).toBe('x')
  })
  it('reads a nested + indexed path', () => {
    expect(getByPath(obj, 'a.b[1].c')).toBe(2)
  })
  it('returns undefined for a missing segment without throwing', () => {
    expect(getByPath(obj, 'a.x.y')).toBeUndefined()
    expect(getByPath(obj, 'a.b[9].c')).toBeUndefined()
  })
})

describe('setByPath', () => {
  it('sets a flat key, returning a new object', () => {
    const o = { a: 1, b: 2 }
    const next = setByPath(o, 'a', 9)
    expect(next).toEqual({ a: 9, b: 2 })
    expect(next).not.toBe(o)
    expect(o.a).toBe(1) // original untouched
  })
  it('sets a nested + indexed value with structural sharing', () => {
    const o = { a: { b: [{ c: 1 }, { c: 2 }] }, sibling: { kept: true } }
    const next = setByPath(o, 'a.b[1].c', 99)
    expect(getByPath(next, 'a.b[1].c')).toBe(99)
    // Only the touched spine is cloned; untouched siblings keep identity.
    expect(next.sibling).toBe(o.sibling)
    expect(next.a.b[0]).toBe(o.a.b[0])
    expect(next.a.b[1]).not.toBe(o.a.b[1])
    expect(next.a.b).not.toBe(o.a.b)
  })
  it('creates intermediate containers (array vs object) from the next segment', () => {
    expect(setByPath({}, 'a.b[0].c', 1)).toEqual({ a: { b: [{ c: 1 }] } })
  })
})

describe('deleteByPath', () => {
  it('deletes a flat key', () => {
    const next = deleteByPath({ a: 1, b: 2 }, 'a')
    expect(next).toEqual({ b: 2 })
  })
  it('splices an array index', () => {
    const next = deleteByPath({ items: ['a', 'b', 'c'] }, 'items[1]')
    expect(next.items).toEqual(['a', 'c'])
  })
  it('is a no-op (same shape) when the target is missing', () => {
    const o = { a: 1 }
    expect(deleteByPath(o, 'b')).toEqual({ a: 1 })
    expect(deleteByPath(o, 'x.y.z')).toBe(o)
  })
})

describe('rekeyByArrayMutation', () => {
  it('shifts keys under an array prefix and drops the removed element', () => {
    // Simulate REMOVE at index 1 of `items`: 0 stays, 1 drops, 2→1.
    const errors = {
      'items[0].sku': 'e0',
      'items[1].sku': 'e1',
      'items[2].sku': 'e2',
      other: 'kept',
    }
    const next = rekeyByArrayMutation(errors, 'items', (i) => (i === 1 ? null : i > 1 ? i - 1 : i))
    expect(next).toEqual({
      'items[0].sku': 'e0',
      'items[1].sku': 'e2',
      other: 'kept',
    })
  })
  it('shifts keys up on INSERT at index 1', () => {
    const errors = { 'items[0].sku': 'e0', 'items[1].sku': 'e1' }
    const next = rekeyByArrayMutation(errors, 'items', (i) => (i >= 1 ? i + 1 : i))
    expect(next).toEqual({ 'items[0].sku': 'e0', 'items[2].sku': 'e1' })
  })
  it('leaves keys that are not under the prefix untouched', () => {
    const errors = { 'itemsX[0].a': 'x', items: 'top', 'items.foo': 'notIndexed' }
    const next = rekeyByArrayMutation(errors, 'items', () => 0)
    expect(next).toEqual(errors)
  })
})
