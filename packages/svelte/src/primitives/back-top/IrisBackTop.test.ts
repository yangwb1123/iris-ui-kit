import { render } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
import IrisBackTop from './IrisBackTop.svelte'

describe('IrisBackTop', () => {
  it('does not render button when page not scrolled', () => {
    const { container } = render(IrisBackTop, { props: { visibilityHeight: 400 } })
    // scrollY is 0 in jsdom, so button should be hidden
    expect(container.querySelector('[data-iris-back-top]')).toBeNull()
  })

  it('renders when visibilityHeight is 0', () => {
    const { container } = render(IrisBackTop, { props: { visibilityHeight: 0 } })
    expect(container.querySelector('[data-iris-back-top]')).not.toBeNull()
  })

  it('has correct aria-label', () => {
    const { container } = render(IrisBackTop, {
      props: { visibilityHeight: 0, ariaLabel: 'Go up' },
    })
    expect(container.querySelector('[data-iris-back-top]')!.getAttribute('aria-label')).toBe(
      'Go up',
    )
  })
})
