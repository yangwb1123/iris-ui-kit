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

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function probe(
  mode?: 'paged' | 'infinite',
  fetcher: (query: PageQuery, signal?: AbortSignal) => Promise<PageResult<number>> = dataset(25),
  immediate = true,
) {
  return defineComponent({
    setup() {
      const p = usePaginatedResource(fetcher, { pageSize: 10, mode, immediate })
      return () =>
        h('div', null, [
          h('span', { class: 'count' }, String(p.items.value.length)),
          h('span', { class: 'page' }, String(p.page.value)),
          h('span', { class: 'first' }, String(p.items.value[0] ?? '—')),
          h('span', { class: 'status' }, p.status.value),
          h('span', { class: 'hasMore' }, String(p.hasMore.value)),
          h('button', { class: 'more', onClick: () => void p.loadMore() }, 'more'),
          h('button', { class: 'page2', onClick: () => void p.goToPage(2) }, 'page2'),
          h('button', { class: 'cancel', onClick: () => p.cancel() }, 'cancel'),
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

  it('paged mode makes loadMore replace the visible page', async () => {
    const wrapper = mount(probe('paged'))
    await flushPromises()
    expect(wrapper.find('.first').text()).toBe('0')
    await wrapper.find('.more').trigger('click')
    await flushPromises()
    expect(wrapper.find('.page').text()).toBe('2')
    expect(wrapper.find('.count').text()).toBe('10')
    expect(wrapper.find('.first').text()).toBe('10')
  })

  it('forwards the signal and cancels the request on unmount', async () => {
    const d = deferred<PageResult<number>>()
    let signal: AbortSignal | undefined
    const fetcher = vi.fn((_query: PageQuery, nextSignal?: AbortSignal) => {
      signal = nextSignal
      return d.promise
    })
    const wrapper = mount(probe(undefined, fetcher))
    await flushPromises()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(signal).toBeInstanceOf(AbortSignal)
    wrapper.unmount()
    expect(signal?.aborted).toBe(true)
    d.resolve({ items: [1] })
    await flushPromises()
  })

  it('exposes a retryable cancel state', async () => {
    const first = deferred<PageResult<number>>()
    const second = deferred<PageResult<number>>()
    let call = 0
    const fetcher = vi.fn((_query: PageQuery, _signal?: AbortSignal) =>
      ++call === 1 ? first.promise : second.promise,
    )
    const wrapper = mount(probe(undefined, fetcher, false))
    await wrapper.find('.more').trigger('click')
    expect(fetcher).toHaveBeenCalledTimes(1)
    await wrapper.find('.cancel').trigger('click')
    expect(wrapper.find('.status').text()).toBe('idle')
    await wrapper.find('.more').trigger('click')
    expect(fetcher).toHaveBeenCalledTimes(2)
    second.resolve({ items: [2], total: 2 })
    await flushPromises()
    expect(wrapper.find('.status').text()).toBe('success')
    first.resolve({ items: [1], total: 2 })
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
    expect(first.mock.lastCall?.[0]).toEqual({ page: 1, pageSize: 10 })

    // (2) ref swap → goToPage uses the fresh closure.
    fetcherRef.value = second
    await wrapper.find('.page1').trigger('click')
    await flushPromises()
    expect(wrapper.find('.items').text()).toBe('2')
    expect(second).toHaveBeenCalledTimes(1)
    expect(second.mock.lastCall?.[0]).toEqual({ page: 1, pageSize: 10 })

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
