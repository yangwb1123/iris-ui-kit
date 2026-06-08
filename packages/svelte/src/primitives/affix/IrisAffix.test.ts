import { render } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
import IrisAffix from './IrisAffix.svelte'

describe('IrisAffix', () => {
  it('renders children', () => {
    render(IrisAffix, { props: {} })
    // Just check root renders
    expect(document.querySelector('[data-iris-affix]')).not.toBeNull()
  })

  it('has data-iris-affix attribute', () => {
    const { container } = render(IrisAffix)
    expect(container.querySelector('[data-iris-affix]')).not.toBeNull()
  })

  it('has data-iris-affix-content child', () => {
    const { container } = render(IrisAffix)
    expect(container.querySelector('[data-iris-affix-content]')).not.toBeNull()
  })
})
