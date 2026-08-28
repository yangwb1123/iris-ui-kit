// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { IrisTable } from './Table'

const columns = [
  { key: 'name', title: 'Name', pinned: 'left' as const },
  { key: 'age', title: 'Age' },
]

describe('IrisTable columnPinMenu SSR', () => {
  it('renders no menu, browser event, or Core pin write during SSR', async () => {
    const onPinned = vi.fn()
    const app = createSSRApp({
      render: () =>
        h(IrisTable, {
          columns,
          data: [{ id: 1, name: 'Alex', age: 25 }],
          rowKey: 'id',
          columnPinMenu: true,
          onColumnPinnedChange: onPinned,
        }),
    })
    const html = await renderToString(app)
    expect(html).toContain('data-iris-table-pinned="left"')
    expect(html).not.toContain('data-iris-table-context-menu')
    expect(html).not.toContain('oncontextmenu')
    expect(onPinned).not.toHaveBeenCalled()
  })
})
