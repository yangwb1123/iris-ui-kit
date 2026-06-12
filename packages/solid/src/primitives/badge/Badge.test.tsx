import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisBadge, badgeStyle } from './Badge'

afterEach(cleanup)

describe('@iris-ui/solid IrisBadge', () => {
  it('emits a precomputed subtle fallback BEFORE the color-mix background', () => {
    // Solid applies the style object declaration-by-declaration, so the live DOM
    // CSSOM folds the `background-color` longhand away once the `background`
    // shorthand follows. We assert on the source style object (the cascade input)
    // to prove BOTH the static `--iris-danger-subtle` fallback (for engines
    // without color-mix) and the color-mix override are present, fallback first.
    const style = badgeStyle('subtle', 'danger', 'md') as Record<string, string>
    const keys = Object.keys(style)
    expect(style['background-color']).toBe('var(--iris-danger-subtle)')
    expect(style.background).toContain('color-mix(')
    // Fallback longhand must precede the color-mix shorthand in source order.
    expect(keys.indexOf('background-color')).toBeLessThan(keys.indexOf('background'))
  })

  it('renders a span with content', () => {
    const { getByText } = render(() => <IrisBadge>3</IrisBadge>)
    expect(getByText('3').tagName).toBe('SPAN')
  })

  it('defaults to subtle/primary/md', () => {
    const { getByText } = render(() => <IrisBadge>x</IrisBadge>)
    const el = getByText('x')
    expect(el.getAttribute('data-iris-badge-variant')).toBe('subtle')
    expect(el.getAttribute('data-iris-badge-tone')).toBe('primary')
    expect(el.getAttribute('data-iris-badge-size')).toBe('md')
  })

  it('subtle variant still reaches the DOM with the color-mix background', () => {
    const { getByText } = render(() => (
      <IrisBadge variant="subtle" tone="danger">
        x
      </IrisBadge>
    ))
    const style = getByText('x').getAttribute('style') ?? ''
    expect(style).toContain('color-mix(')
  })
})
