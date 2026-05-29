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
    const firstIdx = Number(visibleItems()[0]?.getAttribute('data-iris-virtual-index'))
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
      <IrisVirtualScroll items={items} itemHeight={40} height={400} renderItem={renderItem} />,
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

  it('supports variable item heights via a size function', () => {
    const sizeAt = (i: number) => (i % 2 === 0 ? 30 : 50)
    const { container } = render(
      <IrisVirtualScroll items={items} itemHeight={sizeAt} height={400} renderItem={renderItem} />,
    )
    // total = 500*30 (even) + 500*50 (odd) = 40000
    const spacer = container.querySelector('[data-iris-virtual-spacer]') as HTMLDivElement
    expect(spacer.style.height).toBe('40000px')
    const rows = visibleItems()
    expect((rows[0] as HTMLElement).style.transform).toMatch(/translateY\(0px\)/)
    expect((rows[0] as HTMLElement).style.height).toBe('30px')
    // second row starts after the first's 30px and is 50px tall
    expect((rows[1] as HTMLElement).style.transform).toMatch(/translateY\(30px\)/)
    expect((rows[1] as HTMLElement).style.height).toBe('50px')
  })

  it('scrollToIndex respects variable offsets', () => {
    const ref = React.createRef<IrisVirtualScrollHandle>()
    const sizeAt = (i: number) => (i % 2 === 0 ? 30 : 50)
    const { container } = render(
      <IrisVirtualScroll
        ref={ref}
        items={items}
        itemHeight={sizeAt}
        height={400}
        renderItem={renderItem}
      />,
    )
    const root = container.querySelector('[data-iris-virtual-scroll]') as HTMLDivElement
    // offset of index 4 = sizes[0..3] = 30+50+30+50 = 160
    act(() => {
      ref.current?.scrollToIndex(4)
    })
    expect(root.scrollTop).toBe(160)
  })

  it('CSS length height passes through verbatim', () => {
    const { container } = render(
      <IrisVirtualScroll items={items} itemHeight={40} height="50vh" renderItem={renderItem} />,
    )
    const root = container.querySelector('[data-iris-virtual-scroll]') as HTMLDivElement
    expect(root.style.height).toBe('50vh')
  })
})

describe('@iris-ui/react IrisVirtualScroll auto-measure', () => {
  it('measures rendered rows via ResizeObserver and applies their heights', () => {
    // Mock ResizeObserver to capture observed rows + trigger the callback.
    const ros: Array<{ cb: ResizeObserverCallback; els: Element[]; flush: () => void }> = []
    const RealRO = globalThis.ResizeObserver
    class MockRO {
      els: Element[] = []
      constructor(public cb: ResizeObserverCallback) {
        ros.push({ cb, els: this.els, flush: () => this.flush() })
      }
      observe(el: Element) {
        this.els.push(el)
      }
      unobserve(el: Element) {
        this.els = this.els.filter((e) => e !== el)
      }
      disconnect() {
        this.els = []
      }
      flush() {
        this.cb(
          this.els.map((target) => ({ target }) as ResizeObserverEntry),
          this as never,
        )
      }
    }
    globalThis.ResizeObserver = MockRO as unknown as typeof ResizeObserver
    // jsdom reports offsetHeight 0; pretend every row is 50px tall.
    const heightSpy = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get: () => 50,
    })

    try {
      render(
        <IrisVirtualScroll
          items={items}
          itemHeight="auto"
          estimatedItemHeight={40}
          height={400}
          renderItem={renderItem}
        />,
      )
      // Find the observer watching rendered rows (not the viewport observer).
      const rowRo = ros.find((r) =>
        r.els.some((e) => (e as HTMLElement).hasAttribute('data-iris-virtual-item')),
      )
      expect(rowRo).toBeTruthy()
      // Before measuring, index 1 sits at the 40px estimate.
      const item1 = () =>
        document.querySelector('[data-iris-virtual-index="1"]') as HTMLElement | null
      expect(item1()?.style.transform).toBe('translateY(40px)')
      // Flush measurements (50px each) → offsets recompute, index 1 moves to 50px.
      act(() => {
        rowRo!.flush()
      })
      expect(item1()?.style.transform).toBe('translateY(50px)')
    } finally {
      if (heightSpy) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', heightSpy)
      globalThis.ResizeObserver = RealRO
    }
  })
})
