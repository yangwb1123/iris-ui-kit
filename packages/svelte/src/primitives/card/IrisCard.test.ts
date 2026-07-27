import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import IrisCard from './IrisCard.svelte'

afterEach(cleanup)

describe('@iris-ui-kit/svelte IrisCard', () => {
  it('renders the card container', () => {
    const { container } = render(IrisCard)
    expect(container.querySelector('[data-iris-card]')).not.toBeNull()
  })

  it('defaults to elevated variant', () => {
    const { container } = render(IrisCard)
    expect(container.querySelector('[data-iris-card-variant="elevated"]')).not.toBeNull()
  })

  it('sets outline variant data attribute', () => {
    const { container } = render(IrisCard, { props: { variant: 'outline' } })
    expect(container.querySelector('[data-iris-card-variant="outline"]')).not.toBeNull()
  })

  it('sets hover attribute when hover=true', () => {
    const { container } = render(IrisCard, { props: { hover: true } })
    expect(container.querySelector('[data-iris-card-hover="true"]')).not.toBeNull()
  })

  it('does not render header/footer sections when not provided', () => {
    const { container } = render(IrisCard)
    expect(container.querySelector('[data-iris-card-header]')).toBeNull()
    expect(container.querySelector('[data-iris-card-footer]')).toBeNull()
  })
})
