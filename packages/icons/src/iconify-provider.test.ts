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

  it('preserves safe nested groups, definitions, gradients, masks, and local references', async () => {
    const body =
      '<defs><linearGradient id="paint"><stop offset="0%" stop-color="#fff"/><stop offset="1" stop-color="currentColor"/></linearGradient><clipPath id="clip"><circle cx="12" cy="12" r="10"/></clipPath><mask id="fade"><rect x="0" y="0" width="24" height="24" fill="white"/></mask></defs><g clip-path="url(#clip)" mask="url(#fade)" opacity="0.5"><path fill="url(#paint)" d="M0 0L24 24z"/></g>'
    const provider = createIconifyProvider({
      fetch: fetchWith(iconifyResponse('mdi', { complex: { body } })),
    })

    const icon = await provider.loadIcon('mdi:complex')
    const registry = createIconRegistry({
      sets: [{ name: 'remote', icons: { [icon.name]: icon } }],
    })
    expect(registry.resolve('mdi:complex')?.nodes[1]?.children?.[0]?.attrs.fill).toBe('url(#paint)')
    const svg = renderIconSvg(icon)
    expect(svg).toContain('<linearGradient id="paint">')
    expect(svg).toContain('<clipPath id="clip">')
    expect(svg).toContain('<mask id="fade">')
    expect(svg).toContain('<g clip-path="url(#clip)" mask="url(#fade)" opacity="0.5">')
    expect(svg).toContain('<path fill="url(#paint)" d="M0 0L24 24z"/>')
  })

  it('enforces nested-node depth and total-node limits', async () => {
    const overDepth = `${'<g>'.repeat(18)}<path d="M0 0z"/>${'</g>'.repeat(18)}`
    const overNodeCount = '<path d="M0 0z"/>'.repeat(513)
    for (const body of [overDepth, overNodeCount]) {
      const provider = createIconifyProvider({
        fetch: fetchWith(iconifyResponse('mdi', { oversized: { body } })),
      })
      await expect(provider.loadIcon('mdi:oversized')).rejects.toMatchObject({
        code: 'limit-exceeded',
      })
    }
  })

  it('rejects missing, incompatible, external, and cyclic SVG references', async () => {
    const bodies = [
      '<path fill="url(#missing)" d="M0 0z"/>',
      '<defs><linearGradient id="paint"><stop offset="0" stop-color="url(#paint)"/></linearGradient></defs><path fill="url(#paint)" d="M0 0z"/>',
      '<defs><linearGradient id="paint"><stop offset="0" stop-color="red"/></linearGradient></defs><path clip-path="url(#paint)" d="M0 0z"/>',
      '<defs><clipPath id="a"><circle clip-path="url(#b)" cx="0" cy="0" r="1"/></clipPath><clipPath id="b"><circle clip-path="url(#a)" cx="0" cy="0" r="1"/></clipPath></defs><path clip-path="url(#a)" d="M0 0z"/>',
    ]
    for (const body of bodies) {
      const provider = createIconifyProvider({
        fetch: fetchWith(iconifyResponse('mdi', { unsafe: { body } })),
      })
      await expect(provider.loadIcon('mdi:unsafe')).rejects.toMatchObject({ code: 'unsafe-icon' })
    }
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
    ['text content', '<g>not SVG geometry</g>'],
    ['mismatched nested elements', '<g><path d="M0 0z"/></defs>'],
    [
      'duplicate definition IDs',
      '<defs><clipPath id="shared"/><mask id="shared"/></defs><path d="M0 0z"/>',
    ],
    [
      'definitions without drawable geometry',
      '<defs><linearGradient id="empty"><stop offset="0" stop-color="black"/></linearGradient></defs>',
    ],
    ['unsupported filters', '<filter><feGaussianBlur stdDeviation="2"/></filter>'],
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
