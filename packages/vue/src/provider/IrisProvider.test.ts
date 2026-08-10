import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPlugin } from '@iris-ui-kit/core'
import { IrisProvider } from './IrisProvider'
import { usePlugin, usePluginStore } from './hooks'

interface ExampleStore {
  greeting: string
}

// An inline reference plugin that exercises all three registration sinks.
const examplePlugin = createPlugin({
  name: 'example',
  install(reg) {
    reg.registerTokens({ '--iris-example': '#abcdef' })
    reg.registerMessages('zh-CN', { 'pagination.next': '下一页' })
    reg.registerStore('example', (): ExampleStore => ({ greeting: 'hi' }))
  },
})

const Probe = defineComponent({
  setup() {
    const store = usePluginStore<ExampleStore>('example')
    return () =>
      h('div', null, [
        h('span', { class: 'store' }, store.greeting),
        h('span', { class: 'has' }, String(usePlugin('example'))),
        h('span', { class: 'nope' }, String(usePlugin('nope'))),
      ])
  },
})

function withProvider() {
  return defineComponent({
    setup() {
      return () => h(IrisProvider, { plugins: [examplePlugin] }, { default: () => h(Probe) })
    },
  })
}

describe('@iris-ui-kit/vue IrisProvider', () => {
  it('exposes plugin stores via usePluginStore', () => {
    const wrapper = mount(withProvider())
    expect(wrapper.find('.store').text()).toBe('hi')
    wrapper.unmount()
  })

  it('reports installed plugins via usePlugin', () => {
    const wrapper = mount(withProvider())
    expect(wrapper.find('.has').text()).toBe('true')
    expect(wrapper.find('.nope').text()).toBe('false')
    wrapper.unmount()
  })

  it('applies plugin tokens to documentElement while mounted, reverting on unmount', () => {
    const wrapper = mount(withProvider())
    expect(document.documentElement.style.getPropertyValue('--iris-example')).toBe('#abcdef')
    wrapper.unmount()
    expect(document.documentElement.style.getPropertyValue('--iris-example')).toBe('')
  })

  it('throws a clear error when usePluginStore is used without a provider', () => {
    expect(() => mount(Probe)).toThrow(/usePluginStore\("example"\): no <IrisProvider>/)
  })

  it('runs plugin teardowns on unmount', () => {
    const teardown = vi.fn()
    const plugin = createPlugin({
      name: 'teardown-probe',
      install(reg) {
        reg.onTeardown(teardown)
      },
    })
    const wrapper = mount(
      defineComponent({
        setup() {
          return () => h(IrisProvider, { plugins: [plugin] }, { default: () => null })
        },
      }),
    )
    expect(teardown).not.toHaveBeenCalled()
    wrapper.unmount()
    expect(teardown).toHaveBeenCalledTimes(1)
  })
})

// --- plugins-prop swap fixtures (four-framework parity: React useMemo / Solid
// createMemo / Svelte $derived all re-collect on a `plugins` identity change). ---
const teardownA = vi.fn()
const pluginA = createPlugin({
  name: 'a',
  install(reg) {
    reg.registerTokens({ '--iris-a': '#aaaaaa' })
    reg.registerStore('a', () => ({ greeting: 'hi-a' }))
    reg.onTeardown(teardownA)
  },
})
const pluginB = createPlugin({
  name: 'b',
  install(reg) {
    reg.registerTokens({ '--iris-b': '#bbbbbb' })
    reg.registerStore('b', () => ({ greeting: 'hi-b' }))
  },
})

// Reads the hooks INSIDE render (not setup) so the post-swap re-render
// re-observes the mutated context. The store read is guarded by usePlugin('b')
// so the probe also mounts cleanly before B is installed.
const SwapProbe = defineComponent({
  setup() {
    return () =>
      h('div', null, [
        h('span', { class: 'a' }, String(usePlugin('a'))),
        h('span', { class: 'b' }, String(usePlugin('b'))),
        h(
          'span',
          { class: 'store-b' },
          usePlugin('b') ? usePluginStore<{ greeting: string }>('b').greeting : '—',
        ),
        // Same-read identity: the shallow context must pass store instances
        // through raw (never proxied) so instanceof / private fields survive.
        h(
          'span',
          { class: 'same-b' },
          usePlugin('b') ? String(usePluginStore('b') === usePluginStore('b')) : '—',
        ),
      ])
  },
})

function mountWithA() {
  return mount(IrisProvider, {
    props: { plugins: [pluginA] },
    slots: { default: () => h(SwapProbe) },
  })
}

describe('@iris-ui-kit/vue IrisProvider plugin swap', () => {
  beforeEach(() => {
    teardownA.mockClear()
  })

  it('re-collects plugins when the plugins prop changes: tokens, teardown, installed set', async () => {
    const wrapper = mountWithA()

    // Pre-swap: A's token applied, A installed, B not; no teardown yet.
    expect(document.documentElement.style.getPropertyValue('--iris-a')).toBe('#aaaaaa')
    expect(wrapper.find('.a').text()).toBe('true')
    expect(wrapper.find('.b').text()).toBe('false')
    expect(teardownA).not.toHaveBeenCalled()

    // Swap A → B.
    await wrapper.setProps({ plugins: [pluginB] })
    await nextTick()

    // A's token reverted, B's applied; A torn exactly once at the swap;
    // the installed set flipped for consumers reading inside render.
    expect(document.documentElement.style.getPropertyValue('--iris-a')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--iris-b')).toBe('#bbbbbb')
    expect(teardownA).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.a').text()).toBe('false')
    expect(wrapper.find('.b').text()).toBe('true')

    // Unmount: B's layer reverted; A is NOT torn again (single call site + core
    // `torn` flag make double teardown impossible).
    wrapper.unmount()
    expect(teardownA).toHaveBeenCalledTimes(1)
    expect(document.documentElement.style.getPropertyValue('--iris-b')).toBe('')
  })

  it('exposes stores registered by swapped-in plugins', async () => {
    const wrapper = mountWithA()

    // B not installed yet — the guarded store read renders the placeholder.
    expect(wrapper.find('.store-b').text()).toBe('—')

    await wrapper.setProps({ plugins: [pluginB] })
    await nextTick()

    // B's eagerly-created store is reachable through the updated context, and
    // repeated reads return the same raw instance (no proxying).
    expect(wrapper.find('.store-b').text()).toBe('hi-b')
    expect(wrapper.find('.same-b').text()).toBe('true')
    wrapper.unmount()
  })
})
