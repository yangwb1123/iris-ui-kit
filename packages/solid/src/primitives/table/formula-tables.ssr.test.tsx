import { describe, expect, it } from 'vitest'
import { renderToString } from 'solid-js/web'
import { IrisTable } from './IrisTable'
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
const formulaTables: IrisTableFormulaTables<Row> = {
  rates: [{ rate: 2 } as unknown as Row],
}

function renderTable(): string {
  return renderToString(() => (
    <IrisTable
      columns={columns}
      data={data}
      rowKey="id"
      formulaTables={formulaTables}
      scrollToTop
    />
  ))
}

describe('Solid IrisTable cross-table formulas SSR/hydration safety', () => {
  it('renders the computed value without browser-only nodes', () => {
    const html = renderTable()
    expect(html).toMatch(/data-iris-table-cell="total"[^>]*>[\s\S]*?20/)
    expect(html).not.toContain('data-iris-back-top-table')
    expect(html).not.toContain('data-iris-back-top-anchor')
  })

  it('produces identical server markup for the same tree', () => {
    // Hydration requires the client to see the same formula result and branch
    // shape as SSR. Two independent passes guard against render-time state or
    // cross-table scope leaking into the generated markup.
    expect(renderTable()).toBe(renderTable())
  })
})
