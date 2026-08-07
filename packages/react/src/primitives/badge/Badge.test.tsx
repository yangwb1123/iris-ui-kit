import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { IrisBadge } from './Badge'

afterEach(() => cleanup())

describe('@iris-ui-kit/react IrisBadge', () => {
  it('emits a precomputed subtle fallback before the color-mix background', () => {
    // SSR markup serializes the style object verbatim (no CSSOM folding), so we
    // can see BOTH declarations: the static `background-color` fallback (for
    // engines without color-mix) and the `background` color-mix that overrides it.
    const html = renderToStaticMarkup(
      <IrisBadge variant="subtle" tone="danger">
        x
      </IrisBadge>,
    )
    expect(html).toContain('background-color:var(--iris-danger-subtle)')
    expect(html).toContain('background:color-mix(')
    // Fallback must precede the override in source order (cascade correctness).
    expect(html.indexOf('background-color:var(--iris-danger-subtle)')).toBeLessThan(
      html.indexOf('background:color-mix('),
    )
  })

  it('renders a span with content', () => {
    render(<IrisBadge>3</IrisBadge>)
    const el = screen.getByText('3')
    expect(el.tagName).toBe('SPAN')
  })

  it('defaults to subtle/primary/md', () => {
    render(<IrisBadge>x</IrisBadge>)
    const el = screen.getByText('x')
    expect(el.getAttribute('data-iris-badge-variant')).toBe('subtle')
    expect(el.getAttribute('data-iris-badge-tone')).toBe('primary')
    expect(el.getAttribute('data-iris-badge-size')).toBe('md')
  })

  it('solid variant uses primary-foreground for text', () => {
    render(
      <IrisBadge variant="solid" tone="success">
        x
      </IrisBadge>,
    )
    const style = screen.getByText('x').getAttribute('style') ?? ''
    expect(style).toContain('--iris-success')
    expect(style).toContain('--iris-foreground')
  })

  it('outline variant uses transparent background + colored border', () => {
    render(
      <IrisBadge variant="outline" tone="danger">
        x
      </IrisBadge>,
    )
    const style = screen.getByText('x').getAttribute('style') ?? ''
    expect(style).toContain('background: transparent')
    expect(style).toContain('--iris-danger')
  })

  it('subtle variant uses color-mix', () => {
    render(
      <IrisBadge variant="subtle" tone="warning">
        x
      </IrisBadge>,
    )
    const style = screen.getByText('x').getAttribute('style') ?? ''
    expect(style).toContain('color-mix')
  })

  it('sm size has smaller font', () => {
    render(<IrisBadge size="sm">x</IrisBadge>)
    const style = screen.getByText('x').getAttribute('style') ?? ''
    expect(style).toContain('font-size: 11px')
  })

  it('preserves consumer style', () => {
    render(<IrisBadge style={{ marginLeft: 8 }}>x</IrisBadge>)
    const style = screen.getByText('x').getAttribute('style') ?? ''
    expect(style).toContain('margin-left: 8px')
  })
})
