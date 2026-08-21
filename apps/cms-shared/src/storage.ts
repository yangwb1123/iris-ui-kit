/** Minimal storage boundary shared by the CMS services. */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

/** Resolve browser storage without making the shared package browser-only. */
export function browserStorage(): KeyValueStorage | undefined {
  try {
    return (globalThis as { localStorage?: KeyValueStorage }).localStorage
  } catch {
    return undefined
  }
}
