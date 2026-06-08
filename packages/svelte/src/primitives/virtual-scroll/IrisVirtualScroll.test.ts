import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import IrisVirtualScroll from './IrisVirtualScroll.svelte'

afterEach(cleanup)

const items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }))

describe('IrisVirtualScroll', () => {
  it('renders without crashing', () => {
    const { container } = render(IrisVirtualScroll, { props: { items, itemHeight: 40 } })
    expect(container).toBeTruthy()
  })

  it('renders the viewport and spacer', () => {
    const { container } = render(IrisVirtualScroll, { props: { items, itemHeight: 40 } })
    expect(container.querySelector('[data-iris-virtual-scroll]')).not.toBeNull()
    expect(container.querySelector('[data-iris-virtual-spacer]')).not.toBeNull()
  })

  it('spacer has correct total height', () => {
    const { container } = render(IrisVirtualScroll, {
      props: { items, itemHeight: 40, height: 400 },
    })
    const spacer = container.querySelector('[data-iris-virtual-spacer]') as HTMLElement
    expect(spacer.style.height).toBe(`${100 * 40}px`)
  })

  it('renders only visible items (not all 100)', () => {
    const { container } = render(IrisVirtualScroll, {
      props: { items, itemHeight: 40, height: 400, buffer: 0 },
    })
    const renderedItems = container.querySelectorAll('[data-iris-virtual-item]')
    expect(renderedItems.length).toBeLessThan(items.length)
  })
})
