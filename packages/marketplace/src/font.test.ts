import { describe, expect, it, vi } from 'vitest'
import { installFont, memoryFontAssetCache, validateFontResource } from './font'
import type { IrisFontResource } from './types'

const resource: IrisFontResource = {
  schema: 'iris-ui/font@1',
  family: 'Iris Sans',
  sources: [{ url: 'https://example.test/iris.woff2', format: 'woff2' }],
}

describe('font resources', () => {
  it('validates family and URL input', () => {
    expect(validateFontResource(resource)).toEqual([])
    expect(validateFontResource({ ...resource, family: 'bad;url(x)' })).not.toEqual([])
  })

  it('loads through the cache and returns a reversible installation', async () => {
    class FakeFontFace {
      constructor(
        public family: string,
        public source: string | ArrayBuffer,
      ) {}
      async load(): Promise<FakeFontFace> {
        return this
      }
    }
    const add = vi.fn()
    const remove = vi.fn(() => true)
    const setProperty = vi.fn()
    const removeProperty = vi.fn()
    const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])))
    const config = {
      fetch: fetcher,
      cache: memoryFontAssetCache(),
      fonts: { add, delete: remove },
      target: {
        style: { getPropertyValue: () => '', setProperty, removeProperty } as CSSStyleDeclaration,
      },
      FontFace: FakeFontFace as unknown as typeof FontFace,
    }
    const first = await installFont(resource, config)
    expect(first.fromCache).toBe(0)
    const second = await installFont(resource, config)
    expect(second.fromCache).toBe(1)
    expect(fetcher).toHaveBeenCalledTimes(1)
    second.revert()
    expect(remove).toHaveBeenCalled()
    expect(removeProperty).toHaveBeenCalledWith('--iris-font-family')
  })

  it('verifies integrity before caching and cleans up partial installs', async () => {
    const put = vi.fn()
    class FakeFontFace {
      static count = 0
      constructor() {
        FakeFontFace.count += 1
      }
      async load(): Promise<FakeFontFace> {
        if (FakeFontFace.count === 2) throw new Error('invalid font')
        return this
      }
    }
    const fonts = { add: vi.fn(), delete: vi.fn(() => true) }
    const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])))
    await expect(
      installFont(
        {
          ...resource,
          sources: [
            {
              ...resource.sources[0]!,
              integrity: `sha256-${'0'.repeat(64)}`,
            },
          ],
        },
        {
          fetch: fetcher,
          cache: { get: async () => undefined, put },
          fonts,
          FontFace: FakeFontFace as unknown as typeof FontFace,
        },
      ),
    ).rejects.toThrow('Integrity check failed')
    expect(put).not.toHaveBeenCalled()

    FakeFontFace.count = 0
    await expect(
      installFont(
        {
          ...resource,
          sources: [
            resource.sources[0]!,
            { url: 'https://example.test/broken.woff2', format: 'woff2' },
          ],
        },
        {
          fetch: fetcher,
          cache: memoryFontAssetCache(),
          fonts,
          FontFace: FakeFontFace as unknown as typeof FontFace,
        },
      ),
    ).rejects.toThrow('invalid font')
    expect(fonts.delete).toHaveBeenCalledOnce()
  })
})
