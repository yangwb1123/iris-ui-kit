// @vitest-environment node
//
// SSR regression guard for IrisTable proxyConfig (review finding, batch X):
// the proxy's `immediate` presence watch must NEVER fire `ctrl.request()`
// during renderToString — the React adapter defers to an effect that never
// runs server-side, so the Vue adapter guards the auto-load kick with a
// `typeof document !== 'undefined'` check. Without the guard the user query
// would run (and possibly throw) inside the server render.
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

interface Row extends Record<string, unknown> {
  id: number
  name: string
}

const columns: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name', sortable: true }]

describe('IrisTable SSR (proxyConfig, batch X)', () => {
  it('never fires the proxy query during renderToString', async () => {
    const query = vi.fn(async () => ({ rows: [], total: 0 }))
    const app = createSSRApp({
      render: () =>
        h(IrisTable, {
          columns,
          data: [],
          rowKey: 'id',
          proxyConfig: { query },
        }),
    })
    const html = await renderToString(app)
    expect(query).not.toHaveBeenCalled()
    // The server HTML stays on the INITIAL state (loading=false) so hydration
    // matches the client's first render; the fetch kicks from onMounted only.
    expect(html).toContain('data-iris-table-row="empty"')
    expect(html).not.toContain('data-iris-table-row="loading"')
    expect(typeof document).toBe('undefined')
  })
})
