// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { render } from 'svelte/server'
import IrisTable from './IrisTable.svelte'
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

function renderTable(formulaTablesProp?: IrisTableFormulaTables): string {
  return render(IrisTable, {
    props: {
      columns,
      data,
      rowKey: 'id',
      formulaTables: formulaTablesProp,
    },
  }).body
}

describe('Svelte IrisTable cross-table formulas SSR', () => {
  it('renders the computed value without browser-only branches', () => {
    const html = renderTable(formulaTables)
    expect(html).toMatch(/data-iris-table-cell="total"[^>]*>[\s\S]*?20/)
    expect(html).not.toContain('data-iris-back-top-table')
  })

  it('fails closed when the optional table map is omitted', () => {
    const html = renderTable()
    expect(html).not.toMatch(/data-iris-table-cell="total"[^>]*>[\s\S]*?20/)
  })

  it('is deterministic across two server renders with the same table identity', () => {
    expect(renderTable(formulaTables)).toBe(renderTable(formulaTables))
  })
})
