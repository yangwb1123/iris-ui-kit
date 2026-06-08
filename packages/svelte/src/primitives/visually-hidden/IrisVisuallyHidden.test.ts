import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import IrisVisuallyHidden from './IrisVisuallyHidden.svelte'

afterEach(cleanup)

describe('@iris-ui/svelte IrisVisuallyHidden', () => {
  it('renders a span with sr-only styles', () => {
    const { container } = render(IrisVisuallyHidden)
    const el = container.querySelector('[data-iris-visually-hidden]')
    expect(el).not.toBeNull()
    expect(el!.tagName).toBe('SPAN')
  })

  it('has visually-hidden CSS (position absolute + clip)', () => {
    const { container } = render(IrisVisuallyHidden)
    const el = container.querySelector<HTMLElement>('[data-iris-visually-hidden]')!
    expect(el.getAttribute('style')).toContain('position: absolute')
    expect(el.getAttribute('style')).toContain('clip')
  })
})
