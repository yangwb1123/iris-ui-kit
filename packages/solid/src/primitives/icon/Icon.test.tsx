import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisIcon } from './Icon'
import { createIconRegistry, type IrisIconNode } from '@iris-ui-kit/icons'

afterEach(cleanup)

describe('@iris-ui-kit/solid IrisIcon', () => {
  it('renders a registered icon as inline SVG with structured nodes', () => {
    const { container } = render(() => <IrisIcon name="chevron-down" />)
    const svg = container.querySelector('svg[data-iris-icon="chevron-down"]')
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute('aria-hidden')).toBe('true')
    expect(svg!.querySelector('polyline, path, line, circle, rect')).not.toBeNull()
  })

  it('renders nested structured SVG nodes', () => {
    const registry = createIconRegistry({
      sets: [
        {
          name: 'nested',
          icons: {
            nested: {
              name: 'nested',
              nodes: [
                {
                  tag: 'defs',
                  attrs: {},
                  children: [
                    {
                      tag: 'linearGradient',
                      attrs: { id: 'paint' },
                      children: [
                        { tag: 'stop', attrs: { offset: '0', 'stop-color': 'currentColor' } },
                      ],
                    },
                    {
                      tag: 'mask',
                      attrs: { id: 'fade', 'mask-type': 'alpha' },
                      children: [
                        {
                          tag: 'rect',
                          attrs: { x: 0, y: 0, width: 24, height: 24, fill: 'white' },
                        },
                      ],
                    },
                  ],
                },
                {
                  tag: 'g',
                  attrs: { opacity: '0.5', mask: 'url(#fade)' },
                  children: [
                    {
                      tag: 'path',
                      attrs: { d: 'M0 0L1 1z', fill: 'url(#paint)' },
                    },
                  ],
                },
              ],
            },
          },
        },
      ],
    })
    const { container } = render(() => <IrisIcon name="nested" registry={registry} />)
    expect(container.querySelector('svg g > path')?.getAttribute('d')).toBe('M0 0L1 1z')
    expect(container.querySelector('svg g > path')?.getAttribute('fill')).toBe('url(#paint)')
    expect(container.querySelector('svg defs stop')?.getAttribute('stop-color')).toBe(
      'currentColor',
    )
    expect(container.querySelector('svg defs mask')?.getAttribute('mask-type')).toBe('alpha')
    expect(container.querySelector('svg g')?.getAttribute('mask')).toBe('url(#fade)')
  })

  it('omits cyclic branches and unsafe attributes from custom icon registries', () => {
    const group: IrisIconNode = { tag: 'g', attrs: { opacity: '0.5', onload: 'alert(1)' } }
    group.children = [
      group,
      {
        tag: 'path',
        attrs: {
          d: 'M0 0L1 1z',
          fill: 'url(https://example.test/paint.svg#x)',
          href: 'javascript:alert(1)',
        },
      },
    ]
    const registry = createIconRegistry({
      sets: [{ name: 'cyclic', icons: { cycle: { name: 'cycle', nodes: [group] } } }],
    })
    const { container } = render(() => <IrisIcon name="cycle" registry={registry} />)
    const groupElement = container.querySelector('g')
    const path = container.querySelector('g > path')
    expect(path?.getAttribute('d')).toBe('M0 0L1 1z')
    expect(groupElement?.hasAttribute('onload')).toBe(false)
    expect(path?.hasAttribute('href')).toBe(false)
    expect(path?.hasAttribute('fill')).toBe(false)
  })

  it('sets role=img + aria-label + <title> when titled', () => {
    const { container } = render(() => <IrisIcon name="check" title="Done" />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe('Done')
    expect(svg.querySelector('title')!.textContent).toBe('Done')
  })

  it('renders nothing for an unknown icon name', () => {
    const { container } = render(() => <IrisIcon name="definitely-not-an-icon" />)
    expect(container.querySelector('svg')).toBeNull()
  })
})
