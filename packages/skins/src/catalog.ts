import type { Skin, SkinManifest, SkinManifestEntry } from './types'
import { loadSkin } from './loadSkin'
import { skinError, SkinResolutionError } from './errors'

export interface SkinCatalogConfig {
  manifestUrl: string
  fetch?: typeof fetch
}

export interface SkinCatalog {
  load(): Promise<SkinManifestEntry[]>
  list(): SkinManifestEntry[]
  search(query: string): SkinManifestEntry[]
  get(id: string): SkinManifestEntry | undefined
  fetchSkin(id: string): Promise<Skin>
}

/** Client half of the marketplace: fetch a manifest, list/search entries, lazy-fetch skins. */
export function createSkinCatalog(config: SkinCatalogConfig): SkinCatalog {
  const f = config.fetch ?? (typeof fetch !== 'undefined' ? fetch : undefined)
  let entries: SkinManifestEntry[] = []
  let loaded = false
  const cache = new Map<string, Skin>()

  function resolveUrl(url: string): string {
    try {
      return new URL(url, config.manifestUrl).toString()
    } catch {
      return url
    }
  }

  const catalog: SkinCatalog = {
    async load() {
      if (!f) throw new SkinResolutionError(skinError('catalog', 'no fetch available for catalog'))
      const res = await f(config.manifestUrl)
      if (!res.ok) {
        throw new SkinResolutionError(
          skinError('catalog', `failed to fetch manifest: ${res.status}`),
        )
      }
      const manifest = (await res.json()) as SkinManifest
      if (!manifest || manifest.schema !== 1 || !Array.isArray(manifest.skins)) {
        throw new SkinResolutionError(skinError('catalog', 'invalid skin manifest'))
      }
      entries = manifest.skins
      loaded = true
      return entries
    },
    list: () => entries,
    search(query) {
      const q = query.toLowerCase()
      return entries.filter((e) => {
        const meta = e.meta as { tags?: unknown } | undefined
        const tags = Array.isArray(meta?.tags) ? (meta.tags as string[]).join(' ') : ''
        return (
          e.id.toLowerCase().includes(q) ||
          (e.name ?? '').toLowerCase().includes(q) ||
          tags.toLowerCase().includes(q)
        )
      })
    },
    get: (id) => entries.find((e) => e.id === id),
    async fetchSkin(id) {
      const hit = cache.get(id)
      if (hit) return hit
      if (!loaded) await catalog.load()
      const entry = entries.find((e) => e.id === id)
      if (!entry) {
        throw new SkinResolutionError(skinError('catalog', `skin "${id}" not in catalog`, { id }))
      }
      const skin = await loadSkin(resolveUrl(entry.url), { fetch: f })
      cache.set(id, skin)
      return skin
    },
  }
  return catalog
}
