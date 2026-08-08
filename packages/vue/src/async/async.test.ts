import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
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

describe('@iris-ui-kit/vue useAsyncResource', () => {
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

  it('uses the latest fetcher from a ref for load and reload', async () => {
    // AC1: reactive ref(fetcher) — load() AND reload() must use the fresh
    // closure; stale closures are never re-invoked; swapping alone must NOT
    // auto-refetch (R5 negative).
    const first = vi.fn(async () => 'v1')
    const second = vi.fn(async () => 'v2')
    const third = vi.fn(async () => 'v3')
    const fourth = vi.fn(async () => 'v4')
    const fetcherRef = ref(first)
    const wrapper = mount(
      defineComponent({
        setup() {
          const r = useAsyncResource(fetcherRef, { immediate: true })
          return () =>
            h('div', null, [
              h('span', { class: 'data' }, r.data.value ?? '—'),
              h('button', { class: 'load', onClick: () => void r.load() }, 'load'),
              h('button', { class: 'reload', onClick: () => void r.reload() }, 'reload'),
            ])
        },
      }),
    )
    // (1) mount-time immediate load flows through the initial closure.
    await flushPromises()
    expect(wrapper.find('.data').text()).toBe('v1')
    expect(first).toHaveBeenCalledTimes(1)

    // (2) ref swap → load() uses the fresh closure.
    fetcherRef.value = second
    await wrapper.find('.load').trigger('click')
    await flushPromises()
    expect(wrapper.find('.data').text()).toBe('v2')
    expect(second).toHaveBeenCalledTimes(1)

    // (3) ref swap → reload() replays lastParams through the FRESH closure.
    fetcherRef.value = third
    await wrapper.find('.reload').trigger('click')
    await flushPromises()
    expect(wrapper.find('.data').text()).toBe('v3')
    expect(third).toHaveBeenCalledTimes(1)

    // (4) totals — no stale re-invocation on any path.
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    expect(third).toHaveBeenCalledTimes(1)

    // (5) negative (R5): swapping alone must NOT auto-refetch.
    fetcherRef.value = fourth
    await flushPromises()
    expect(fourth).toHaveBeenCalledTimes(0)
    expect(wrapper.find('.data').text()).toBe('v3')
  })

  it('uses the latest fetcher from a computed for reload', async () => {
    // ComputedRef IS a Ref: the sync watcher swaps the holder when the
    // computed's dep changes, so reload() uses the fresh closure.
    const first = vi.fn(async () => 'c1')
    const second = vi.fn(async () => 'c2')
    const mode = ref<'a' | 'b'>('a')
    const computedFetcher = computed(() => (mode.value === 'a' ? first : second))
    const wrapper = mount(
      defineComponent({
        setup() {
          const r = useAsyncResource(computedFetcher, { immediate: true })
          return () =>
            h('div', null, [
              h('span', { class: 'data' }, r.data.value ?? '—'),
              h('button', { class: 'reload', onClick: () => void r.reload() }, 'reload'),
            ])
        },
      }),
    )
    await flushPromises()
    expect(wrapper.find('.data').text()).toBe('c1')
    expect(first).toHaveBeenCalledTimes(1)

    mode.value = 'b'
    await wrapper.find('.reload').trigger('click')
    await flushPromises()
    expect(wrapper.find('.data').text()).toBe('c2')
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).toHaveBeenCalledTimes(1)
  })

  it('accepts ref/computed fetchers with inference flowing through (AC5 type pin)', async () => {
    // Runtime no-ops; they fail at type-check time if the widened union
    // parameter regresses (P widening / T collapsing to the fetcher type).
    const wrapper = mount(
      defineComponent({
        setup() {
          expectTypeOf(useAsyncResource(ref(async () => 'x'))).toEqualTypeOf<
            ReturnType<typeof useAsyncResource<string, []>>
          >()
          expectTypeOf(useAsyncResource(computed(() => async (id: string) => id))).toEqualTypeOf<
            ReturnType<typeof useAsyncResource<string, [string]>>
          >()
          return () => h('div', null, 'type pins')
        },
      }),
    )
    expect(wrapper.text()).toBe('type pins')
  })
})
