import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
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
})
