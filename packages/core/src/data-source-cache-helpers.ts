/** Keep every page query finite, positive, and integer-valued. */
export function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? Math.max(1, Math.trunc(value))
    : fallback
}

/** Return false when JSON.stringify would omit, coerce, or hide a value. */
export function isJsonSafeValue(value: unknown, ancestors: Set<object> = new Set()): boolean {
  if (value === null) return true
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return true
    case 'number':
      return Number.isFinite(value)
    case 'object':
      break
    default:
      return false
  }

  const objectValue = value as object
  if (ancestors.has(objectValue)) return false
  ancestors.add(objectValue)
  try {
    if (Array.isArray(value)) {
      if (Object.getOwnPropertySymbols(value).length > 0) return false
      for (const name of Object.getOwnPropertyNames(value)) {
        if (name === 'length') continue
        const index = Number(name)
        if (!Number.isInteger(index) || index < 0 || index >= 2 ** 32 - 1 || String(index) !== name)
          return false
        const descriptor = Object.getOwnPropertyDescriptor(value, name)
        if (!descriptor || !('value' in descriptor)) return false
        if (!isJsonSafeValue(descriptor.value, ancestors)) return false
      }
      for (let index = 0; index < value.length; index++) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) return false
      }
      return true
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) return false
    if (Object.getOwnPropertySymbols(value).length > 0) return false
    for (const name of Object.getOwnPropertyNames(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, name)
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return false
      if (!isJsonSafeValue(descriptor.value, ancestors)) return false
    }
    return true
  } finally {
    ancestors.delete(objectValue)
  }
}

/** Serialize safe JSON values with deterministic object-key ordering. */
export function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) as string
  if (Array.isArray(value)) return `[${value.map(canonicalJsonStringify).join(',')}]`

  const objectValue = value as Record<string, unknown>
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJsonStringify(objectValue[key])}`)
    .join(',')}}`
}

/** Empty string is an inactive filter in filterSort and remote-table. */
export function activeCacheFilters(filters: Record<string, string>): Record<string, string> {
  const active: Record<string, string> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value !== '') active[key] = value
  }
  return active
}
