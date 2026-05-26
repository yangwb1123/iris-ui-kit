import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
          h(IrisVirtualScroll, { items: [], itemHeight: 40, height: 200 }, {
            item: () => h('div'),
          })
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
})
