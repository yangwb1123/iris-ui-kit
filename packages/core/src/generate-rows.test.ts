import { describe, expect, it } from 'vitest'
import { generateRows, type GenerateRowColumn } from './generate-rows'

describe('@iris-ui-kit/core generateRows (batch BK, iris 独有)', () => {
  // ── 类型：每 kind 的值形态 ────────────────────────────────────────────────
  it('generates lowercase a–z strings within length bounds', () => {
    const rows = generateRows([{ key: 'name', kind: 'string', min: 5, max: 5 }], 40)
    for (const row of rows) {
      const v = row.name as string
      expect(v).toMatch(/^[a-z]{5}$/)
    }
  })

  it('generates integer numbers within [min, max]', () => {
    const rows = generateRows([{ key: 'age', kind: 'number', min: 18, max: 65 }], 40)
    for (const row of rows) {
      const v = row.age as number
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(18)
      expect(v).toBeLessThanOrEqual(65)
    }
  })

  it('generates booleans (both values occur)', () => {
    const rows = generateRows([{ key: 'active', kind: 'boolean' }], 40)
    const seen = new Set(rows.map((r) => r.active))
    expect(seen.has(true)).toBe(true)
    expect(seen.has(false)).toBe(true)
    for (const row of rows) expect(typeof row.active).toBe('boolean')
  })

  it('generates YYYY-MM-DD UTC date strings within epoch-ms bounds', () => {
    const rows = generateRows(
      [{ key: 'created', kind: 'date', min: Date.UTC(2022, 0, 1), max: Date.UTC(2022, 0, 31) }],
      40,
    )
    for (const row of rows) {
      const v = row.created as string
      expect(v).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      const ms = Date.parse(`${v}T00:00:00Z`)
      expect(ms).toBeGreaterThanOrEqual(Date.UTC(2022, 0, 1))
      expect(ms).toBeLessThanOrEqual(Date.UTC(2022, 0, 31))
    }
  })

  it('generates local@domain emails (local length bounded, fixed domains)', () => {
    const rows = generateRows([{ key: 'mail', kind: 'email', min: 3, max: 3 }], 40)
    const domains = new Set(['example.com', 'test.io', 'demo.dev', 'mock.org', 'sample.net'])
    for (const row of rows) {
      const v = row.mail as string
      const [local, domain] = v.split('@')
      expect(local).toMatch(/^[a-z]{3}$/)
      expect(domains.has(domain)).toBe(true)
    }
  })

  it('generates digit-only phones, first digit 1–9, bounded digit count', () => {
    const rows = generateRows([{ key: 'tel', kind: 'phone', min: 10, max: 10 }], 40)
    for (const row of rows) {
      const v = row.tel as string
      expect(v).toMatch(/^\d{10}$/)
      expect(v[0]).toMatch(/[1-9]/)
    }
  })

  // ── 范围：bound 语义 ─────────────────────────────────────────────────────
  it('string length respects inclusive min/max across many rows', () => {
    const rows = generateRows([{ key: 's', kind: 'string', min: 2, max: 8 }], 200)
    for (const row of rows) {
      const len = (row.s as string).length
      expect(len).toBeGreaterThanOrEqual(2)
      expect(len).toBeLessThanOrEqual(8)
    }
  })

  it('number respects inclusive min/max across many rows', () => {
    const rows = generateRows([{ key: 'n', kind: 'number', min: -5, max: 5 }], 200)
    for (const row of rows) {
      const v = row.n as number
      expect(v).toBeGreaterThanOrEqual(-5)
      expect(v).toBeLessThanOrEqual(5)
    }
  })

  it('fractional bounds clamp to the enclosing integer range (never out of [min, max])', () => {
    // batch-BK review LOW regression: intBetween with fractional bounds used
    // to emit values outside [min, max] (probe: min 0.5, max 1.5 → 0s and 2s).
    const probe = generateRows([{ key: 'n', kind: 'number', min: 0.5, max: 1.5 }], 200)
    for (const row of probe) {
      expect(Number.isInteger(row.n)).toBe(true)
      expect(row.n).toBeGreaterThanOrEqual(0.5)
      expect(row.n).toBeLessThanOrEqual(1.5)
    }
    // ceil(min)/floor(max): every integer in [1.2, 5.8] is 2..5.
    const wide = generateRows([{ key: 'n', kind: 'number', min: 1.2, max: 5.8 }], 200)
    for (const row of wide) {
      expect(Number.isInteger(row.n)).toBe(true)
      expect(row.n).toBeGreaterThanOrEqual(1.2)
      expect(row.n).toBeLessThanOrEqual(5.8)
    }
    // Fractional length bounds behave the same for strings.
    const str = generateRows([{ key: 's', kind: 'string', min: 2.2, max: 4.9 }], 200)
    for (const row of str) {
      const len = (row.s as string).length
      expect(len).toBeGreaterThanOrEqual(2.2)
      expect(len).toBeLessThanOrEqual(4.9)
    }
  })

  it('bounds with no integer inside pin to floor(max) — never throws, never empty', () => {
    // [1.5, 1.6] contains no integer: graceful pin, value 1, 20 rows.
    const rows = generateRows([{ key: 'n', kind: 'number', min: 1.5, max: 1.6 }], 20)
    expect(rows).toHaveLength(20)
    for (const row of rows) expect(row.n).toBe(1)
  })

  it('date respects min/max boundaries (min equals max → one day)', () => {
    const ms = Date.UTC(2024, 5, 15)
    const rows = generateRows([{ key: 'd', kind: 'date', min: ms, max: ms }], 10)
    for (const row of rows) expect(row.d).toBe('2024-06-15')
  })

  it('email local length stays within min/max', () => {
    const rows = generateRows([{ key: 'e', kind: 'email', min: 1, max: 20 }], 200)
    for (const row of rows) {
      const len = (row.e as string).split('@')[0].length
      expect(len).toBeGreaterThanOrEqual(1)
      expect(len).toBeLessThanOrEqual(20)
    }
  })

  it('phone digit count stays within min/max (min equals max → fixed length)', () => {
    const rows = generateRows([{ key: 'p', kind: 'phone', min: 11, max: 11 }], 10)
    for (const row of rows) expect(row.p).toMatch(/^\d{11}$/)
    const varied = generateRows([{ key: 'p', kind: 'phone', min: 6, max: 9 }], 200)
    for (const row of varied) {
      const len = (row.p as string).length
      expect(len).toBeGreaterThanOrEqual(6)
      expect(len).toBeLessThanOrEqual(9)
    }
  })

  // ── 确定性：种子随机 ─────────────────────────────────────────────────────
  it('same (schema, count, seed) → identical output (byte-stable)', () => {
    const schema: GenerateRowColumn[] = [
      { key: 'id', kind: 'number', min: 1, max: 999 },
      { key: 'name', kind: 'string' },
      { key: 'active', kind: 'boolean' },
      { key: 'created', kind: 'date' },
      { key: 'mail', kind: 'email' },
      { key: 'tel', kind: 'phone' },
    ]
    const a = generateRows(schema, 100, 7)
    const b = generateRows(schema, 100, 7)
    expect(a).toEqual(b)
    expect(a).not.toBe(b) // fresh rows, not the same array
    expect(a[0]).not.toBe(b[0]) // fresh row objects
  })

  it('default seed is stable (no-arg seed → fixed output across calls)', () => {
    const schema = [{ key: 'n', kind: 'number' }]
    expect(generateRows(schema, 5)).toEqual(generateRows(schema, 5))
    expect(generateRows(schema, 5, 42)).toEqual(generateRows(schema, 5))
  })

  it('different seeds → different outputs', () => {
    const schema = [{ key: 'n', kind: 'number' }]
    const a = generateRows(schema, 20, 1)
    const b = generateRows(schema, 20, 2)
    expect(a).not.toEqual(b)
    // Sanity: the difference is real, not a single late draw.
    expect(a.some((r, i) => r.n !== b[i].n)).toBe(true)
  })

  it('seed accepts any number-like value (>>>0 coercion, e.g. 0 and negatives)', () => {
    const schema = [{ key: 'n', kind: 'number' }]
    expect(generateRows(schema, 3, 0)).toEqual(generateRows(schema, 3, 0))
    expect(generateRows(schema, 3, -1)).toEqual(generateRows(schema, 3, -1))
    expect(generateRows(schema, 3, 0)).not.toEqual(generateRows(schema, 3, -1))
  })

  // ── count / schema 边界 ──────────────────────────────────────────────────
  it('count <= 0 → empty array (and never throws)', () => {
    const schema = [{ key: 'n', kind: 'number' }]
    expect(generateRows(schema, 0)).toEqual([])
    expect(generateRows(schema, -3)).toEqual([])
    expect(generateRows(schema, NaN)).toEqual([])
    expect(generateRows(schema, Infinity)).toEqual([])
  })

  it('fractional count is floored', () => {
    const rows = generateRows([{ key: 'n', kind: 'number' }], 4.9)
    expect(rows).toHaveLength(4)
  })

  it('empty schema → empty array', () => {
    expect(generateRows([], 10)).toEqual([])
  })

  it('returns exactly `count` rows', () => {
    const rows = generateRows([{ key: 'n', kind: 'number' }], 17)
    expect(rows).toHaveLength(17)
  })

  it('rows carry exactly the schema keys, in schema order', () => {
    const schema: GenerateRowColumn[] = [
      { key: 'b', kind: 'boolean' },
      { key: 'a', kind: 'string', min: 4, max: 4 },
      { key: 'c', kind: 'number' },
    ]
    const row = generateRows(schema, 1)[0]
    expect(Object.keys(row)).toEqual(['b', 'a', 'c'])
  })

  // ── guard 语义 ───────────────────────────────────────────────────────────
  it('min > max is swapped (never empty range)', () => {
    const rows = generateRows([{ key: 'n', kind: 'number', min: 100, max: 1 }], 50)
    for (const row of rows) {
      const v = row.n as number
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(100)
    }
  })

  it('NaN / non-finite bounds fall back to kind defaults', () => {
    const rows = generateRows(
      [
        { key: 'n', kind: 'number', min: NaN, max: Infinity },
        { key: 's', kind: 'string', min: NaN },
      ],
      20,
    )
    for (const row of rows) {
      expect(row.n).toBeGreaterThanOrEqual(0)
      expect(row.n).toBeLessThanOrEqual(1000)
      expect((row.s as string).length).toBeGreaterThanOrEqual(4)
      expect((row.s as string).length).toBeLessThanOrEqual(12)
    }
  })

  it('unknown runtime kind → key present with null (never throws)', () => {
    const schema = [{ key: 'mystery', kind: 'fancy' as unknown as GenerateRowColumn['kind'] }]
    const rows = generateRows(schema, 3)
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(Object.keys(row)).toEqual(['mystery'])
      expect(row.mystery).toBeNull()
    }
  })

  it('date defaults to UTC 2020-01-01..2025-12-31 range', () => {
    const rows = generateRows([{ key: 'd', kind: 'date' }], 200)
    for (const row of rows) {
      const ms = Date.parse(`${row.d}T00:00:00Z`)
      expect(ms).toBeGreaterThanOrEqual(Date.UTC(2020, 0, 1))
      expect(ms).toBeLessThanOrEqual(Date.UTC(2025, 11, 31))
    }
  })

  it('default number bounds are 0..1000 and string 4..12', () => {
    const rows = generateRows(
      [
        { key: 'n', kind: 'number' },
        { key: 's', kind: 'string' },
      ],
      100,
    )
    for (const row of rows) {
      expect(row.n).toBeGreaterThanOrEqual(0)
      expect(row.n).toBeLessThanOrEqual(1000)
      const len = (row.s as string).length
      expect(len).toBeGreaterThanOrEqual(4)
      expect(len).toBeLessThanOrEqual(12)
    }
  })

  // ── 独立性 ───────────────────────────────────────────────────────────────
  it('columns are independent (no shared PRNG skew across kinds)', () => {
    // All 6 kinds in one schema: each value must satisfy ITS kind contract.
    const schema: GenerateRowColumn[] = [
      { key: 's', kind: 'string', min: 6, max: 6 },
      { key: 'n', kind: 'number', min: 0, max: 0 },
      { key: 'b', kind: 'boolean' },
      { key: 'd', kind: 'date', min: Date.UTC(2021, 0, 1), max: Date.UTC(2021, 0, 1) },
      { key: 'e', kind: 'email', min: 2, max: 2 },
      { key: 'p', kind: 'phone', min: 3, max: 3 },
    ]
    const rows = generateRows(schema, 25)
    for (const row of rows) {
      expect(row.s).toMatch(/^[a-z]{6}$/)
      expect(row.n).toBe(0)
      expect(typeof row.b).toBe('boolean')
      expect(row.d).toBe('2021-01-01')
      expect(row.e).toMatch(/^[a-z]{2}@/)
      expect(row.p).toMatch(/^\d{3}$/)
    }
  })

  it('schema order is part of the input space (row-major draws)', () => {
    const ab: GenerateRowColumn[] = [
      { key: 'a', kind: 'number' },
      { key: 'b', kind: 'string', min: 5, max: 5 },
    ]
    const ba: GenerateRowColumn[] = [
      { key: 'b', kind: 'string', min: 5, max: 5 },
      { key: 'a', kind: 'number' },
    ]
    const rowsAB = generateRows(ab, 4, 99)
    const rowsBA = generateRows(ba, 4, 99)
    // Same columns, same seed — but schema order changes the draw stream.
    expect(rowsAB.map((r) => r.a)).not.toEqual(rowsBA.map((r) => r.a))
    // Row-major corollary: a column's values never depend on rows AFTER it
    // (draws are strictly row×schema sequential), so truncating the count
    // keeps every surviving row byte-identical.
    expect(generateRows(ab, 2, 99)).toEqual(rowsAB.slice(0, 2))
    expect(generateRows(ab, 3, 99)).toEqual(rowsAB.slice(0, 3))
  })

  it('is a pure function — input schema is not mutated', () => {
    const schema: GenerateRowColumn[] = [{ key: 'n', kind: 'number', min: 5, max: 1 }]
    const frozen = Object.freeze(schema)
    generateRows(frozen, 4, 3)
    expect(schema[0].min).toBe(5) // untouched by the min>max swap
    expect(schema[0].max).toBe(1)
  })
})
