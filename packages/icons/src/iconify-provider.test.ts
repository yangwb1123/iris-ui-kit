import { describe, expect, it, vi } from 'vitest'
import {
  createIconRegistry,
  createIconifyProvider,
  renderIconSvg,
  type IconifyFetch,
  type IconifyFetchResponse,
} from './index'

function iconifyResponse(prefix: string, icons: Record<string, unknown>): IconifyFetchResponse {
  return {
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify({ prefix, icons })
    },
  }
}

function fetchWith(response: IconifyFetchResponse): IconifyFetch {
  return async () => response
}

describe('@iris-ui-kit/icons Iconify provider', () => {
  it('loads qualified icon names as structured Iris nodes with safe viewBoxes', async () => {
    const fetch = vi.fn(
      fetchWith(
        iconifyResponse('mdi', {
          home: {
            width: 20,
            height: 16,
            body: '<path fill="currentColor" fill-opacity="0.5" d="M0 0L10 10z"/><circle cx="8" cy="8" r="2"/>',
          },
        }),
      ),
    )
    const provider = createIconifyProvider({ fetch })
    const set = await provider.loadIcons(['mdi:home'])

    expect(fetch).toHaveBeenCalledOnce()
    expect(new URL(fetch.mock.calls[0]![0]).searchParams.get('icons')).toBe('home')
    expect(set.name).toBe('iconify')
    expect(set.icons['mdi:home']).toEqual({
      name: 'mdi:home',
      viewBox: '0 0 20 16',
      nodes: [
        {
          tag: 'path',
          attrs: { fill: 'currentColor', 'fill-opacity': '0.5', d: 'M0 0L10 10z' },
        },
        { tag: 'circle', attrs: { cx: '8', cy: '8', r: '2' } },
      ],
    })
    expect(await provider.loadIcon('mdi:home')).toEqual(set.icons['mdi:home'])
    const registry = createIconRegistry({ sets: [set] })
    expect(registry.resolve('mdi:home')).toEqual(set.icons['mdi:home'])
    expect(renderIconSvg(set.icons['mdi:home']!)).toContain('fill-opacity="0.5"')
  })

  it('groups prefixes into separate requests and deduplicates requested names', async () => {
    const fetch: IconifyFetch = async (url) => {
      const { pathname, searchParams } = new URL(url)
      const prefix = pathname
        .split('/')
        .at(-1)!
        .replace(/\.json$/, '')
      const icons = Object.fromEntries(
        searchParams
          .get('icons')!
          .split(',')
          .map((name) => [name, { body: '<path d="M0 0L1 1z"/>' }]),
      )
      return iconifyResponse(prefix, icons)
    }
    const provider = createIconifyProvider({ fetch, setName: 'external-icons' })
    const set = await provider.loadIcons(['mdi:home', 'lucide:home', 'mdi:home'])

    expect(set.name).toBe('external-icons')
    expect(Object.keys(set.icons).sort()).toEqual(['lucide:home', 'mdi:home'])
  })

  it.each([
    ['script elements', '<script>alert(1)</script>'],
    ['event handlers', '<path onload="alert(1)" d="M0 0L1 1z"/>'],
    ['external paint URLs', '<path fill="url(https://example.test/a.svg#x)" d="M0 0z"/>'],
    ['nested SVG markup', '<g><path d="M0 0z"/></g>'],
    ['malformed attributes', '<path d=M0 />'],
    ['unknown attributes', '<path style="color:red" d="M0 0z"/>'],
  ])('rejects unsafe Iconify %s instead of rendering it', async (_case, body) => {
    const provider = createIconifyProvider({
      fetch: fetchWith(iconifyResponse('mdi', { unsafe: { body } })),
    })
    await expect(provider.loadIcon('mdi:unsafe')).rejects.toMatchObject({ code: 'unsafe-icon' })
  })

  it('rejects invalid names before making a request', async () => {
    const fetch = vi.fn(fetchWith(iconifyResponse('mdi', {})))
    const provider = createIconifyProvider({ fetch })
    await expect(provider.loadIcon('../mdi:home')).rejects.toMatchObject({ code: 'invalid-name' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('validates the response collection, dimensions, requested names, and status', async () => {
    const badPrefix = createIconifyProvider({ fetch: fetchWith(iconifyResponse('lucide', {})) })
    await expect(badPrefix.loadIcon('mdi:home')).rejects.toMatchObject({
      code: 'invalid-response',
    })

    const missing = createIconifyProvider({ fetch: fetchWith(iconifyResponse('mdi', {})) })
    await expect(missing.loadIcon('mdi:home')).rejects.toMatchObject({ code: 'missing-icon' })

    const invalidSize = createIconifyProvider({
      fetch: fetchWith(
        iconifyResponse('mdi', { home: { width: Infinity, body: '<path d="M0 0z"/>' } }),
      ),
    })
    await expect(invalidSize.loadIcon('mdi:home')).rejects.toMatchObject({ code: 'unsafe-icon' })

    const unavailable = createIconifyProvider({
      fetch: async () => ({
        ok: false,
        status: 503,
        async text() {
          return ''
        },
      }),
    })
    await expect(unavailable.loadIcon('mdi:home')).rejects.toMatchObject({ code: 'http' })
  })

  it('rejects invalid API URLs and excessive response sizes', async () => {
    expect(() => createIconifyProvider({ apiUrl: 'javascript:alert(1)' })).toThrow(
      /must use HTTP\(S\)/,
    )

    const oversized = createIconifyProvider({
      fetch: fetchWith({
        ok: true,
        status: 200,
        async text() {
          return `{"prefix":"mdi","icons":{}}${' '.repeat(1_000_001)}`
        },
      }),
    })
    await expect(oversized.loadIcons(['mdi:home'])).rejects.toMatchObject({
      code: 'limit-exceeded',
    })
  })
})
