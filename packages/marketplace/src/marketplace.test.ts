import { describe, expect, it, vi } from 'vitest'
import { createRuntimeMarketplace } from './marketplace'
import { memoryMarketplaceStorage } from './storage'

const viewPayload = {
  name: 'dense-orders',
  type: 'iris:view' as const,
  version: '1.0.0',
  data: {
    schema: 'iris-ui/view-preset@1',
    id: 'dense-orders',
    version: '1.0.0',
    density: 'compact',
    pageSize: 50,
  },
}

describe('runtime marketplace', () => {
  it('loads, searches, installs, persists and uninstalls declarative resources', async () => {
    const storage = memoryMarketplaceStorage()
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('manifest.json')) {
        return new Response(
          JSON.stringify({
            schema: 'iris-ui/marketplace@1',
            name: 'test',
            resources: [
              {
                name: 'dense-orders',
                type: 'iris:view',
                version: '1.0.0',
                url: './dense-orders.json',
                tags: ['table'],
              },
            ],
          }),
        )
      }
      return new Response(JSON.stringify(viewPayload))
    })
    const marketplace = createRuntimeMarketplace({
      manifestUrl: 'https://example.test/manifest.json',
      fetch: fetcher,
      storage,
    })
    await marketplace.loadCatalog()
    expect(marketplace.search('table')).toHaveLength(1)
    await marketplace.install('dense-orders')
    expect(marketplace.get('dense-orders')?.payload.data).toEqual(viewPayload.data)
    expect(await marketplace.uninstall('dense-orders')).toBe(true)
    expect(marketplace.get('dense-orders')).toBeUndefined()
  })

  it('rejects executable template payloads', async () => {
    const marketplace = createRuntimeMarketplace({
      manifestUrl: 'https://example.test/manifest.json',
      fetch: vi.fn(),
    })
    await expect(
      marketplace.installPayload({
        name: 'remote-shell',
        type: 'iris:template',
        version: '1.0.0',
        data: 'code',
      } as never),
    ).rejects.toThrow('Invalid runtime registry payload')
  })

  it('runs installer teardown on replacement and uninstall', async () => {
    const teardown = vi.fn()
    const installer = vi.fn(() => teardown)
    const marketplace = createRuntimeMarketplace({
      manifestUrl: 'https://example.test/manifest.json',
      installers: { 'iris:view': installer },
    })
    await marketplace.installPayload(viewPayload)
    await marketplace.installPayload({ ...viewPayload, version: '1.1.0' })
    expect(teardown).toHaveBeenCalledTimes(1)
    await marketplace.uninstall('dense-orders')
    expect(teardown).toHaveBeenCalledTimes(2)
  })

  it('restores the previous installation when replacement fails', async () => {
    const previousTeardown = vi.fn()
    const restoredTeardown = vi.fn()
    const installer = vi
      .fn()
      .mockReturnValueOnce(previousTeardown)
      .mockRejectedValueOnce(new Error('install failed'))
      .mockReturnValueOnce(restoredTeardown)
    const marketplace = createRuntimeMarketplace({
      manifestUrl: 'https://example.test/manifest.json',
      installers: { 'iris:view': installer },
    })
    await marketplace.installPayload(viewPayload)
    await expect(marketplace.installPayload({ ...viewPayload, version: '2.0.0' })).rejects.toThrow(
      'install failed',
    )
    expect(previousTeardown).toHaveBeenCalledOnce()
    expect(marketplace.get('dense-orders')?.version).toBe('1.0.0')
    await marketplace.uninstall('dense-orders')
    expect(restoredTeardown).toHaveBeenCalledOnce()
  })

  it('rejects catalog version mismatches and malformed skins', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      if (String(input).endsWith('manifest.json')) {
        return new Response(
          JSON.stringify({
            schema: 'iris-ui/marketplace@1',
            name: 'test',
            resources: [
              {
                name: 'dense-orders',
                type: 'iris:view',
                version: '2.0.0',
                url: './dense-orders.json',
              },
            ],
          }),
        )
      }
      return new Response(JSON.stringify(viewPayload))
    })
    const marketplace = createRuntimeMarketplace({
      manifestUrl: 'https://example.test/manifest.json',
      fetch: fetcher,
    })
    await expect(marketplace.install('dense-orders')).rejects.toThrow('identity mismatch')
    await expect(
      marketplace.installPayload({
        name: 'broken',
        type: 'iris:skin',
        version: '1.0.0',
        data: { id: '' },
      }),
    ).rejects.toThrow('Invalid skin resource')
  })
})
