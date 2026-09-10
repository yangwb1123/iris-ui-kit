import type { InstalledApp, ProfileData } from './profile'

export const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key)

export const isArray = (value: unknown): value is unknown[] => {
  try {
    return Array.isArray(value)
  } catch {
    return false
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') return false
  try {
    if (Array.isArray(value)) return false
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  } catch {
    return false
  }
}

export const readProperty = (
  value: object,
  key: string,
): { ok: true; value: unknown } | { ok: false; value: undefined } => {
  try {
    if (!hasOwn(value, key)) return { ok: false, value: undefined }
    return { ok: true, value: (value as Record<string, unknown>)[key] }
  } catch {
    return { ok: false, value: undefined }
  }
}

/** Clone profile-owned values without invoking assignment for keys such as `__proto__`. */
export const cloneValue = (value: unknown, seen = new Map<object, unknown>()): unknown => {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value
  if (typeof value === 'function') return value

  try {
    const existing = seen.get(value)
    if (existing !== undefined) return existing
    if (value instanceof Date) return new Date(value.getTime())
    if (value instanceof RegExp) return new RegExp(value.source, value.flags)
    if (value instanceof Map) {
      const copy = new Map<unknown, unknown>()
      seen.set(value, copy)
      for (const [key, entry] of value) copy.set(cloneValue(key, seen), cloneValue(entry, seen))
      return copy
    }
    if (value instanceof Set) {
      const copy = new Set<unknown>()
      seen.set(value, copy)
      for (const entry of value) copy.add(cloneValue(entry, seen))
      return copy
    }
    if (isArray(value)) {
      const copy: unknown[] = []
      seen.set(value, copy)
      for (const entry of value) copy.push(cloneValue(entry, seen))
      return copy
    }

    const copy: Record<string, unknown> = {}
    seen.set(value, copy)
    let keys: string[]
    try {
      keys = Object.keys(value)
    } catch {
      return copy
    }
    const source = value as Record<string, unknown>
    for (const key of keys) {
      try {
        Object.defineProperty(copy, key, {
          value: cloneValue(source[key], seen),
          enumerable: true,
          configurable: true,
          writable: true,
        })
      } catch {
        // A hostile getter/proxy must not make profile state unusable.
      }
    }
    return copy
  } catch {
    // Revoked proxies and hostile built-in wrappers are malformed profile data.
    return undefined
  }
}

export const cloneRecord = (value: unknown): Record<string, unknown> => {
  const copy = cloneValue(value)
  return isRecord(copy) ? copy : {}
}

export const normalizeApp = (value: unknown): InstalledApp | null => {
  if (!isRecord(value)) return null
  const appId = readProperty(value, 'appId')
  const installedAt = readProperty(value, 'installedAt')
  const pinned = readProperty(value, 'pinned')
  const config = readProperty(value, 'config')
  if (
    !appId.ok ||
    typeof appId.value !== 'string' ||
    appId.value.length === 0 ||
    !installedAt.ok ||
    typeof installedAt.value !== 'number' ||
    !Number.isFinite(installedAt.value) ||
    !pinned.ok ||
    typeof pinned.value !== 'boolean'
  ) {
    return null
  }
  return {
    appId: appId.value,
    installedAt: installedAt.value,
    pinned: pinned.value,
    config: config.ok && isRecord(config.value) ? cloneRecord(config.value) : {},
  }
}

export const normalizeInstalled = (value: unknown): InstalledApp[] => {
  if (!isArray(value)) return []
  let length: number
  try {
    length = value.length
  } catch {
    return []
  }
  const installed: InstalledApp[] = []
  for (let index = 0; index < length; index++) {
    let entry: unknown
    try {
      entry = value[index]
    } catch {
      continue
    }
    const app = normalizeApp(entry)
    if (app) installed.push(app)
  }
  return installed
}

export const normalizeProfile = (value: unknown, defaultVersion: number): ProfileData => {
  const source = isRecord(value) ? value : undefined
  const version = source
    ? readProperty(source, 'version')
    : { ok: false as const, value: undefined }
  const installed = source
    ? readProperty(source, 'installed')
    : { ok: false as const, value: undefined }
  const prefs = source ? readProperty(source, 'prefs') : { ok: false as const, value: undefined }
  return {
    version:
      version.ok && typeof version.value === 'number' && Number.isFinite(version.value)
        ? version.value
        : defaultVersion,
    installed: installed.ok ? normalizeInstalled(installed.value) : [],
    prefs: prefs.ok && isRecord(prefs.value) ? cloneRecord(prefs.value) : {},
  }
}
