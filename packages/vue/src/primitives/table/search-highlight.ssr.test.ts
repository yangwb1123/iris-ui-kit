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
const data: Row[] = [{ id: 1, name: 'Charlie' }]

async function renderTable(searchHighlight?: string): Promise<string> {
  const app = createSSRApp({
    render: () =>
      h(IrisTable, {
        columns,
        data,
        rowKey: 'id',
        ...(searchHighlight === undefined ? {} : { searchHighlight }),
      }),
  })
  return renderToString(app)
}

describe('Vue IrisTable searchHighlight SSR', () => {
  it('renders deterministic highlighted markup', async () => {
    const first = await renderTable('li')
    const second = await renderTable('li')
    expect(first).toBe(second)
    expect(first).toContain('data-iris-search-hit')
    expect(first).toContain('>li</mark>')
  })

  it('does not add marks when highlighting is off', async () => {
    const html = await renderTable()
    expect(html).not.toContain('data-iris-search-hit')
  })
})
