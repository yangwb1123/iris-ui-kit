/**
 * `generateRows` — deterministic mock-data generation (batch BK, iris 独有 —
 * vxe has no data-generation concept at all; its examples hand-write fixtures).
 *
 * Generates `count` rows from a column schema. The PRNG is a module-local
 * `mulberry32` seeded from `seed >>> 0` (default **42**): the spec's 2-arg
 * form is primary, the optional seed gives variation on demand. Every call
 * instantiates its own generator, so the same `(schema, count, seed)` triple
 * is byte-stable across calls and processes — no `Math.random`, no
 * `Date.now`, no timezone (dates are UTC `YYYY-MM-DD` strings). Draws happen
 * in fixed row-major order (row × schema order).
 *
 * Per-kind semantics (`min`/`max` are kind-relative, normalized by swapping
 * when `min > max`; `NaN` bounds fall back to the kind default):
 *   - `string`  — lowercase a–z, length in [min, max], default 4..12
 *   - `number`  — integer in [min, max], default 0..1000
 *   - `boolean` — 50/50; min/max ignored
 *   - `date`    — UTC `YYYY-MM-DD`, min/max are epoch **ms**, default
 *                 2020-01-01T00:00:00Z .. 2025-12-31T00:00:00Z
 *   - `email`   — `local@domain`; min/max bound the local-part length
 *                 (default 4..12), domain from a fixed fake-domain list
 *   - `phone`   — digits only, first digit 1–9, digit count in [min, max]
 *                 (default 7..11)
 *
 * Guards (never throws — formula.ts precedent): `count <= 0` (or
 * non-finite) → `[]`; fractional `count` floored; empty schema → `[]`;
 * a runtime-unknown `kind` still emits the key with value `null`. Rows are
 * fresh objects with schema-order keys. Pure function of its inputs — no
 * side effects, no framework imports — so any adapter can bridge it.
 */

/** Column kinds `generateRows` understands. */
export type GenerateRowsKind = 'string' | 'number' | 'boolean' | 'date' | 'email' | 'phone'

/** One generated column. `min`/`max` are kind-relative (see module doc). */
export interface GenerateRowColumn {
  /** Object key of the generated value (schema order is row key order). */
  key: string
  /** Value kind — drives the generation algorithm and default bounds. */
  kind: GenerateRowsKind
  /** Lower bound (length / value / epoch ms / digit count, per kind). */
  min?: number
  /** Upper bound (length / value / epoch ms / digit count, per kind). */
  max?: number
}

/** Default bounds per kind, applied when min/max are absent or NaN. */
const DEFAULTS: Record<Exclude<GenerateRowsKind, 'boolean'>, [number, number]> = {
  string: [4, 12],
  number: [0, 1000],
  date: [Date.UTC(2020, 0, 1), Date.UTC(2025, 11, 31)],
  email: [4, 12],
  phone: [7, 11],
}

/** Fixed fake domains for `email` — stable across calls (no external list). */
const FAKE_DOMAINS = ['example.com', 'test.io', 'demo.dev', 'mock.org', 'sample.net']

/** Lowercase a–z alphabet for `string` / email local parts. */
const ALPHA = 'abcdefghijklmnopqrstuvwxyz'

/**
 * Module-local mulberry32 PRNG — a small, seedable, byte-stable 32-bit
 * generator (mulberry32 is a well-known public-domain algorithm). Each
 * `generateRows` call creates its own instance, so outputs are a pure
 * function of `(schema, count, seed)`.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** `[min, max]` for one column — NaN → default; min > max swapped. */
function boundsOf(
  col: GenerateRowColumn,
  kind: Exclude<GenerateRowsKind, 'boolean'>,
): [number, number] {
  const [dMin, dMax] = DEFAULTS[kind]
  const min = typeof col.min === 'number' && Number.isFinite(col.min) ? col.min : dMin
  const max = typeof col.max === 'number' && Number.isFinite(col.max) ? col.max : dMax
  return min <= max ? [min, max] : [max, min]
}

/** Uniform integer in [min, max] (inclusive), floored — `next` in [0, 1). */
function intBetween(next: () => number, min: number, max: number): number {
  return Math.floor(min + next() * (max - min + 1))
}

/** `YYYY-MM-DD` UTC string for an epoch-ms instant (no timezone drift). */
function formatUtcDate(ms: number): string {
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Random lowercase string of `length` chars. */
function randomAlpha(next: () => number, length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHA[intBetween(next, 0, ALPHA.length - 1)]
  return out
}

/** Random digit string of `length` chars — first digit forced 1–9. */
function randomDigits(next: () => number, length: number): string {
  let out = String(intBetween(next, 1, 9))
  for (let i = 1; i < length; i++) out += String(intBetween(next, 0, 9))
  return out
}

/** Generate one column value for one row (unknown kind → null). */
function generateValue(next: () => number, col: GenerateRowColumn): unknown {
  switch (col.kind) {
    case 'string': {
      const [min, max] = boundsOf(col, 'string')
      return randomAlpha(next, intBetween(next, min, max))
    }
    case 'number': {
      const [min, max] = boundsOf(col, 'number')
      return intBetween(next, min, max)
    }
    case 'boolean':
      return next() < 0.5
    case 'date': {
      const [min, max] = boundsOf(col, 'date')
      return formatUtcDate(intBetween(next, min, max))
    }
    case 'email': {
      const [min, max] = boundsOf(col, 'email')
      const local = randomAlpha(next, intBetween(next, min, max))
      const domain = FAKE_DOMAINS[intBetween(next, 0, FAKE_DOMAINS.length - 1)]
      return `${local}@${domain}`
    }
    case 'phone': {
      const [min, max] = boundsOf(col, 'phone')
      return randomDigits(next, intBetween(next, min, max))
    }
    default:
      // Runtime-unknown kind (e.g. a schema hand-built without the type):
      // keep the key, never throw — formula.ts fail-inert precedent.
      return null
  }
}

/**
 * Deterministically generate `count` mock rows from `schema` (see module
 * doc for per-kind semantics and guards). Same `(schema, count, seed)`
 * triple → identical output, always.
 */
export function generateRows(
  schema: readonly GenerateRowColumn[],
  count: number,
  seed = 42,
): Array<Record<string, unknown>> {
  if (schema.length === 0) return []
  if (!Number.isFinite(count) || count <= 0) return []
  const n = Math.floor(count)
  const next = mulberry32(seed)
  const rows: Array<Record<string, unknown>> = []
  for (let r = 0; r < n; r++) {
    const row: Record<string, unknown> = {}
    for (const col of schema) row[col.key] = generateValue(next, col)
    rows.push(row)
  }
  return rows
}
