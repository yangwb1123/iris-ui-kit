// @vitest-environment node
//
// SSR harness for the useResourceController bridge — runs in the *node*
// environment with NO `document` / `window`, simulating a real Nuxt /
// `@vue/server-renderer` pass. Discriminates the SSR hazard: the raw-config
// bridge fired the fetcher during `setup()` (i.e. during `renderToString`),
// the fixed bridge defers the initial load to `onMounted`, which server
// rendering never runs.
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
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

function renderResourceSSR(config: Parameters<typeof useResourceController<Row>>[0]) {
  let ctrl!: UseResourceController<Row>
  const Comp = defineComponent({
    setup() {
      ctrl = useResourceController<Row>(config)
      return () => h('div', { 'data-iris-resource-ssr': '' }, String(ctrl.state.value.rows.length))
    },
  })
  return renderToString(createSSRApp(Comp)).then((html) => ({ html, ctrl }))
}

describe('useResourceController SSR', () => {
  it('runs in a no-DOM (server) environment', () => {
    expect(typeof document).toBe('undefined')
    expect(typeof window).toBe('undefined')
  })

  it('AC1: server render never invokes the fetcher; empty state renders', async () => {
    const fetcher = vi.fn(async () => ({ rows: data, total: data.length }))
    const { html, ctrl } = await renderResourceSSR({ fetcher, pageSize: 10 })

    // The fetcher must not fire during renderToString (current code calls it
    // once from setup()). onMounted never runs server-side.
    expect(fetcher).not.toHaveBeenCalled()
    expect(html.length).toBeGreaterThan(0)
    expect(html).toContain('data-iris-resource-ssr')
    // Empty-state row count renders (synchronous seed, SSR-safe).
    expect(html).toContain('>0<')
    expect(ctrl.state.value.rows).toEqual([])
    expect(ctrl.state.value.loading).toBe(false)
  })

  it('immediate: false also renders without fetching (explicit opt-out)', async () => {
    const fetcher = vi.fn(async () => ({ rows: data, total: data.length }))
    const { html, ctrl } = await renderResourceSSR({ fetcher, pageSize: 10, immediate: false })

    expect(fetcher).not.toHaveBeenCalled()
    expect(html).toContain('>0<')
    expect(ctrl.state.value.rows).toEqual([])
  })
})
