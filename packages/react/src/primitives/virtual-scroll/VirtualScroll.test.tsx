import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisVirtualScroll, type IrisVirtualScrollHandle } from './VirtualScroll'

afterEach(() => cleanup())

const items = Array.from({ length: 1000 }, (_, i) => ({ id: i, label: `Row ${i}` }))

function renderItem(item: { id: number; label: string }, _i: number) {
  return <span data-testid={`row-${item.id}`}>{item.label}</span>
}

function visibleItems(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-virtual-item]'))
}

describe('@iris-ui/react IrisVirtualScroll', () => {
  it('renders root with scrollable container + spacer', () => {
    const { container } = render(
      <IrisVirtualScroll items={items} itemHeight={40} height={400} renderItem={renderItem} />,
    )
    const root = container.querySelector('[data-iris-virtual-scroll]') as HTMLDivElement
    expect(root).not.toBeNull()
    expect(root.style.overflow).toBe('auto')
    const spacer = container.querySelector('[data-iris-virtual-spacer]') as HTMLDivElement
    expect(spacer.style.height).toBe(`${1000 * 40}px`)
  })

  it('renders only a window of items, not all 1000', () => {
    render(<IrisVirtualScroll items={items} itemHeight={40} height={400} renderItem={renderItem} />)
    // viewportHeight=400, itemHeight=40 → visibleCount=10, buffer=4 each side → range = 0..(0+10+4)=14
    // So <= 14 items mounted.
    expect(visibleItems().length).toBeLessThanOrEqual(14)
    expect(visibleItems().length).toBeGreaterThan(0)
  })

  it('items have absolute Y offset via transform', () => {
    render(<IrisVirtualScroll items={items} itemHeight={40} height={400} renderItem={renderItem} />)
    const first = visibleItems()[0] as HTMLElement
    expect(first.style.transform).toMatch(/translateY\(0px\)/)
  })

  it('scrolling updates the visible range (after RAF flush)', async () => {
    const onRange = vi.fn()
    const { container } = render(
      <IrisVirtualScroll
        items={items}
        itemHeight={40}
        height={400}
        onRangeChange={onRange}
        renderItem={renderItem}
      />,
    )
    const root = container.querySelector('[data-iris-virtual-scroll]') as HTMLDivElement
    act(() => {
      root.scrollTop = 800 // 800 / 40 = 20 → start ≈ 16
      fireEvent.scroll(root)
    })
    // Flush requestAnimationFrame.
    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
    })
    expect(onRange).toHaveBeenCalled()
    const firstIdx = Number(
      visibleItems()[0]?.getAttribute('data-iris-virtual-index'),
    )
    expect(firstIdx).toBeGreaterThan(10)
  })

  it('renderItem receives item + index', () => {
    const spy = vi.fn(renderItem)
    render(<IrisVirtualScroll items={items} itemHeight={40} height={400} renderItem={spy} />)
    expect(spy).toHaveBeenCalled()
    expect(spy.mock.calls[0]![1]).toBe(0) // first call gets index 0
  })

  it('keyOf sets stable keys', () => {
    const items2 = [{ id: 'a' }, { id: 'b' }]
    render(
      <IrisVirtualScroll
        items={items2}
        itemHeight={40}
        height={400}
        keyOf={(it) => it.id}
        renderItem={(it) => <span>{it.id}</span>}
      />,
    )
    expect(visibleItems().length).toBe(2)
  })

  it('imperative scrollToIndex sets scrollTop', () => {
    const ref = React.createRef<IrisVirtualScrollHandle>()
    const { container } = render(
      <IrisVirtualScroll
        ref={ref}
        items={items}
        itemHeight={40}
        height={400}
        renderItem={renderItem}
      />,
    )
    const root = container.querySelector('[data-iris-virtual-scroll]') as HTMLDivElement
    act(() => {
      ref.current?.scrollToIndex(50)
    })
    expect(root.scrollTop).toBe(50 * 40)
  })

  it('scrollToIndex align=end positions item at viewport bottom', () => {
    const ref = React.createRef<IrisVirtualScrollHandle>()
    const { container } = render(
      <IrisVirtualScroll
        ref={ref}
        items={items}
        itemHeight={40}
        height={400}
        renderItem={renderItem}
      />,
    )
    const root = container.querySelector('[data-iris-virtual-scroll]') as HTMLDivElement
    // jsdom doesn't compute clientHeight, so viewportHeight collapses to 0 after measure.
    // Formula then becomes 50*40 - 0 + 40 = 2040.
    act(() => {
      ref.current?.scrollToIndex(50, 'end')
    })
    expect(root.scrollTop).toBe(2040)
  })

  it('empty items renders nothing in spacer', () => {
    render(<IrisVirtualScroll items={[]} itemHeight={40} height={400} renderItem={renderItem} />)
    expect(visibleItems().length).toBe(0)
  })

  it('shrinking items does not throw; spacer adjusts', () => {
    const { rerender, container } = render(
      <IrisVirtualScroll
        items={items}
        itemHeight={40}
        height={400}
        renderItem={renderItem}
      />,
    )
    rerender(
      <IrisVirtualScroll
        items={items.slice(0, 5)}
        itemHeight={40}
        height={400}
        renderItem={renderItem}
      />,
    )
    const spacer = container.querySelector('[data-iris-virtual-spacer]') as HTMLDivElement
    expect(spacer.style.height).toBe(`${5 * 40}px`)
    expect(visibleItems().length).toBeLessThanOrEqual(5)
  })

  it('CSS length height passes through verbatim', () => {
    const { container } = render(
      <IrisVirtualScroll
        items={items}
        itemHeight={40}
        height="50vh"
        renderItem={renderItem}
      />,
    )
    const root = container.querySelector('[data-iris-virtual-scroll]') as HTMLDivElement
    expect(root.style.height).toBe('50vh')
  })
})
