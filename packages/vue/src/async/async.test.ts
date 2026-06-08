import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { useAsyncResource } from './useAsyncResource'

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function probe(fetcher: () => Promise<string>, immediate?: boolean) {
  return defineComponent({
    setup() {
      const r = useAsyncResource(fetcher, { immediate })
      return () =>
        h('div', null, [
          h('span', { class: 'status' }, r.status.value),
          h('span', { class: 'data' }, r.data.value ?? '—'),
          h('span', { class: 'loading' }, String(r.isLoading.value)),
          h('button', { class: 'load', onClick: () => void r.load() }, 'load'),
          h('button', { class: 'cancel', onClick: () => r.cancel() }, 'cancel'),
        ])
    },
  })
}

describe('@iris-ui/vue useAsyncResource', () => {
  it('starts idle and loads on demand', async () => {
    const wrapper = mount(probe(async () => 'hello'))
    expect(wrapper.find('.status').text()).toBe('idle')
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('.status').text()).toBe('success')
    expect(wrapper.find('.data').text()).toBe('hello')
  })

  it('immediate auto-loads on mount', async () => {
    const fetcher = vi.fn(async () => 'auto')
    const wrapper = mount(probe(fetcher, true))
    await flushPromises()
    expect(wrapper.find('.data').text()).toBe('auto')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('reflects the loading state while in flight', async () => {
    const d = deferred<string>()
    const wrapper = mount(probe(() => d.promise))
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('.loading').text()).toBe('true')
    d.resolve('done')
    await flushPromises()
    expect(wrapper.find('.loading').text()).toBe('false')
    expect(wrapper.find('.data').text()).toBe('done')
  })

  it('surfaces the error state', async () => {
    const wrapper = mount(
      probe(async () => {
        throw new Error('nope')
      }),
    )
    await wrapper.find('.load').trigger('click')
    await flushPromises()
    expect(wrapper.find('.status').text()).toBe('error')
  })

  it('cancel() aborts an in-flight load so its result is dropped', async () => {
    const d = deferred<string>()
    const wrapper = mount(probe(() => d.promise))
    await wrapper.find('.load').trigger('click')
    expect(wrapper.find('.loading').text()).toBe('true')
    await wrapper.find('.cancel').trigger('click')
    d.resolve('late')
    await flushPromises()
    // Cancel invalidates the in-flight token: the late result never lands.
    expect(wrapper.find('.status').text()).toBe('loading')
    expect(wrapper.find('.data').text()).toBe('—')
  })
})
