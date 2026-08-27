// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { IrisTable } from './Table'

describe('IrisTable undo/redo SSR', () => {
  it('renders deterministic disabled controls without browser work', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(IrisTable, {
            columns: [{ key: 'name', title: 'Name', editable: true }],
            data: [{ id: 1, name: 'Alice' }],
            rowKey: 'id',
            undo: true,
          }),
      }),
    )
    expect(html).toContain('data-iris-table-undo')
    expect(html).toContain('data-iris-table-redo')
    expect(html).toContain('disabled')
  })
})
