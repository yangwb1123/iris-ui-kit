import { render } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
import IrisToolbar from './IrisToolbar.svelte'

describe('IrisToolbar', () => {
  it('renders with role=toolbar', () => {
    const { container } = render(IrisToolbar)
    expect(container.querySelector('[role="toolbar"]')).not.toBeNull()
  })

  it('sets aria-orientation', () => {
    const { container } = render(IrisToolbar, { props: { orientation: 'vertical' } })
    expect(container.querySelector('[aria-orientation="vertical"]')).not.toBeNull()
  })

  it('sets aria-label when provided', () => {
    const { container } = render(IrisToolbar, { props: { ariaLabel: 'My toolbar' } })
    expect(container.querySelector('[aria-label="My toolbar"]')).not.toBeNull()
  })
})
