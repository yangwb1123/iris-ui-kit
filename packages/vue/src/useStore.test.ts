import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createStore } from '@iris-ui-kit/core'
import { useStoreSelector } from './useStore'

describe('useStoreSelector (vue)', () => {
  it('the ref updates only when the selected slice changes', async () => {
    const store = createStore({ a: 0, b: 0 })
    let aRef!: { value: number }
    const Probe = defineComponent({
      setup() {
        aRef = useStoreSelector(store, (s) => s.a)
        return () => h('div', String(aRef.value))
      },
    })
    const wrapper = mount(Probe)
    expect(aRef.value).toBe(0)

    store.setState((s) => ({ ...s, b: 1 })) // unrelated
    await nextTick()
    expect(aRef.value).toBe(0)

    store.setState((s) => ({ ...s, a: 9 }))
    await nextTick()
    expect(aRef.value).toBe(9)
    expect(wrapper.text()).toBe('9')

    // detaches on unmount (onScopeDispose) — no throw after.
    wrapper.unmount()
    expect(() => store.setState((s) => ({ ...s, a: 11 }))).not.toThrow()
  })
})
