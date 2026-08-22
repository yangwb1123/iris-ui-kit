import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'
import { exportCsv } from './exportCsv'
import type { IrisTableColumn, IrisTableHandle } from './types'

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(navigator, 'clipboard')
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  price: number
  qty: number
}

const rows: Row[] = [
  { id: 1, name: 'Alpha', price: 10, qty: 3 },
  { id: 2, name: 'Beta', price: 4, qty: 5 },
  { id: 3, name: 'Gamma', price: 100, qty: 1 },
]

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'total', title: 'Total', formula: 'price * qty' },
]

function cells(container: HTMLElement, key: string): string[] {
  return Array.from(container.querySelectorAll(`[data-iris-table-cell="${key}"]`)).map((c) =>
    (c.textContent ?? '').trim(),
  )
}

function cell(container: HTMLElement, rowIndex: number, key: string): HTMLElement {
  const rowEls = container.querySelectorAll<HTMLElement>(
    '[data-iris-table-body] [data-iris-table-row]',
  )
  return rowEls[rowIndex]!.querySelector(`[data-iris-table-cell="${key}"]`) as HTMLElement
}

describe('@iris-ui-kit/svelte IrisTable formula columns (batch EM, iris 独有)', () => {
  it('renders the computed value (formula wins over dataIndex)', () => {
    const { container } = render(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name' },
          {
            key: 'total',
            title: 'Total',
            formula: 'price * qty',
            dataIndex: 'name', // overridden by the formula
          },
        ],
        data: rows,
        rowKey: 'id',
      },
    })
    expect(cells(container, 'total')).toEqual(['30', '20', '100'])
    expect(cells(container, 'name')).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  it('supports leading = and SUM', () => {
    const { container } = render(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name' },
          { key: 'sum', title: 'Sum', formula: '=SUM(price, qty)' },
        ],
        data: rows,
        rowKey: 'id',
      },
    })
    expect(cells(container, 'sum')).toEqual(['13', '9', '101'])
  })

  it('unknown field renders empty (fail-closed → null)', () => {
    const { container } = render(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name' },
          { key: 'ghost', title: 'Ghost', formula: 'missing + 1' },
        ],
        data: rows,
        rowKey: 'id',
      },
    })
    expect(cells(container, 'ghost')).toEqual(['', '', ''])
  })

  it('formatter receives the computed value (display chain bridge)', () => {
    const seen = new Set<unknown>()
    const { container } = render(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name' },
          {
            key: 'total',
            title: 'Total',
            formula: 'price * qty',
            formatter: (value: unknown) => {
              seen.add(value)
              return `$${String(value)}`
            },
          },
        ],
        data: rows,
        rowKey: 'id',
      },
    })
    expect(cells(container, 'total')).toEqual(['$30', '$20', '$100'])
    expect(Array.from(seen).sort((a, b) => Number(a) - Number(b))).toEqual([20, 30, 100])
  })

  it('sort orders by the COMPUTED value (asc)', () => {
    const { container } = render(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name', sortable: true },
          { key: 'total', title: 'Total', formula: 'price * qty', sortable: true },
        ],
        data: rows,
        rowKey: 'id',
        defaultSort: { key: 'total', direction: 'asc' },
      },
    })
    expect(cells(container, 'total')).toEqual(['20', '30', '100'])
    expect(cells(container, 'name')).toEqual(['Beta', 'Alpha', 'Gamma'])
  })

  it('sort desc reverses the computed order', () => {
    const { container } = render(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name' },
          { key: 'total', title: 'Total', formula: 'price * qty', sortable: true },
        ],
        data: rows,
        rowKey: 'id',
        defaultSort: { key: 'total', direction: 'desc' },
      },
    })
    expect(cells(container, 'total')).toEqual(['100', '30', '20'])
  })

  it('text filtering matches the computed value', () => {
    const { container } = render(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', filters: { total: '30' } },
    })
    expect(cells(container, 'name')).toEqual(['Alpha'])
  })

  it('checked filter sets match the computed value', () => {
    const { container } = render(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        filterValues: { total: ['100'] },
      },
    })
    expect(cells(container, 'name')).toEqual(['Gamma'])
  })

  it('summary row aggregates the computed value through the choke point', () => {
    const { container } = render(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name' },
          { key: 'total', title: 'Total', formula: 'price * qty', summary: 'sum' },
        ],
        data: rows,
        rowKey: 'id',
      },
    })
    const summary = container.querySelector('[data-iris-table-row="summary"]')
    expect(summary).not.toBeNull()
    expect(summary?.querySelector('[data-iris-table-cell="total"]')?.textContent?.trim()).toBe(
      '150',
    )
  })

  async function renderTable(props: Record<string, unknown> = {}): Promise<{
    current: IrisTableHandle | null
  }> {
    const tableRef: { current: IrisTableHandle | null } = { current: null }
    render(IrisTable, { props: { columns, data: rows, tableRef, ...props } })
    await waitFor(() => expect(tableRef.current).not.toBeNull())
    return tableRef
  }

  it('CSV export materializes computed values; originals untouched', async () => {
    const tableRef = await renderTable()
    const csv = tableRef.current!.exportCurrentViewCsv()
    const lines = csv.split('\n').map((l) => l.trim())
    expect(lines[0]).toBe('Name,Total')
    expect(lines.slice(1)).toEqual(['Alpha,30', 'Beta,20', 'Gamma,100'])
    // Originals were not mutated (the shadow-row contract).
    expect(rows[0]).toEqual({ id: 1, name: 'Alpha', price: 10, qty: 3 })
  })

  it('the bare serializer stays bare without formula columns (no shadow rows)', () => {
    const plain: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]
    expect(exportCsv(rows, plain)).toBe('Name\nAlpha\nBeta\nGamma')
  })

  it('editable + formula is display-only: no dblclick editor, no data-editable attr', async () => {
    const { container } = render(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name' },
          { key: 'total', title: 'Total', formula: 'price * qty', editable: true },
        ],
        data: rows,
        rowKey: 'id',
      },
    })
    const totalCell = cell(container, 0, 'total')
    expect(totalCell.getAttribute('data-editable')).toBeNull()
    await fireEvent.dblClick(totalCell)
    expect(container.querySelector('[data-iris-table-editor]')).toBeNull()
  })

  it('click-trigger editing also skips formula columns', async () => {
    const { container } = render(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name', editable: true },
          { key: 'total', title: 'Total', formula: 'price * qty', editable: true },
        ],
        data: rows,
        rowKey: 'id',
        editConfig: { trigger: 'click' },
      },
    })
    await fireEvent.click(cell(container, 0, 'total'))
    expect(container.querySelector('[data-iris-table-editor]')).toBeNull()
    const nameCell = cell(container, 0, 'name')
    expect(nameCell.getAttribute('data-editable')).toBe('')
    await fireEvent.click(nameCell)
    expect(container.querySelector('[data-iris-table-editor]')).not.toBeNull()
  })

  it('row mode opens editors for non-formula editable columns only', async () => {
    const { container } = render(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name', editable: true },
          { key: 'total', title: 'Total', formula: 'price * qty', editable: true },
        ],
        data: rows,
        rowKey: 'id',
        editConfig: { mode: 'row' },
      },
    })
    await fireEvent.click(cell(container, 0, 'total'))
    // Row mode never opens a session for the formula column; the name
    // column's editor is the focus fallback of the clicked formula cell.
    const totalCell = cell(container, 0, 'total')
    expect(totalCell.querySelector('[data-iris-table-editor]')).toBeNull()
    expect(totalCell.getAttribute('data-editable')).toBeNull()
    expect(cell(container, 0, 'name').querySelector('[data-iris-table-editor]')).not.toBeNull()
  })

  it('clipboard TSV carries the computed value (Ctrl+C shadow rows)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const { container } = render(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        cellRange: true,
        clipConfig: { copy: true },
      },
    })
    fireEvent.click(container.querySelector('[data-iris-cell-row="0"][data-iris-cell-col="0"]')!)
    fireEvent.click(container.querySelector('[data-iris-cell-row="2"][data-iris-cell-col="1"]')!, {
      shiftKey: true,
    })
    fireEvent.keyDown(container.querySelector('[data-iris-table]')!, { key: 'c', ctrlKey: true })
    await Promise.resolve()
    expect(writeText).toHaveBeenCalledWith('Alpha\t30\nBeta\t20\nGamma\t100')
  })
})
