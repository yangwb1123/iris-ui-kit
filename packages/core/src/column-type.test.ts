import { describe, expect, it } from 'vitest'
import { applyDetectedColumnDefaults, detectColumnType } from './column-type'

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

  it('applies alignment defaults recursively and preserves explicit values', () => {
    const columns = [
      {
        key: 'group',
        align: 'center' as const,
        children: [{ key: 'age' }, { key: 'name', align: 'right' as const }],
      },
    ]
    const projected = applyDetectedColumnDefaults(columns, {
      group: 'string',
      age: 'number',
      name: 'string',
    })

    expect(projected[0]).not.toBe(columns[0])
    expect(projected[0]?.align).toBe('center')
    expect(projected[0]?.children?.[0]?.align).toBe('right')
    expect(projected[0]?.children?.[1]).toStrictEqual(columns[0]?.children?.[1])
  })

  it('optionally fills sortType while preserving explicit sortType', () => {
    const columns = [{ key: 'age' }, { key: 'name', sortType: 'auto' as const }]
    const projected = applyDetectedColumnDefaults(
      columns,
      { age: 'number', name: 'string' },
      { fillSortType: true },
    )

    expect(projected.map((column) => column.sortType)).toEqual(['number', 'auto'])
  })

  it('keeps identity for columns without a detected entry', () => {
    const columns = [{ key: 'age', align: 'right' as const }]
    expect(applyDetectedColumnDefaults(columns, {})).toBe(columns)
    expect(applyDetectedColumnDefaults(columns, { age: 'number' })[0]).not.toBe(columns[0])
  })

  it('uses own detected entries only and terminates on cyclic/malformed trees', () => {
    const cyclic = { key: 'cycle' } as {
      key: string
      children?: (typeof cyclic)[]
      align?: 'left' | 'center' | 'right'
    }
    cyclic.children = [cyclic]
    const malformed = { key: 'malformed', children: {} as (typeof cyclic)[] }
    const detected = Object.create({ cycle: 'number' }) as Record<string, 'number'>
    detected.malformed = 'number'

    const projected = applyDetectedColumnDefaults([cyclic, malformed], detected)
    expect(projected[0]).not.toBe(cyclic)
    expect(projected[0]?.align).toBeUndefined()
    expect(projected[1]?.align).toBe('right')
    expect(cyclic.align).toBeUndefined()
  })

  it('does not mutate caller-owned children while projecting recursive defaults', () => {
    const child = { key: 'age' }
    const columns = [{ key: 'group', children: [child] }]
    const projected = applyDetectedColumnDefaults(columns, { age: 'number' })

    expect(projected[0]?.children).not.toBe(columns[0]?.children)
    expect(projected[0]?.children?.[0]).not.toBe(child)
    expect(child).toEqual({ key: 'age' })
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
