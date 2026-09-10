import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisVirtualScroll } from './VirtualScroll'

enableAutoUnmount(afterEach)

const items = Array.from({ length: 1000 }, (_, i) => ({ id: i, label: `Row ${i}` }))

function Harness(extra: Record<string, unknown> = {}) {
  return defineComponent({
    setup() {
      return () =>
        h(
          IrisVirtualScroll,
          { items, itemHeight: 40, height: 200, buffer: 2, ...extra },
          {
            item: ({ item, index }: { item: { id: number; label: string }; index: number }) =>
              h('div', { class: 'row', 'data-id': item.id }, `${index}:${item.label}`),
          },
        )
    },
  })
}

describe('IrisVirtualScroll', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => {
    host.remove()
  })

  it('renders only the visible window plus buffer', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    await nextTick()
    // viewportHeight=200, itemHeight=40 → visibleCount=5, buffer=2
    // start=0, end = 0 + 5 + 2 = 7 items
    const rendered = wrapper.findAll('[data-iris-virtual-item]')
    expect(rendered.length).toBeLessThanOrEqual(7)
    expect(rendered.length).toBeGreaterThan(0)
  })

  it('spacer height = items.length × itemHeight', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    await nextTick()
    const spacer = wrapper.find('[data-iris-virtual-spacer]')
    expect(spacer.attributes('style')).toContain('height: 40000px')
  })

  it('positions items at the correct Y offset via translateY', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    await nextTick()
    const first = wrapper.find('[data-iris-virtual-item]')
    const style = first.attributes('style') ?? ''
    expect(style).toContain('translateY(0px)')
  })

  it('empty items list renders nothing inside the spacer', async () => {
    const Empty = defineComponent({
      setup() {
        return () =>
          h(
            IrisVirtualScroll,
            { items: [], itemHeight: 40, height: 200 },
            {
              item: () => h('div'),
            },
          )
      },
    })
    const wrapper = mount(Empty, { attachTo: host })
    await nextTick()
    expect(wrapper.findAll('[data-iris-virtual-item]').length).toBe(0)
  })

  it('emits scroll with the new scrollTop', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    await nextTick()
    const viewport = wrapper.find('[data-iris-virtual-scroll]').element as HTMLElement
    Object.defineProperty(viewport, 'scrollTop', { value: 800, writable: true, configurable: true })
    viewport.dispatchEvent(new Event('scroll'))
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    await nextTick()
    expect(wrapper.emitted('scroll')).toBeTruthy()
  })

  it('range shifts forward when scrolled — visible items reflect new window', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    await nextTick()
    const viewport = wrapper.find('[data-iris-virtual-scroll]').element as HTMLElement
    Object.defineProperty(viewport, 'scrollTop', {
      value: 800,
      writable: true,
      configurable: true,
    })
    viewport.dispatchEvent(new Event('scroll'))
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    await nextTick()
    await nextTick()
    const indices = wrapper
      .findAll('[data-iris-virtual-item]')
      .map((el) => Number(el.attributes('data-iris-virtual-index')))
    // Scrolled past row 20 (800 / 40) — index 0 should no longer be in the visible window.
    expect(indices.length).toBeGreaterThan(0)
    expect(Math.min(...indices)).toBeGreaterThan(10)
  })

  it('keeps both fixed rows mounted when scrolling through a row boundary', async () => {
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(20)
    try {
      const Boundary = defineComponent({
        setup() {
          return () =>
            h(
              IrisVirtualScroll,
              { items: [0, 1, 2], itemHeight: 20, height: 20, buffer: 0 },
              { item: ({ item }: { item: number }) => h('span', String(item)) },
            )
        },
      })
      const wrapper = mount(Boundary, { attachTo: host })
      await nextTick()
      const viewport = wrapper.find('[data-iris-virtual-scroll]').element as HTMLElement
      Object.defineProperty(viewport, 'scrollTop', {
        value: 10,
        writable: true,
        configurable: true,
      })
      viewport.dispatchEvent(new Event('scroll'))
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      await nextTick()
      expect(
        wrapper
          .findAll('[data-iris-virtual-index]')
          .map((el) => Number(el.attributes('data-iris-virtual-index'))),
      ).toEqual([0, 1])
    } finally {
      height.mockRestore()
    }
  })

  it('exposes scrollToIndex via expose', async () => {
    const exposedRef = ref<unknown>(null)
    const Holder = defineComponent({
      setup() {
        return () =>
          h(IrisVirtualScroll, {
            items,
            itemHeight: 40,
            height: 200,
            ref: (el: unknown) => (exposedRef.value = el),
          })
      },
    })
    mount(Holder, { attachTo: host })
    await nextTick()
    const exposed = exposedRef.value as { scrollToIndex: (i: number) => void } | null
    expect(typeof exposed?.scrollToIndex).toBe('function')
  })

  it('keyOf is used to compute child keys when supplied', async () => {
    const wrapper = mount(
      defineComponent({
        setup() {
          return () =>
            h(
              IrisVirtualScroll,
              {
                items,
                itemHeight: 40,
                height: 200,
                keyOf: (item: unknown) => (item as { id: number }).id,
              },
              {
                item: ({ item }: { item: { id: number } }) =>
                  h('div', { class: 'row', 'data-id': item.id }),
              },
            )
        },
      }),
      { attachTo: host },
    )
    await nextTick()
    // Visual key isn't observable, but render mustn't crash and IDs must show up.
    expect(wrapper.findAll('[data-id]').length).toBeGreaterThan(0)
  })

  it('supports variable item heights via a size function', async () => {
    const sizeAt = (i: number) => (i % 2 === 0 ? 30 : 50)
    const wrapper = mount(Harness({ itemHeight: sizeAt }), { attachTo: host })
    await nextTick()
    // total = 500*30 (even) + 500*50 (odd) = 40000
    expect(wrapper.find('[data-iris-virtual-spacer]').attributes('style')).toContain(
      'height: 40000px',
    )
    const rows = wrapper.findAll('[data-iris-virtual-item]')
    expect(rows[0]!.attributes('style')).toContain('translateY(0px)')
    expect(rows[0]!.attributes('style')).toContain('height: 30px')
    expect(rows[1]!.attributes('style')).toContain('translateY(30px)')
    expect(rows[1]!.attributes('style')).toContain('height: 50px')
  })
})

describe('IrisVirtualScroll auto-measure', () => {
  it('measures rendered rows via ResizeObserver and applies their heights', async () => {
    const ros: Array<{ els: Element[]; flush: () => void }> = []
    const RealRO = globalThis.ResizeObserver
    class MockRO {
      els: Element[] = []
      constructor(public cb: ResizeObserverCallback) {
        ros.push({ els: this.els, flush: () => this.flush() })
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
    const heightSpy = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get: () => 50,
    })

    try {
      const wrapper = mount(Harness({ itemHeight: 'auto', estimatedItemHeight: 40 }))
      await nextTick()
      const row1 = () => wrapper.find('[data-iris-virtual-index="1"]')
      expect(row1().attributes('style')).toContain('translateY(40px)')
      const rowRo = ros.find((r) =>
        r.els.some((e) => (e as HTMLElement).hasAttribute('data-iris-virtual-item')),
      )
      expect(rowRo).toBeTruthy()
      rowRo!.flush()
      await nextTick()
      expect(row1().attributes('style')).toContain('translateY(50px)')
    } finally {
      if (heightSpy) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', heightSpy)
      globalThis.ResizeObserver = RealRO
    }
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
        const id = this.querySelector<HTMLElement>('[data-row-id]')?.dataset.rowId
        return rows.find((row) => row.id === id)?.height ?? 20
      },
    })

    try {
      const wrapper = mount(IrisVirtualScroll, {
        props: {
          items: rows,
          itemHeight: 'auto',
          estimatedItemHeight: 20,
          height: 60,
          buffer: 0,
          keyOf: (row: unknown) => (row as { id: string }).id,
        },
        slots: {
          item: ({ item }: { item: (typeof rows)[number] }) =>
            h('span', { 'data-row-id': item.id }, item.id),
        },
      })
      await nextTick()
      const rowRo = ros.find((r) =>
        r.els.some((e) => (e as HTMLElement).hasAttribute('data-iris-virtual-item')),
      )
      const b = wrapper.find('[data-iris-virtual-index="1"]').element
      expect(rowRo).toBeTruthy()
      rowRo!.flush([b])
      await nextTick()
      expect(wrapper.find('[data-iris-virtual-spacer]').attributes('style')).toContain(
        'height: 140px',
      )

      await wrapper.setProps({ items: [rows[0]!, rows[2]!, { id: 'd', height: 20 }] })
      expect(wrapper.find('[data-iris-virtual-spacer]').attributes('style')).toContain(
        'height: 60px',
      )
    } finally {
      if (heightSpy) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', heightSpy)
      clientHeight.mockRestore()
      globalThis.ResizeObserver = RealRO
    }
  })
})
