import { describe, expect, it } from 'vitest'
import { detectColumnType } from './column-type'

describe('detectColumnType', () => {
  it('all-number samples → number', () => {
    expect(detectColumnType([1, 2, 3])).toBe('number')
    expect(detectColumnType([0, -1.5, 42])).toBe('number')
  })

  it('all-string samples → string', () => {
    expect(detectColumnType(['a', 'b', 'c'])).toBe('string')
    expect(detectColumnType(['Alice', '', 'Bob'])).toBe('string')
  })

  it('Date instances and ISO-8601 date strings → date', () => {
    expect(detectColumnType([new Date('2024-01-15'), new Date('2024-06-01')])).toBe('date')
    expect(detectColumnType([new Date(0)])).toBe('date')
    expect(detectColumnType(['2024-01-15', '2024-06-01'])).toBe('date')
    expect(detectColumnType(['2024-01-15T10:30:00Z'])).toBe('date')
    expect(detectColumnType(['2024-01-15T10:30:00.000Z', '2024-06-01T08:00:00+08:00'])).toBe('date')
  })

  it('booleans → boolean', () => {
    expect(detectColumnType([true, false, true])).toBe('boolean')
  })

  it('mixed samples → string fail-safe', () => {
    expect(detectColumnType([1, 'two'])).toBe('string')
    expect(detectColumnType([1, true])).toBe('string')
    expect(detectColumnType(['a', new Date(0)])).toBe('string')
    expect(detectColumnType([{}, 'x'])).toBe('string')
  })

  it('numeric strings stay string (no coercion)', () => {
    expect(detectColumnType(['123', '456'])).toBe('string')
    expect(detectColumnType(['1.5', '2'])).toBe('string')
  })

  it('boolean strings stay string', () => {
    expect(detectColumnType(['true', 'false'])).toBe('string')
    expect(detectColumnType(['yes', 'no'])).toBe('string')
  })

  it('non-finite numbers still vote number (typeof parity)', () => {
    expect(detectColumnType([NaN, 1])).toBe('number')
    expect(detectColumnType([Infinity, 2])).toBe('number')
    expect(detectColumnType([NaN])).toBe('number')
  })

  it('nullish values never vote; empty input → string', () => {
    expect(detectColumnType([null, undefined, 1, null])).toBe('number')
    expect(detectColumnType([1, null, 2])).toBe('number')
    expect(detectColumnType([])).toBe('string')
    expect(detectColumnType([null, undefined])).toBe('string')
  })

  it('samples only the first 50 non-nullish values (a 51st dissenter does not flip)', () => {
    const numbers = Array.from({ length: 50 }, (_, i) => i)
    expect(detectColumnType([...numbers, 'oops'])).toBe('number')
    // A dissenter WITHIN the first 50 still flips to the fail-safe.
    expect(detectColumnType([...numbers.slice(0, 49), 'oops', 100])).toBe('string')
    // Nullish cells before the 50 samples do not consume the cap.
    const withNulls = Array.from({ length: 50 }, (_, i) => i)
    expect(detectColumnType([null, ...withNulls, 'oops'])).toBe('number')
  })
})
