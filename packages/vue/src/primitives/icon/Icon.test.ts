import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { IrisIcon } from './Icon'
import { createIconRegistry, type IrisIconNode } from '@iris-ui-kit/icons'
import { ThemeProvider } from '../../theme'
import { createThemeStore } from '@iris-ui-kit/theme'
import { lightTheme } from '@iris-ui-kit/tokens'

describe('@iris-ui-kit/vue IrisIcon', () => {
  it('renders an svg with structured children + currentColor stroke', () => {
    const wrap = mount(IrisIcon, { props: { name: 'check' } })
    const el = wrap.find('[data-iris-icon="check"]')
    expect(el.exists()).toBe(true)
    expect(el.attributes('stroke')).toBe('currentColor')
    expect(el.attributes('fill')).toBe('none')
    expect(wrap.find('polyline').exists()).toBe(true)
    expect(wrap.html()).toContain('viewBox="0 0 24 24"')
  })

  it('renders one element per structured node (x = two lines)', () => {
    const wrap = mount(IrisIcon, { props: { name: 'x' } })
    expect(wrap.findAll('line').length).toBe(2)
  })

  it('honors size + strokeWidth', () => {
    const wrap = mount(IrisIcon, { props: { name: 'x', size: 16, strokeWidth: 1.5 } })
    const el = wrap.find('[data-iris-icon]')
    expect(el.attributes('width')).toBe('16')
    expect(el.attributes('height')).toBe('16')
    expect(el.attributes('stroke-width')).toBe('1.5')
  })

  it('fill mode swaps stroke for fill', () => {
    const wrap = mount(IrisIcon, { props: { name: 'folder', fill: true } })
    const el = wrap.find('[data-iris-icon]')
    expect(el.attributes('fill')).toBe('currentColor')
    expect(el.attributes('stroke')).toBeUndefined()
    expect(wrap.find('path').exists()).toBe(true)
  })

  it('title adds role=img + aria-label + <title>', () => {
    const wrap = mount(IrisIcon, { props: { name: 'search', title: 'Search' } })
    const el = wrap.find('[data-iris-icon]')
    expect(el.attributes('role')).toBe('img')
    expect(el.attributes('aria-label')).toBe('Search')
    expect(wrap.find('title').exists()).toBe(true)
    expect(wrap.find('title').text()).toBe('Search')
  })

  it('decorative (no title) is aria-hidden', () => {
    const wrap = mount(IrisIcon, { props: { name: 'menu' } })
    expect(wrap.find('[data-iris-icon]').attributes('aria-hidden')).toBe('true')
  })

  it('renders nothing for an unknown icon', () => {
    const wrap = mount(IrisIcon, { props: { name: 'does-not-exist' } })
    expect(wrap.find('[data-iris-icon]').exists()).toBe(false)
  })

  it('resolves nested definitions and local paint references from a custom registry', () => {
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
    const wrap = mount(IrisIcon, { props: { name: 'star', registry: reg } })
    expect(wrap.find('g > path').attributes('d')).toBe('M0 0L1 1z')
    expect(wrap.find('g > path').attributes('fill')).toBe('url(#paint)')
    expect(wrap.find('defs stop').attributes('stop-color')).toBe('currentColor')
    expect(wrap.find('defs mask').attributes('mask-type')).toBe('alpha')
    expect(wrap.find('g').attributes('mask')).toBe('url(#fade)')
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
    const wrap = mount(IrisIcon, { props: { name: 'cycle', registry } })
    expect(wrap.find('g > path').attributes('d')).toBe('M0 0L1 1z')
    expect(wrap.find('g').attributes('onload')).toBeUndefined()
    expect(wrap.find('path').attributes('href')).toBeUndefined()
    expect(wrap.find('path').attributes('fill')).toBeUndefined()
  })

  it('merges custom style', () => {
    const wrap = mount(IrisIcon, { props: { name: 'check' }, attrs: { style: { opacity: '0.5' } } })
    expect(wrap.find('[data-iris-icon]').attributes('style')).toContain('opacity')
  })

  it('honors theme iconOverrides (alias remap) inside a ThemeProvider', () => {
    const themed = { ...lightTheme, iconOverrides: { 'chevron-down': 'chevron-up' } }
    const store = createThemeStore({ themes: { t: themed }, default: 't' })
    const wrap = mount(ThemeProvider, {
      props: { store },
      slots: { default: () => h(IrisIcon, { name: 'chevron-down' }) },
    })
    // chevron-down aliased to chevron-up → chevron-up's polyline geometry.
    expect(wrap.find('polyline').attributes('points')).toBe('18 15 12 9 6 15')
  })
})
