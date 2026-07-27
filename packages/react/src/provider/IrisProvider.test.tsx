import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createPlugin } from '@iris-ui-kit/core'
import { IrisProvider, usePlugin, usePluginStore } from './index'

afterEach(cleanup)

interface ExampleStore {
  value: number
}

/** Minimal plugin registering one token, one message, and one store. */
const examplePlugin = createPlugin({
  name: 'example',
  install(reg) {
    reg.registerTokens({ '--iris-example': '#abcdef' })
    reg.registerMessages('zh-CN', { hello: '你好' })
    reg.registerStore('example', (): ExampleStore => ({ value: 42 }))
  },
})

function Probe() {
  const store = usePluginStore<ExampleStore>('example')
  return (
    <div>
      <span data-testid="store">{store.value}</span>
      <span data-testid="installed">{String(usePlugin('example'))}</span>
      <span data-testid="missing">{String(usePlugin('nope'))}</span>
    </div>
  )
}

describe('IrisProvider', () => {
  it('exposes plugin stores + installed flags to descendants', () => {
    render(
      <IrisProvider plugins={[examplePlugin]}>
        <Probe />
      </IrisProvider>,
    )
    expect(screen.getByTestId('store').textContent).toBe('42')
    expect(screen.getByTestId('installed').textContent).toBe('true')
    expect(screen.getByTestId('missing').textContent).toBe('false')
  })

  it('applies plugin tokens to document.documentElement while mounted, reverts on unmount', () => {
    const read = () => document.documentElement.style.getPropertyValue('--iris-example')
    expect(read()).toBe('')
    const { unmount } = render(
      <IrisProvider plugins={[examplePlugin]}>
        <div />
      </IrisProvider>,
    )
    expect(read()).toBe('#abcdef')
    unmount()
    expect(read()).toBe('')
  })

  it('throws a clear error when usePluginStore is used outside IrisProvider', () => {
    function Orphan() {
      usePluginStore('example')
      return null
    }
    expect(() => render(<Orphan />)).toThrow(/usePluginStore\("example"\): no <IrisProvider>/)
  })
})
