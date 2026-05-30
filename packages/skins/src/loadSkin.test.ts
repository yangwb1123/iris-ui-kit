import { describe, it, expect } from 'vitest'
import { loadSkin } from './loadSkin'
import { SkinResolutionError } from './errors'
import type { Skin } from './types'

const valid: Skin = { id: 'remote', extends: 'dark', tokens: { 'iris.primary': '#123456' } }

function fetchOf(body: unknown, ok = true, status = 200): typeof fetch {
  return (async () =>
    ({ ok, status, json: async () => body }) as Response) as unknown as typeof fetch
}

describe('loadSkin', () => {
  it('returns an inline skin object after validation', async () => {
    expect(await loadSkin(valid)).toEqual(valid)
  })

  it('fetches + validates a URL source', async () => {
    expect(await loadSkin('https://x/skin.json', { fetch: fetchOf(valid) })).toEqual(valid)
  })

  it('rejects an invalid skin', async () => {
    await expect(loadSkin({ id: '' } as Skin)).rejects.toBeInstanceOf(SkinResolutionError)
  })

  it('rejects on non-ok response', async () => {
    await expect(
      loadSkin('https://x/skin.json', { fetch: fetchOf(null, false, 404) }),
    ).rejects.toBeInstanceOf(SkinResolutionError)
  })
})
