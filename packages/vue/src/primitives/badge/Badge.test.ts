import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { IrisBadge } from './Badge'

describe('IrisBadge', () => {
  it('emits a precomputed subtle fallback before the color-mix background', async () => {
    // SSR serializes the style object verbatim (no CSSOM folding), so we can see
    // BOTH declarations: the static `background-color` fallback (for engines
    // without color-mix) and the `background` color-mix that overrides it.
    const html = await renderToString(
      createSSRApp({
        render: () => h(IrisBadge, { variant: 'subtle', tone: 'danger' }, { default: () => 'x' }),
      }),
    )
    expect(html).toContain('background-color:var(--iris-danger-subtle)')
    expect(html).toContain('background:color-mix(')
    // Fallback must precede the override in source order (cascade correctness).
    expect(html.indexOf('background-color:var(--iris-danger-subtle)')).toBeLessThan(
      html.indexOf('background:color-mix('),
    )
  })

  it('renders a span with the slot content', () => {
    const w = mount(IrisBadge, { slots: { default: '3' } })
    expect(w.element.tagName).toBe('SPAN')
    expect(w.text()).toBe('3')
  })

  it('defaults to subtle/primary/md', () => {
    const w = mount(IrisBadge)
    expect(w.attributes('data-iris-badge-variant')).toBe('subtle')
    expect(w.attributes('data-iris-badge-tone')).toBe('primary')
    expect(w.attributes('data-iris-badge-size')).toBe('md')
  })

  it('solid variant uses primary-foreground for text', () => {
    const w = mount(IrisBadge, { props: { variant: 'solid', tone: 'success' } })
    const style = w.attributes('style') ?? ''
    expect(style).toContain('--iris-success')
    expect(style).toContain('--iris-foreground')
  })

  it('outline variant has transparent background + colored border', () => {
    const w = mount(IrisBadge, { props: { variant: 'outline', tone: 'danger' } })
    const style = w.attributes('style') ?? ''
    expect(style).toContain('background: transparent')
    expect(style).toContain('--iris-danger')
  })

  it('subtle variant uses color-mix for soft background', () => {
    const w = mount(IrisBadge, { props: { variant: 'subtle', tone: 'warning' } })
    const style = w.attributes('style') ?? ''
    expect(style).toContain('color-mix')
    expect(style).toContain('--iris-warning')
  })

  it('sm size shrinks padding + font', () => {
    const w = mount(IrisBadge, { props: { size: 'sm' } })
    const style = w.attributes('style') ?? ''
    expect(style).toContain('font-size: 11px')
  })

  it('preserves consumer-provided style', () => {
    const w = mount(IrisBadge, { attrs: { style: { marginLeft: '8px' } } })
    expect(w.attributes('style')).toContain('margin-left: 8px')
  })
})
