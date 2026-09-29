import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisIcon } from './Icon'
import { createIconRegistry, type IrisIconNode } from '@iris-ui-kit/icons'
import { ThemeProvider } from '../../theme'
import { createThemeStore } from '@iris-ui-kit/theme'
import { lightTheme } from '@iris-ui-kit/tokens'

afterEach(() => cleanup())

function svg(): SVGSVGElement | null {
  return document.querySelector('[data-iris-icon]')
}

describe('@iris-ui-kit/react IrisIcon', () => {
  it('renders an svg with structured children + currentColor stroke', () => {
    render(<IrisIcon name="check" />)
    const el = svg()!
    expect(el).not.toBeNull()
    expect(el.getAttribute('data-iris-icon')).toBe('check')
    expect(el.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(el.getAttribute('stroke')).toBe('currentColor')
    expect(el.getAttribute('fill')).toBe('none')
    expect(el.querySelector('polyline')).not.toBeNull()
  })

  it('renders one element per structured node (x = two lines)', () => {
    render(<IrisIcon name="x" />)
    expect(svg()!.querySelectorAll('line').length).toBe(2)
  })

  it('honors size + strokeWidth', () => {
    render(<IrisIcon name="x" size={16} strokeWidth={1.5} />)
    const el = svg()!
    expect(el.getAttribute('width')).toBe('16')
    expect(el.getAttribute('height')).toBe('16')
    expect(el.getAttribute('stroke-width')).toBe('1.5')
  })

  it('fill mode swaps stroke for fill', () => {
    render(<IrisIcon name="folder" fill />)
    const el = svg()!
    expect(el.getAttribute('fill')).toBe('currentColor')
    expect(el.getAttribute('stroke')).toBeNull()
    expect(el.querySelector('path')).not.toBeNull()
  })

  it('title adds role=img + aria-label + <title>', () => {
    render(<IrisIcon name="search" title="Search" />)
    const el = svg()!
    expect(el.getAttribute('role')).toBe('img')
    expect(el.getAttribute('aria-label')).toBe('Search')
    expect(el.querySelector('title')?.textContent).toBe('Search')
  })

  it('decorative (no title) is aria-hidden', () => {
    render(<IrisIcon name="menu" />)
    expect(svg()!.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders nothing for an unknown icon', () => {
    const { container } = render(<IrisIcon name="does-not-exist" />)
    expect(container.querySelector('svg')).toBeNull()
    expect(svg()).toBeNull()
  })

  it('resolves from a custom registry', () => {
    const reg = createIconRegistry({
      sets: [
        {
          name: 'x',
          icons: {
            star: {
              name: 'star',
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
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(<IrisIcon name="star" registry={reg} />)
      const root = svg()!
      expect(root.querySelector('g > path')?.getAttribute('d')).toBe('M0 0L1 1z')
      expect(root.querySelector('g > path')?.getAttribute('fill')).toBe('url(#paint)')
      expect(root.querySelector('defs stop')?.getAttribute('stop-color')).toBe('currentColor')
      expect(root.querySelector('defs mask')?.getAttribute('mask-type')).toBe('alpha')
      expect(root.querySelector('g')?.getAttribute('mask')).toBe('url(#fade)')
      expect(consoleError).not.toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
    }
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
    render(<IrisIcon name="cycle" registry={registry} />)
    const rendered = svg()!
    expect(rendered.querySelector('g > path')?.getAttribute('d')).toBe('M0 0L1 1z')
    expect(rendered.querySelector('g')?.hasAttribute('onload')).toBe(false)
    expect(rendered.querySelector('path')?.hasAttribute('href')).toBe(false)
    expect(rendered.querySelector('path')?.hasAttribute('fill')).toBe(false)
  })

  it('merges custom className + style', () => {
    render(<IrisIcon name="check" className="ic" style={{ opacity: 0.5 }} />)
    const el = svg()!
    expect(el.getAttribute('class')).toBe('ic')
    expect(el.style.opacity).toBe('0.5')
  })

  it('honors theme iconOverrides (alias remap) when inside a ThemeProvider', () => {
    const themed = { ...lightTheme, iconOverrides: { 'chevron-down': 'chevron-up' } }
    const store = createThemeStore({ themes: { t: themed }, default: 't' })
    render(
      <ThemeProvider store={store}>
        <IrisIcon name="chevron-down" />
      </ThemeProvider>,
    )
    // chevron-down aliased to chevron-up → chevron-up's polyline geometry.
    expect(svg()!.querySelector('polyline')?.getAttribute('points')).toBe('18 15 12 9 6 15')
  })
})
