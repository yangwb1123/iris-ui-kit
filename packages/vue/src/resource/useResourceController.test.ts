import { describe, expect, it, vi } from 'vitest'
import { defineComponent, effectScope, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import type { ResourceQuery } from '@iris-ui-kit/core'
import { useResourceController, type UseResourceController } from './useResourceController'

interface Row {
  id: number
  name: string
}

const data: Row[] = [
  { id: 1, name: 'Charlie' },
  { id: 2, name: 'Alice' },
  { id: 3, name: 'Bob' },
]

/** Fetcher resolving after a microtask (never synchronously). */
function resolvingFetcher(rows: Row[], total: number) {
  return vi.fn(async (_query: ResourceQuery) => {
    await Promise.resolve()
    return { rows, total }
  })
}

/**
 * Mount a probe that exposes the bridge return and the `loading` value seeded
 * in `setup()`. Settles the onMounted load unless `opts.settle === false` (for
 * tests that need to control resolution).
 */
async function mountResource(
  config: Parameters<typeof useResourceController<Row>>[0],
  opts?: { settle?: boolean },
) {
  let resource!: UseResourceController<Row>
  let seedLoading!: boolean
  const Probe = defineComponent({
    setup() {
      resource = useResourceController<Row>(config)
      seedLoading = resource.state.value.loading
      return () => h('div', String(resource.state.value.rows.length))
    },
  })
  const wrapper = mount(Probe)
  // mount() runs onMounted synchronously — capture the mirror's value before
  // any microtask settles the load.
  const postMountLoading = resource.state.value.loading
  if (opts?.settle !== false) {
    await flushPromises()
    await nextTick()
  }
  return {
    wrapper,
    get: () => resource,
    getSeedLoading: () => seedLoading,
    getPostMountLoading: () => postMountLoading,
  }
}

describe('useResourceController (vue)', () => {
  it('AC2-p1: defers the initial load to onMounted — seed loading is false in setup, exactly one fetch fires', async () => {
    const fetcher = resolvingFetcher(data, data.length)
    const { wrapper, get, getSeedLoading, getPostMountLoading } = await mountResource({
      fetcher,
      pageSize: 10,
    })

    // Discriminator: the raw-config bridge fired the fetch during setup() and
    // committed `loading: true` synchronously; the fixed bridge seeds from the
    // untouched controller state.
    expect(getSeedLoading()).toBe(false)

    // mount() ran onMounted synchronously, so the load was kicked but not
    // settled right after mount (the sync `loading` commit is visible).
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(getPostMountLoading()).toBe(true)

    await flushPromises()
    await nextTick()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(get().state.value.loading).toBe(false)
    expect(get().state.value.rows).toEqual(data)
    expect(get().state.value.total).toBe(data.length)
    wrapper.unmount()
  })

  it('AC2-p2: unmount aborts an in-flight reload; the late rejection never writes back', async () => {
    const fetcher = resolvingFetcher(data, data.length)
    const { wrapper, get } = await mountResource({ fetcher, pageSize: 10 })
    expect(get().state.value.loading).toBe(false)
    expect(get().state.value.rows).toEqual(data)

    // Swap the fetcher to a manually-controlled deferred for the reload.
    let rejectReload!: (error: Error) => void
    fetcher.mockImplementation(
      () =>
        new Promise<{ rows: Row[]; total: number }>((_resolve, reject) => {
          rejectReload = reject
        }),
    )

    const p = get().reload()
    // The mirror subscription is live: the synchronous `loading` commit is seen.
    expect(get().state.value.loading).toBe(true)
    const snapshot = { ...get().state.value }

    wrapper.unmount() // onScopeDispose → controller.destroy(): epoch bump + abort

    rejectReload(new Error('boom'))
    // Late rejection is swallowed by the epoch/abort guards — the promise
    // settles without rejecting (also proves no unhandled rejection).
    await expect(p).resolves.toBeUndefined()
    await flushPromises()
    await nextTick()

    // No post-unmount state write: the ref keeps the unmount-time snapshot
    // (core destroy() aborts + bumps epoch but never resets `loading`).
    expect(get().state.value).toEqual(snapshot)
    expect(get().state.value.error).toBeUndefined()
  })

  it('immediate: false defers the first load to an explicit call (no mount fetch)', async () => {
    const fetcher = resolvingFetcher(data, data.length)
    const { wrapper, get } = await mountResource({ fetcher, pageSize: 10, immediate: false })
    // Explicit opt-out: no onMounted registration, so nothing fires on mount.
    expect(fetcher).not.toHaveBeenCalled()
    expect(get().state.value.loading).toBe(false)
    expect(get().state.value.rows).toEqual([])

    await get().load()
    await flushPromises()
    await nextTick()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(get().state.value.rows).toEqual(data)
    wrapper.unmount()
  })

  it('AC3: effectScope disposal aborts the in-flight fetch and detaches the mirror, warning-free', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      let rejectLoad!: (error: Error) => void
      const fetcher = vi.fn(
        () =>
          new Promise<{ rows: Row[]; total: number }>((_resolve, reject) => {
            rejectLoad = reject
          }),
      )

      let ctrl!: UseResourceController<Row>
      const scope = effectScope()
      scope.run(() => {
        ctrl = useResourceController<Row>({ fetcher, pageSize: 10, immediate: false })
      })
      // explicit immediate: false + manual load keeps the test warning-free —
      // the onMounted path is covered by the mount tests above.
      expect(ctrl.state.value.loading).toBe(false)

      const p = ctrl.load()
      expect(ctrl.state.value.loading).toBe(true)
      expect(ctrl.getState().loading).toBe(true)

      scope.stop() // onScopeDispose → controller.destroy(): abort + epoch bump + mirror detach

      const snapshot = { ...ctrl.state.value }
      rejectLoad(new Error('boom'))
      await expect(p).resolves.toBeUndefined()
      await flushPromises()

      // Abort guard: the rejection never lands in the store…
      expect(ctrl.getState().error).toBeUndefined()
      // …nor in the mirror ref (unmount-time snapshot retained).
      expect(ctrl.state.value).toEqual(snapshot)

      // Unsubscribe proof: a reload after scope.stop() updates the controller
      // (core destroy is safe to load again) but not the detached ref.
      fetcher.mockImplementation(async () => {
        await Promise.resolve()
        return { rows: data, total: data.length }
      })
      await ctrl.reload()
      expect(ctrl.getState().rows).toEqual(data)
      expect(ctrl.getState().total).toBe(data.length)
      expect(ctrl.state.value).toEqual(snapshot)

      // With the old onBeforeUnmount wiring this would emit the "no active
      // component instance" dev warning; onScopeDispose must not.
      expect(
        warnSpy.mock.calls.some((c) => String(c[0]).includes('no active component instance')),
      ).toBe(false)
    } finally {
      warnSpy.mockRestore()
    }
  })
})
