import { describe, it, expect } from 'vitest'
import { createSkinCatalog } from './catalog'
import type { SkinManifest, Skin } from './types'

const manifest: SkinManifest = {
  schema: 1,
  skins: [
    { id: 'ocean', name: 'Ocean', url: 'ocean.json', meta: { tags: ['blue'] } },
    { id: 'sunset', name: 'Sunset', url: 'https://cdn/sunset.json' },
  ],
}
const ocean: Skin = { id: 'ocean', extends: 'dark', tokens: { 'iris.primary': '#06f' } }

function router(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('manifest.json')) {
      return { ok: true, status: 200, json: async () => manifest } as Response
    }
    if (url.endsWith('ocean.json')) {
      return { ok: true, status: 200, json: async () => ocean } as Response
    }
    return { ok: false, status: 404, json: async () => null } as Response
  }) as unknown as typeof fetch
}

describe('createSkinCatalog', () => {
  it('loads + lists + searches the manifest', async () => {
    const cat = createSkinCatalog({ manifestUrl: 'https://cdn/manifest.json', fetch: router() })
    await cat.load()
    expect(cat.list().map((e) => e.id)).toEqual(['ocean', 'sunset'])
    expect(cat.search('blue').map((e) => e.id)).toEqual(['ocean'])
    expect(cat.get('sunset')?.name).toBe('Sunset')
  })

  it('lazy-fetches a skin by id (resolving relative url) and caches it', async () => {
    const cat = createSkinCatalog({ manifestUrl: 'https://cdn/manifest.json', fetch: router() })
    const skin = await cat.fetchSkin('ocean')
    expect(skin.tokens?.['iris.primary']).toBe('#06f')
    expect(await cat.fetchSkin('ocean')).toBe(skin) // cached identity
  })

  it('rejects fetchSkin for an unknown id', async () => {
    const cat = createSkinCatalog({ manifestUrl: 'https://cdn/manifest.json', fetch: router() })
    await expect(cat.fetchSkin('ghost')).rejects.toBeTruthy()
  })
})
