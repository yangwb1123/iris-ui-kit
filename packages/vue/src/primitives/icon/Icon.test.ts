import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { IrisIcon } from './Icon'
import { createIconRegistry } from '@iris-ui/icons'
import { ThemeProvider } from '../../theme'
import { createThemeStore } from '@iris-ui/theme'
import { lightTheme } from '@iris-ui/tokens'

describe('@iris-ui/vue IrisIcon', () => {
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

  it('resolves from a custom registry', () => {
    const reg = createIconRegistry({
      sets: [
        {
          name: 'x',
          icons: {
            star: { name: 'star', nodes: [{ tag: 'circle', attrs: { cx: 12, cy: 12, r: 10 } }] },
          },
        },
      ],
    })
    const wrap = mount(IrisIcon, { props: { name: 'star', registry: reg } })
    expect(wrap.find('circle').exists()).toBe(true)
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
