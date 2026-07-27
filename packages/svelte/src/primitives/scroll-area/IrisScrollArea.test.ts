import { render } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
import IrisScrollArea from './IrisScrollArea.svelte'

describe('IrisScrollArea', () => {
  it('renders with data attribute', () => {
    const { container } = render(IrisScrollArea)
    expect(container.querySelector('[data-iris-scroll-area]')).not.toBeNull()
  })

  it('sets data-axis', () => {
    const { container } = render(IrisScrollArea, { props: { axis: 'horizontal' } })
    expect(container.querySelector('[data-axis="horizontal"]')).not.toBeNull()
  })

  it('exposes the scrollable content as a region', () => {
    const { container } = render(IrisScrollArea)
    const region = container.querySelector('[data-iris-scroll-area]')!
    expect(region.getAttribute('role')).toBe('region')
    expect(region.getAttribute('tabindex')).toBe('0')
  })

  it('applies maxHeight style', () => {
    const { container } = render(IrisScrollArea, { props: { maxHeight: 300 } })
    const el = container.querySelector('[data-iris-scroll-area]') as HTMLElement
    expect(el.style.maxHeight).toBe('300px')
  })
})
