import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { usePaginatedResource } from './usePaginatedResource'
import type { PageQuery, PageResult } from '@iris-ui-kit/core'

function dataset(total: number) {
  const all = Array.from({ length: total }, (_, i) => i)
  return async ({ page, pageSize }: PageQuery): Promise<PageResult<number>> => {
    const start = (page - 1) * pageSize
    return { items: all.slice(start, start + pageSize), total }
  }
}

function probe(mode?: 'paged' | 'infinite') {
  return defineComponent({
    setup() {
      const p = usePaginatedResource(dataset(25), { pageSize: 10, mode, immediate: true })
      return () =>
        h('div', null, [
          h('span', { class: 'count' }, String(p.items.value.length)),
          h('span', { class: 'page' }, String(p.page.value)),
          h('span', { class: 'hasMore' }, String(p.hasMore.value)),
          h('button', { class: 'more', onClick: () => void p.loadMore() }, 'more'),
          h('button', { class: 'page2', onClick: () => void p.goToPage(2) }, 'page2'),
        ])
    },
  })
}

describe('@iris-ui-kit/vue usePaginatedResource', () => {
  it('immediate loads page 1', async () => {
    const wrapper = mount(probe())
    await flushPromises()
    expect(wrapper.find('.count').text()).toBe('10')
    expect(wrapper.find('.page').text()).toBe('1')
    expect(wrapper.find('.hasMore').text()).toBe('true')
  })

  it('loadMore appends and updates hasMore', async () => {
    const wrapper = mount(probe('infinite'))
    await flushPromises()
    expect(wrapper.find('.count').text()).toBe('10')
    await wrapper.find('.more').trigger('click')
    await flushPromises()
    expect(wrapper.find('.count').text()).toBe('20')
    await wrapper.find('.more').trigger('click')
    await flushPromises()
    expect(wrapper.find('.count').text()).toBe('25')
    expect(wrapper.find('.hasMore').text()).toBe('false')
  })

  it('goToPage replaces the visible page', async () => {
    const wrapper = mount(probe())
    await flushPromises()
    await wrapper.find('.page2').trigger('click')
    await flushPromises()
    expect(wrapper.find('.page').text()).toBe('2')
    expect(wrapper.find('.count').text()).toBe('10')
  })

  it('uses the latest fetcher from a ref for page loads', async () => {
    // AC2: reactive ref(fetcher) — every page load (goToPage AND refresh)
    // must use the fresh closure, still receiving the PageQuery; stale
    // closures are never re-invoked.
    const first = vi.fn(async () => ({ items: [1], total: 1 }))
    const second = vi.fn(async () => ({ items: [2], total: 1 }))
    const third = vi.fn(async () => ({ items: [3], total: 1 }))
    const fetcherRef = ref(first)
    const wrapper = mount(
      defineComponent({
        setup() {
          const p = usePaginatedResource(fetcherRef, { pageSize: 10 })
          return () =>
            h('div', null, [
              h('span', { class: 'items' }, p.items.value.join(',')),
              h('button', { class: 'page1', onClick: () => void p.goToPage(1) }, 'page1'),
              h('button', { class: 'refresh', onClick: () => void p.refresh() }, 'refresh'),
            ])
        },
      }),
    )
    // (1) first page load through the initial closure, receiving the PageQuery.
    await wrapper.find('.page1').trigger('click')
    await flushPromises()
    expect(wrapper.find('.items').text()).toBe('1')
    expect(first).toHaveBeenCalledTimes(1)
    expect(first).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 })

    // (2) ref swap → goToPage uses the fresh closure.
    fetcherRef.value = second
    await wrapper.find('.page1').trigger('click')
    await flushPromises()
    expect(wrapper.find('.items').text()).toBe('2')
    expect(second).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 })

    // (3) ref swap → refresh() replays through the fresh closure too.
    fetcherRef.value = third
    await wrapper.find('.refresh').trigger('click')
    await flushPromises()
    expect(wrapper.find('.items').text()).toBe('3')
    expect(third).toHaveBeenCalledTimes(1)

    // totals — no stale re-invocation on any path.
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    expect(third).toHaveBeenCalledTimes(1)
  })
})
