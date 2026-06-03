import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createTabsNav } from '@iris-ui/core'
import { useTabsNav } from './useTabsNav'

/** Mount a probe component that exposes the bridge's reactive state in the DOM. */
function probe(nav: ReturnType<typeof createTabsNav>) {
  const api: { value?: ReturnType<typeof useTabsNav> } = {}
  const Comp = defineComponent({
    setup() {
      const t = useTabsNav(nav)
      api.value = t
      return () =>
        h('div', [
          h('span', { 'data-active': '' }, t.activeKey.value ?? '—'),
          h('span', { 'data-keys': '' }, t.tabs.value.map((x) => x.key).join(',')),
          h('span', { 'data-cache': '' }, t.cacheKeys.value.join(',')),
        ])
    },
  })
  const w = mount(Comp)
  return { w, api: api.value! }
}

describe('useTabsNav', () => {
  it('reflects initial state', () => {
    const nav = createTabsNav({ tabs: [{ key: 'home', title: 'Home', pinned: true }] })
    const { w } = probe(nav)
    expect(w.find('[data-active]').text()).toBe('home')
    expect(w.find('[data-keys]').text()).toBe('home')
  })

  it('reacts to open / activate / close', async () => {
    const nav = createTabsNav()
    const { w, api } = probe(nav)
    api.open({ key: 'a', title: 'A' })
    await w.vm.$nextTick()
    expect(w.find('[data-keys]').text()).toBe('a')
    expect(w.find('[data-active]').text()).toBe('a')

    api.open({ key: 'b', title: 'B' })
    await w.vm.$nextTick()
    expect(w.find('[data-keys]').text()).toBe('a,b')
    expect(w.find('[data-active]').text()).toBe('b')

    api.close('b')
    await w.vm.$nextTick()
    expect(w.find('[data-keys]').text()).toBe('a')
    expect(w.find('[data-active]').text()).toBe('a')
  })

  it('exposes reactive keep-alive cacheKeys that bump on refresh', async () => {
    const nav = createTabsNav()
    const { w, api } = probe(nav)
    api.open({ key: 'a', title: 'A' })
    await w.vm.$nextTick()
    expect(w.find('[data-cache]').text()).toBe('a:0')
    api.refresh('a')
    await w.vm.$nextTick()
    expect(w.find('[data-cache]').text()).toBe('a:1')
  })
})
