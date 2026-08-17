/**
 * Field-level diff of two exported-state JSON strings (batch DE, iris 独有).
 *
 * Pure framework-free helper powering `IrisTableHandle.compareStates` — the
 * same standalone-stdlib precedent as `exportCsv`. Orientation is
 * `a` = before, `b` = after; output line per differing field:
 *
 *   `+ path: value`   added in `b`
 *   `- path: value`   removed from `b` (present in `a`)
 *   `~ path: old → new`  changed scalar leaf (`old` from `a`, `new` from `b`)
 *
 * Structural deep-equal makes the result order-independent; iteration is by
 * SORTED keys so multi-block output is deterministic. Nested objects descend
 * dot-paths (`sort.direction`), arrays compare elementwise by index
 * (`columnOrder[0]`), and record maps report per key (`columnWidths.name`).
 * Identical inputs → `''`; either input is invalid JSON → the literal
 * `! compareStates: invalid JSON` (never throws).
 */

/** Structural deep-equality — order-independent (keys compared as sets), arrays elementwise. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((v, i) => deepEqual(v, b[i]))
  }
  if (isRecord(a) && isRecord(b)) {
    const ak = Object.keys(a)
    const bk = Object.keys(b)
    if (ak.length !== bk.length) return false
    return ak.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]))
  }
  return false
}

/** True for a plain object (not null, not an array). */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Stable leaf rendering: strings JSON-quoted (with their quotes), everything else via JSON. */
function formatValue(v: unknown): string {
  if (typeof v === 'string') return JSON.stringify(v)
  if (v === undefined) return 'undefined'
  return JSON.stringify(v)
}

/** Recursively emit `+`/`-`/`~` diff lines for the sub-tree at `path`. */
function collectDiff(path: string, a: unknown, b: unknown, out: string[]): void {
  if (deepEqual(a, b)) return
  if (isRecord(a) && isRecord(b)) {
    const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort()
    for (const k of keys) {
      const p = path ? `${path}.${k}` : k
      const hasA = Object.prototype.hasOwnProperty.call(a, k)
      const hasB = Object.prototype.hasOwnProperty.call(b, k)
      if (hasA && hasB) collectDiff(p, a[k], b[k], out)
      else if (hasA) out.push(`- ${p}: ${formatValue(a[k])}`)
      else out.push(`+ ${p}: ${formatValue(b[k])}`)
    }
    return
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const len = Math.max(a.length, b.length)
    for (let i = 0; i < len; i++) {
      const p = `${path}[${i}]`
      if (i < a.length && i < b.length) collectDiff(p, a[i], b[i], out)
      else if (i < a.length) out.push(`- ${p}: ${formatValue(a[i])}`)
      else out.push(`+ ${p}: ${formatValue(b[i])}`)
    }
    return
  }
  out.push(`~ ${path}: ${formatValue(a)} → ${formatValue(b)}`)
}

/**
 * Compare two state JSON strings and return a field-level diff text.
 * Order-independent (sorted keys); `a` = before, `b` = after. Never throws:
 * invalid JSON → `! compareStates: invalid JSON`, identical → `''`.
 */
export function compareStates(a: string, b: string): string {
  let A: unknown
  let B: unknown
  try {
    A = JSON.parse(a)
  } catch {
    return '! compareStates: invalid JSON'
  }
  try {
    B = JSON.parse(b)
  } catch {
    return '! compareStates: invalid JSON'
  }
  const out: string[] = []
  collectDiff('', A, B, out)
  return out.join('\n')
}
