// @vitest-environment node
//
// SSR regression guard for IrisProvider (mirrors packages/vue/src/ssr.test.ts):
// token application must stay a no-op when no DOM exists. Watchers never flush
// under renderToString and onMounted never runs, but the explicit
// `typeof document === 'undefined'` guard on both token paths is the invariant
// — any render-path DOM access would throw ReferenceError in this env.
import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createPlugin } from '@iris-ui-kit/core'
import { IrisProvider } from './IrisProvider'
import { IrisInput } from '../primitives/input/Input'
import { IrisButton } from '../primitives/button/Button'

const examplePlugin = createPlugin({
  name: 'example',
  install(reg) {
    reg.registerTokens({ '--iris-example': '#abcdef' })
    reg.registerStore('example', () => ({ greeting: 'hi' }))
  },
})

describe('@iris-ui-kit/vue IrisProvider SSR', () => {
  it('renders server-side without touching the DOM', async () => {
    const app = createSSRApp({
      render: () =>
        h(IrisProvider, { plugins: [examplePlugin] }, { default: () => h('div', 'ssr-ok') }),
    })
    const html = await renderToString(app)
    expect(html).toContain('ssr-ok')
    expect(typeof document).toBe('undefined')
  })

  it('renders the provider componentSize on the server (no DOM, no wrapper)', async () => {
    const app = createSSRApp({
      render: () =>
        h(
          IrisProvider,
          { componentSize: 'sm' },
          { default: () => h('div', [h(IrisButton, null, { default: () => 'x' }), h(IrisInput)]) },
        ),
    })
    const html = await renderToString(app)
    expect(html).toContain('data-iris-button-size="sm"')
    expect(html).toContain('data-iris-input-size="sm"')
    expect(typeof document).toBe('undefined')
  })
})
