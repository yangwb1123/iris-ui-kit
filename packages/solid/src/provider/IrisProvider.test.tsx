import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { createPlugin } from '@iris-ui/core'
import { IrisProvider, usePlugin, usePluginStore } from './index'

afterEach(cleanup)

interface ExampleStore {
  value: number
}

// A trivial in-test plugin exercising all three registration sinks.
const examplePlugin = createPlugin({
  name: 'example',
  install(reg) {
    reg.registerTokens({ '--iris-example': '#abcdef' })
    reg.registerMessages('zh-CN', { hello: '你好' })
    reg.registerStore('example', () => ({ value: 42 }) satisfies ExampleStore)
  },
})

describe('@iris-ui/solid IrisProvider', () => {
  it('exposes the plugin store, installed flags, and applies tokens', () => {
    let store!: ExampleStore
    let hasExample = false
    let hasNope = true
    const Probe = () => {
      store = usePluginStore<ExampleStore>('example')
      hasExample = usePlugin('example')
      hasNope = usePlugin('nope')
      return <div>ok</div>
    }

    render(() => (
      <IrisProvider plugins={[examplePlugin]}>
        <Probe />
      </IrisProvider>
    ))

    // store is readable via usePluginStore
    expect(store).toEqual({ value: 42 })
    // installed introspection
    expect(hasExample).toBe(true)
    expect(hasNope).toBe(false)
    // token applied to document.documentElement while mounted
    expect(document.documentElement.style.getPropertyValue('--iris-example')).toBe('#abcdef')
  })

  it('reverts the applied token on unmount', () => {
    const { unmount } = render(() => (
      <IrisProvider plugins={[examplePlugin]}>
        <div>child</div>
      </IrisProvider>
    ))
    expect(document.documentElement.style.getPropertyValue('--iris-example')).toBe('#abcdef')
    unmount()
    expect(document.documentElement.style.getPropertyValue('--iris-example')).toBe('')
  })

  it('throws when usePluginStore is used without an IrisProvider', () => {
    const Orphan = () => {
      usePluginStore('example')
      return null
    }
    expect(() => render(() => <Orphan />)).toThrow(/no <IrisProvider> ancestor found/)
  })
})
