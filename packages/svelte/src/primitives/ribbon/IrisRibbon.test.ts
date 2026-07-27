import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import IrisRibbon from './IrisRibbon.svelte'

afterEach(cleanup)

describe('@iris-ui-kit/svelte IrisRibbon', () => {
  it('renders the ribbon container', () => {
    const { container } = render(IrisRibbon, { props: { text: 'New' } })
    expect(container.querySelector('[data-iris-ribbon]')).not.toBeNull()
  })

  it('renders the badge with text', () => {
    const { container } = render(IrisRibbon, { props: { text: 'Sale' } })
    expect(container.querySelector('[data-iris-ribbon-badge]')!.textContent).toBe('Sale')
  })

  it('defaults to end placement', () => {
    const { container } = render(IrisRibbon, { props: { text: 'Hot' } })
    expect(container.querySelector('[data-placement="end"]')).not.toBeNull()
  })

  it('sets start placement when specified', () => {
    const { container } = render(IrisRibbon, { props: { text: 'Hot', placement: 'start' } })
    expect(container.querySelector('[data-placement="start"]')).not.toBeNull()
    const badge = container.querySelector<HTMLElement>('[data-iris-ribbon-badge]')!
    expect(badge.getAttribute('style')).toContain('inset-inline-start')
  })
})
