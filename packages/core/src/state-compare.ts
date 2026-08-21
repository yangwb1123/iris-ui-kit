/**
 * Field-level diff for exported table-state JSON strings.
 *
 * The first argument is the state before the change and the second is the
 * state after it. Object keys are compared structurally (key order does not
 * matter), arrays are compared by index, and output paths are deterministic.
 * Invalid JSON is deliberately reported as data instead of throwing so the
 * imperative table handle remains safe to call from diagnostics tooling.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => deepEqual(value, b[index]))
  }
  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a)
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]))
    )
  }
  return false
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value)
  if (value === undefined) return 'undefined'
  return JSON.stringify(value)
}

function collectDiff(path: string, before: unknown, after: unknown, output: string[]): void {
  if (deepEqual(before, after)) return
  if (isRecord(before) && isRecord(after)) {
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort()
    for (const key of keys) {
      const nextPath = path ? `${path}.${key}` : key
      const inBefore = Object.prototype.hasOwnProperty.call(before, key)
      const inAfter = Object.prototype.hasOwnProperty.call(after, key)
      if (inBefore && inAfter) collectDiff(nextPath, before[key], after[key], output)
      else if (inBefore) output.push(`- ${nextPath}: ${formatValue(before[key])}`)
      else output.push(`+ ${nextPath}: ${formatValue(after[key])}`)
    }
    return
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length)
    for (let index = 0; index < length; index += 1) {
      const nextPath = `${path}[${index}]`
      if (index < before.length && index < after.length) {
        collectDiff(nextPath, before[index], after[index], output)
      } else if (index < before.length) {
        output.push(`- ${nextPath}: ${formatValue(before[index])}`)
      } else {
        output.push(`+ ${nextPath}: ${formatValue(after[index])}`)
      }
    }
    return
  }
  output.push(`~ ${path}: ${formatValue(before)} → ${formatValue(after)}`)
}

/** Compare two state JSON strings without throwing. */
export function compareStates(a: string, b: string): string {
  let before: unknown
  let after: unknown
  try {
    before = JSON.parse(a)
    after = JSON.parse(b)
  } catch {
    return '! compareStates: invalid JSON'
  }
  const output: string[] = []
  collectDiff('', before, after, output)
  return output.join('\n')
}
