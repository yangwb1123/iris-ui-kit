// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { render } from 'svelte/server'
import BadgeHarness from './BadgeHarness.svelte'

describe('@iris-ui-kit/svelte IrisBadge', () => {
  it('emits a precomputed subtle fallback before the color-mix background', () => {
    // SSR markup serializes the style attribute verbatim (no CSSOM folding), so
    // we can see BOTH declarations: the static `background-color` fallback (for
    // engines without color-mix) and the `background` color-mix that overrides
    // it on modern engines. (jsdom would fold the shorthand away; SSR doesn't.)
    const { body } = render(BadgeHarness, {
      props: { variant: 'subtle', tone: 'danger' },
    })
    expect(body).toContain('background-color: var(--iris-danger-subtle)')
    expect(body).toContain('background: color-mix(')
    // Fallback must precede the override in source order (cascade correctness).
    expect(body.indexOf('background-color: var(--iris-danger-subtle)')).toBeLessThan(
      body.indexOf('background: color-mix('),
    )
  })
})
