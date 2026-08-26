// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

interface Row extends Record<string, unknown> {
  id: number
  name: string
}

const columns: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]

// Batch FS: opt-in back-to-top setup must remain SSR/hydration-safe. The
// client adds listeners only from onMounted, while the server emits no
// threshold-dependent button or anchor.
describe('@iris-ui-kit/vue IrisTable back-to-top SSR (batch FS)', () => {
  it('does not render browser-only back-to-top nodes during SSR', async () => {
    const app = createSSRApp({
      render: () =>
        h(IrisTable, {
          columns,
          data: [{ id: 1, name: 'Alpha' }],
          rowKey: 'id',
          scrollToTop: true,
        }),
    })
    const html = await renderToString(app)
    expect(html).not.toContain('data-iris-back-top-table')
    expect(html).not.toContain('data-iris-back-top-anchor')
    expect(typeof document).toBe('undefined')
  })
})
