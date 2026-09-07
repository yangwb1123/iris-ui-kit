import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { IrisVirtualScroll } from './IrisVirtualScroll'

afterEach(cleanup)

const items = Array.from({ length: 100 }, (_, i) => ({ id: i, label: `Item ${i}` }))

describe('IrisVirtualScroll', () => {
  it('renders without crashing', () => {
    const { container } = render(() => (
      <IrisVirtualScroll
        items={items}
        itemHeight={40}
        height={200}
        renderItem={(item) => <div>{(item as { label: string }).label}</div>}
      />
    ))
    expect(container.querySelector('[data-iris-virtual-scroll]')).not.toBeNull()
  })

  it('renders a spacer sized to total virtual height', () => {
    const { container } = render(() => (
      <IrisVirtualScroll
        items={items}
        itemHeight={40}
        height={200}
        renderItem={(item) => <div>{(item as { label: string }).label}</div>}
      />
    ))
    const spacer = container.querySelector('[data-iris-virtual-spacer]') as HTMLElement
    expect(spacer).not.toBeNull()
    expect(spacer.style.height).toBe(`${100 * 40}px`)
  })

  it('renders only a subset of items (virtual window)', () => {
    const { container } = render(() => (
      <IrisVirtualScroll
        items={items}
        itemHeight={40}
        height={200}
        buffer={0}
        renderItem={(item) => <div>{(item as { label: string }).label}</div>}
      />
    ))
    const rendered = container.querySelectorAll('[data-iris-virtual-item]')
    // Should not render all 100 items
    expect(rendered.length).toBeLessThan(100)
  })

  it('renders item content for visible items', () => {
    const { getByText } = render(() => (
      <IrisVirtualScroll
        items={[
          { id: 0, label: 'First item' },
          { id: 1, label: 'Second item' },
        ]}
        itemHeight={40}
        height={200}
        renderItem={(item) => <div>{(item as { label: string }).label}</div>}
      />
    ))
    expect(getByText('First item')).toBeTruthy()
  })

  it('keeps both fixed rows mounted when scrolling through a row boundary', async () => {
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(20)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    try {
      const { container } = render(() => (
        <IrisVirtualScroll
          items={[0, 1, 2]}
          itemHeight={20}
          height={20}
          buffer={0}
          renderItem={(item) => <div>{item}</div>}
        />
      ))
      const viewport = container.querySelector('[data-iris-virtual-scroll]') as HTMLDivElement
      viewport.scrollTop = 10
      viewport.dispatchEvent(new Event('scroll'))
      await Promise.resolve()
      expect(
        Array.from(container.querySelectorAll('[data-iris-virtual-index]')).map((node) =>
          Number(node.getAttribute('data-iris-virtual-index')),
        ),
      ).toEqual([0, 1])
    } finally {
      height.mockRestore()
      vi.unstubAllGlobals()
    }
  })

  it('does not reuse an auto measurement by index after a keyed reorder', async () => {
    const clientHeight = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(60)
    const rows = [
      { id: 'a', height: 20 },
      { id: 'b', height: 100 },
      { id: 'c', height: 20 },
    ]
    const [currentRows, setRows] = createSignal(rows)
    const ros: Array<{ els: Element[]; flush: (els?: Element[]) => void }> = []
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
    vi.stubGlobal('ResizeObserver', MockRO)
    const heightSpy = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() {
        const id = (this as HTMLElement).querySelector('[data-row-id]')?.getAttribute('data-row-id')
        return rows.find((row) => row.id === id)?.height ?? 20
      },
    })

    try {
      const { container } = render(() => (
        <IrisVirtualScroll
          items={currentRows()}
          itemHeight="auto"
          estimatedItemHeight={20}
          height={60}
          buffer={0}
          keyOf={(row) => row.id}
          renderItem={(row) => <span data-row-id={row.id}>{row.id}</span>}
        />
      ))
      await Promise.resolve()
      const rowRo = ros.find((r) =>
        r.els.some((e) => (e as HTMLElement).hasAttribute('data-iris-virtual-item')),
      )
      const b = container.querySelector('[data-iris-virtual-index="1"]') as HTMLElement
      expect(rowRo).toBeTruthy()
      rowRo!.flush([b])
      await Promise.resolve()
      expect(
        container.querySelector('[data-iris-virtual-spacer]')?.getAttribute('style'),
      ).toContain('height: 140px')

      setRows([rows[0]!, rows[2]!, { id: 'd', height: 20 }])
      await Promise.resolve()
      await Promise.resolve()
      expect(
        container.querySelector('[data-iris-virtual-spacer]')?.getAttribute('style'),
      ).toContain('height: 60px')
    } finally {
      if (heightSpy) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', heightSpy)
      clientHeight.mockRestore()
      vi.unstubAllGlobals()
    }
  })
})
