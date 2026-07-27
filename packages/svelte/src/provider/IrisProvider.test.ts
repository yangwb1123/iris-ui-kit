import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import { createPlugin } from '@iris-ui-kit/core'
import IrisProviderHarness from './IrisProviderHarness.svelte'

afterEach(cleanup)

// A minimal plugin defined inline: one token, one zh-CN message, one store.
const examplePlugin = createPlugin({
  name: 'example',
  install(reg) {
    reg.registerTokens({ '--iris-example': '#abcdef' })
    reg.registerMessages('zh-CN', { hello: '你好' })
    reg.registerStore('example', () => ({ id: 'example-store' }))
  },
})

describe('@iris-ui-kit/svelte IrisProvider', () => {
  it('exposes a registered store to descendants via usePluginStore', () => {
    const { container } = render(IrisProviderHarness, { props: { plugins: [examplePlugin] } })
    expect(container.querySelector('[data-store-id]')?.textContent).toBe('example-store')
  })

  it('reports installed plugins via usePlugin', () => {
    const { container } = render(IrisProviderHarness, { props: { plugins: [examplePlugin] } })
    expect(container.querySelector('[data-has-example]')?.textContent).toBe('true')
    expect(container.querySelector('[data-has-nope]')?.textContent).toBe('false')
  })

  it('applies plugin tokens to document.documentElement and reverts on unmount', () => {
    const { unmount } = render(IrisProviderHarness, { props: { plugins: [examplePlugin] } })
    expect(document.documentElement.style.getPropertyValue('--iris-example')).toBe('#abcdef')
    unmount()
    expect(document.documentElement.style.getPropertyValue('--iris-example')).toBe('')
  })
})
