// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

interface Row extends Record<string, unknown> {
  id: number
  status: string
}

const columns: IrisTableColumn<Row>[] = [
  {
    key: 'status',
    title: 'Status',
    filterable: true,
    filterOptions: [{ value: 'active', label: 'Active' }],
  },
]

const props = {
  columns,
  data: [{ id: 1, status: 'active' }],
  rowKey: 'id',
  recentFilters: true,
}

async function renderTable(): Promise<string> {
  return renderToString(
    createSSRApp({
      render: () => h(IrisTable, props),
    }),
  )
}

describe('@iris-ui-kit/vue IrisTable recent filters SSR', () => {
  it('does not render client-only recent entries and stays deterministic', async () => {
    const first = await renderTable()
    const second = await renderTable()

    expect(first).toBe(second)
    expect(first).not.toContain('data-iris-filter-recent')
    expect(first).not.toContain('table.recentFilters')
  })
})
