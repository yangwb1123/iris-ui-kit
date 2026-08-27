// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { IrisTable } from './Table'
import type { IrisTableColumn, IrisTableFormulaTables } from './types'

interface Row extends Record<string, unknown> {
  id: number
  price: number
}

const columns: IrisTableColumn<Row>[] = [
  { key: 'price', title: 'Price' },
  { key: 'total', title: 'Total', formula: 'price * rates!rate' },
]
const data: Row[] = [{ id: 1, price: 10 }]
const formulaTables: IrisTableFormulaTables = { rates: [{ rate: 2 }] }

async function renderTable(formulaTablesProp?: IrisTableFormulaTables): Promise<string> {
  const app = createSSRApp({
    render: () =>
      h(IrisTable, {
        columns,
        data,
        rowKey: 'id',
        formulaTables: formulaTablesProp,
      }),
  })
  return renderToString(app)
}

describe('Vue IrisTable cross-table formulas SSR', () => {
  it('renders the computed value without browser-only branches', async () => {
    const html = await renderTable(formulaTables)
    expect(html).toMatch(/data-iris-table-cell="total"[^>]*>[\s\S]*?20/)
    expect(html).not.toContain('data-iris-back-top-table')
  })

  it('fails closed when the optional table map is omitted', async () => {
    const html = await renderTable()
    expect(html).toMatch(/data-iris-table-cell="total"[^>]*>[\s\S]*?<\/div>/)
    expect(html).not.toMatch(/data-iris-table-cell="total"[^>]*>[\s\S]*?20/)
  })

  it('is deterministic across two server renders with the same table identity', async () => {
    expect(await renderTable(formulaTables)).toBe(await renderTable(formulaTables))
  })
})
