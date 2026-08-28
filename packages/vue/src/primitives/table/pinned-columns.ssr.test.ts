// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { IrisTable } from './Table'

const columns = [
  { key: 'a', title: 'A', pinned: 'left' as const },
  { key: 'b', title: 'B' },
]

describe('IrisTable controlled pinnedColumns SSR', () => {
  it('renders the controlled resolver without browser-only work', async () => {
    const app = createSSRApp({
      render: () =>
        h(IrisTable, {
          columns,
          data: [{ id: 1, a: 'A', b: 'B' }],
          rowKey: 'id',
          pinnedColumns: { a: null, b: 'right' },
        }),
    })
    const html = await renderToString(app)
    expect(html).toContain('data-iris-table-pinned="right"')
    expect(html).not.toContain('data-iris-table-pinned="left"')
  })
})
