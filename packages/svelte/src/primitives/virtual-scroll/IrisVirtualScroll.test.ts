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

  // ADDITIVE: the createVirtualizer-backed imperative handle (exported fns via
  // the component instance) — same surface as the React forwardRef handle.
  it('imperative scrollToIndex sets scrollTop (fixed height)', () => {
    const { container, component } = render(IrisVirtualScroll, {
      props: { items, itemHeight: 40, height: 400 },
    })
    const root = container.querySelector('[data-iris-virtual-scroll]') as HTMLDivElement
    ;(component as unknown as { scrollToIndex: (i: number) => void }).scrollToIndex(50)
    expect(root.scrollTop).toBe(50 * 40)
  })

  it('scrollToIndex align=end positions item at viewport bottom', () => {
    const { container, component } = render(IrisVirtualScroll, {
      props: { items, itemHeight: 40, height: 400 },
    })
    const root = container.querySelector('[data-iris-virtual-scroll]') as HTMLDivElement
    // jsdom reports clientHeight 0, so viewportHeight collapses to 0:
    // align=end → start - viewport + size = 50*40 - 0 + 40 = 2040.
    ;(component as unknown as { scrollToIndex: (i: number, a: 'end') => void }).scrollToIndex(
      50,
      'end',
    )
    expect(root.scrollTop).toBe(2040)
  })

  it('scrollToOffset is clamped to the scrollable range', () => {
    const { container, component } = render(IrisVirtualScroll, {
      props: { items, itemHeight: 40, height: 400 },
    })
    const root = container.querySelector('[data-iris-virtual-scroll]') as HTMLDivElement
    ;(component as unknown as { scrollToOffset: (px: number) => void }).scrollToOffset(360)
    expect(root.scrollTop).toBe(360)
  })

  it('scrollToIndex respects variable offsets', () => {
    const sizeAt = (i: number): number => (i % 2 === 0 ? 30 : 50)
    const { container, component } = render(IrisVirtualScroll, {
      props: { items, itemHeight: sizeAt, height: 400 },
    })
    const root = container.querySelector('[data-iris-virtual-scroll]') as HTMLDivElement
    // offset of index 4 = sizes[0..3] = 30+50+30+50 = 160.
    ;(component as unknown as { scrollToIndex: (i: number) => void }).scrollToIndex(4)
    expect(root.scrollTop).toBe(160)
  })

  it('supports variable item heights via a size function', () => {
    const sizeAt = (i: number): number => (i % 2 === 0 ? 30 : 50)
    const { container } = render(IrisVirtualScroll, {
      props: { items, itemHeight: sizeAt, height: 400 },
    })
    // total = 50*30 (even) + 50*50 (odd) = 1500 + 2500 = 4000
    const spacer = container.querySelector('[data-iris-virtual-spacer]') as HTMLElement
    expect(spacer.style.height).toBe('4000px')
    const rows = container.querySelectorAll('[data-iris-virtual-item]')
    expect((rows[0] as HTMLElement).style.transform).toMatch(/translateY\(0px\)/)
    expect((rows[0] as HTMLElement).style.height).toBe('30px')
    expect((rows[1] as HTMLElement).style.transform).toMatch(/translateY\(30px\)/)
    expect((rows[1] as HTMLElement).style.height).toBe('50px')
  })
})
