import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisIcon } from './Icon'
import { createIconRegistry } from '@iris-ui-kit/icons'
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
            star: { name: 'star', nodes: [{ tag: 'circle', attrs: { cx: 12, cy: 12, r: 10 } }] },
          },
        },
      ],
    })
    render(<IrisIcon name="star" registry={reg} />)
    expect(svg()!.querySelector('circle')).not.toBeNull()
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
