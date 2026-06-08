import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import IrisDivider from './IrisDivider.svelte'

afterEach(cleanup)

describe('@iris-ui/svelte IrisDivider', () => {
  it('renders an <hr> for horizontal without label', () => {
    const { container } = render(IrisDivider)
    const el = container.querySelector('[data-iris-divider]')
    expect(el).not.toBeNull()
    expect(el!.tagName).toBe('HR')
  })

  it('renders a div with role=separator for vertical orientation', () => {
    const { container } = render(IrisDivider, { props: { orientation: 'vertical' } })
    const el = container.querySelector('[data-iris-divider-orientation="vertical"]')
    expect(el).not.toBeNull()
    expect(el!.getAttribute('role')).toBe('separator')
  })

  it('renders label variant with three spans when label prop is set', () => {
    const { container } = render(IrisDivider, { props: { label: 'OR' } })
    expect(container.querySelector('[data-iris-divider-label]')).not.toBeNull()
    expect(container.querySelector('[data-iris-divider-has-label="true"]')).not.toBeNull()
  })
})
