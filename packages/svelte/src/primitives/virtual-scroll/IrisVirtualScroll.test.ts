import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import { tick } from 'svelte'
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

  it('keeps both fixed rows mounted when scrolling through a row boundary', async () => {
    const { container } = render(IrisVirtualScroll, {
      props: { items: [0, 1, 2], itemHeight: 20, height: 20, buffer: 0 },
    })
    const viewport = container.querySelector('[data-iris-virtual-scroll]') as HTMLDivElement
    viewport.scrollTop = 10
    viewport.dispatchEvent(new Event('scroll'))
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
    await tick()
    expect(
      Array.from(container.querySelectorAll('[data-iris-virtual-index]')).map((node) =>
        Number(node.getAttribute('data-iris-virtual-index')),
      ),
    ).toEqual([0, 1])
  })

  it('does not reuse an auto measurement by index after a keyed reorder', async () => {
    const clientHeight = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(60)
    const rows = [
      { id: 'a', height: 20 },
      { id: 'b', height: 100 },
      { id: 'c', height: 20 },
    ]
    const ros: Array<{ els: Element[]; flush: (els?: Element[]) => void }> = []
    const RealRO = globalThis.ResizeObserver
    class MockRO {
      els: Element[] = []
      constructor(public cb: ResizeObserverCallback) {
        ros.push({ els: this.els, flush: (els = this.els) => this.flush(els) })
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
      flush(els = this.els) {
        this.cb(
          els.map((target) => ({ target }) as ResizeObserverEntry),
          this as never,
        )
      }
    }
    globalThis.ResizeObserver = MockRO as unknown as typeof ResizeObserver
    const heightSpy = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() {
        const index = Number((this as HTMLElement).dataset.irisVirtualIndex)
        return rows[index]?.height ?? 20
      },
    })

    try {
      const { container, rerender } = render(IrisVirtualScroll, {
        props: {
          items: rows,
          itemHeight: 'auto',
          estimatedItemHeight: 20,
          height: 60,
          buffer: 0,
          keyOf: (row: unknown) => (row as { id: string }).id,
        },
      })
      await tick()
      const rowRo = ros.find((r) =>
        r.els.some((e) => (e as HTMLElement).hasAttribute('data-iris-virtual-item')),
      )
      const b = container.querySelector('[data-iris-virtual-index="1"]') as HTMLElement
      expect(rowRo).toBeTruthy()
      expect(b.offsetHeight).toBe(100)
      rowRo!.flush([b])
      await tick()
      expect(
        container.querySelector('[data-iris-virtual-spacer]')?.getAttribute('style'),
      ).toContain('height: 140px')

      await rerender({
        items: [rows[0]!, rows[2]!, { id: 'd', height: 20 }],
        itemHeight: 'auto',
        estimatedItemHeight: 20,
        height: 60,
        buffer: 0,
        keyOf: (row: unknown) => (row as { id: string }).id,
      })
      expect(
        container.querySelector('[data-iris-virtual-spacer]')?.getAttribute('style'),
      ).toContain('height: 60px')
    } finally {
      if (heightSpy) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', heightSpy)
      clientHeight.mockRestore()
      globalThis.ResizeObserver = RealRO
    }
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
    // A configured numeric viewport remains authoritative when jsdom reports a
    // zero layout height: 50*40 - 400 + 40 = 1640.
    ;(component as unknown as { scrollToIndex: (i: number, a: 'end') => void }).scrollToIndex(
      50,
      'end',
    )
    expect(root.scrollTop).toBe(1640)
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

  it('remeasures live item, sizing, key, and viewport props after rerender', async () => {
    const small = items.slice(0, 4)
    const { container, component, rerender } = render(IrisVirtualScroll, {
      props: {
        items: small,
        itemHeight: () => 10,
        height: 20,
        buffer: 0,
        keyOf: (item) => (item as { id: number }).id,
      },
    })
    const spacer = container.querySelector('[data-iris-virtual-spacer]') as HTMLElement
    expect(spacer.style.height).toBe('40px')

    const reversed = [...small].reverse()
    await rerender({
      items: reversed,
      itemHeight: () => 25,
      height: 50,
      buffer: 0,
      keyOf: (item) => `row-${(item as { id: number }).id}`,
    })
    expect(spacer.style.height).toBe('100px')
    expect(
      (container.querySelector('[data-iris-virtual-scroll]') as HTMLElement).style.height,
    ).toBe('50px')
    ;(
      component as unknown as { scrollToIndex: (index: number, align: 'end') => void }
    ).scrollToIndex(3, 'end')
    expect((container.querySelector('[data-iris-virtual-scroll]') as HTMLElement).scrollTop).toBe(
      50,
    )
  })
})
