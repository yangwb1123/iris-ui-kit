import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createPlugin } from '@iris-ui/core'
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

describe('@iris-ui/vue IrisProvider', () => {
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
})
