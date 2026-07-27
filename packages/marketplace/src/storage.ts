import type { InstalledRuntimeResource, RuntimeMarketplaceStorage } from './types'

export function memoryMarketplaceStorage(
  initial: InstalledRuntimeResource[] = [],
): RuntimeMarketplaceStorage {
  let resources = [...initial]
  return {
    load: () => [...resources],
    save: (next) => {
      resources = [...next]
    },
  }
}

interface WebStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function localStorageMarketplaceStorage(
  key = 'iris-marketplace-resources',
): RuntimeMarketplaceStorage {
  const storage = (): WebStorageLike | undefined =>
    (globalThis as { localStorage?: WebStorageLike }).localStorage
  return {
    load() {
      try {
        const raw = storage()?.getItem(key)
        return raw ? (JSON.parse(raw) as InstalledRuntimeResource[]) : []
      } catch {
        return []
      }
    },
    save(resources) {
      try {
        storage()?.setItem(key, JSON.stringify(resources))
      } catch {
        // Runtime resources remain active in memory when persistence is unavailable.
      }
    },
  }
}
