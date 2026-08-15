import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'
import type { IrisTableHandle } from './types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  price: number
  qty: number
}

const rows: Row[] = [
  { id: 1, name: 'Alpha', price: 10, qty: 2 },
  { id: 2, name: 'Beta', price: 4, qty: 5 },
  { id: 3, name: 'Gamma', price: 100, qty: 1 },
]

/** External rate table: `rates!rate` → 1.5 (first row only). */
const rates = [{ rate: 1.5 }]
const tax = [{ taxRate: 0.25 }]
const tables: Record<string, Row[]> = { rates: rates as Row[], tax: tax as Row[] }

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'taxed', title: 'Taxed', formula: 'price * rates!rate' },
]

function cell(key: string): HTMLElement[] {
  return Array.from(document.querySelectorAll(`[data-iris-table-cell="${key}"]`))
}

function tableRef(): { current: IrisTableHandle<Row> | null } {
  return { current: null }
}

function selectRow(i: number): void {
  const boxes = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type=checkbox]'),
  ).slice(1)
  act(() => {
    fireEvent.click(boxes[i]!)
  })
}

describe('@iris-ui-kit/react IrisTable cross-table formulas (batch BC, iris 独有)', () => {
  it('renders `other!col` values from formulaTables (first row)', () => {
    render(<IrisTable columns={columns} data={rows} formulaTables={tables} />)
    expect(cell('taxed').map((c) => c.textContent)).toEqual(['15', '6', '150'])
    // Row-local columns are untouched.
    expect(cell('name').map((c) => c.textContent)).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  it('missing table / missing field / no prop → empty cell (fail-closed)', () => {
    render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'ghost', title: 'Ghost', formula: 'nope!rate + 1' },
          { key: 'nofield', title: 'NoField', formula: 'rates!missing' },
        ]}
        data={rows}
        formulaTables={tables}
      />,
    )
    expect(cell('ghost').map((c) => c.textContent)).toEqual(['', '', ''])
    expect(cell('nofield').map((c) => c.textContent)).toEqual(['', '', ''])
    // Feature-off: no formulaTables prop → cross-table refs are null.
    render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'taxed', title: 'Taxed', formula: 'price * rates!rate' },
        ]}
        data={rows}
      />,
    )
    expect(cell('taxed').map((c) => c.textContent)).toEqual(['', '', ''])
  })

  it('sort orders by the cross-table computed value (asc)', () => {
    render(
      <IrisTable
        columns={columns}
        data={rows}
        formulaTables={tables}
        defaultSort={{ key: 'taxed', direction: 'asc' }}
      />,
    )
    expect(cell('name').map((c) => c.textContent)).toEqual(['Beta', 'Alpha', 'Gamma'])
  })

  it('sort desc reverses the computed order', () => {
    render(
      <IrisTable
        columns={columns}
        data={rows}
        formulaTables={tables}
        defaultSort={{ key: 'taxed', direction: 'desc' }}
      />,
    )
    expect(cell('name').map((c) => c.textContent)).toEqual(['Gamma', 'Alpha', 'Beta'])
  })

  it('text filtering matches the cross-table computed value', () => {
    render(
      <IrisTable columns={columns} data={rows} formulaTables={tables} filters={{ taxed: '6' }} />,
    )
    expect(cell('name').map((c) => c.textContent)).toEqual(['Beta'])
  })

  it('CSV export materializes cross-table values (shadow rows, originals untouched)', () => {
    const ref = tableRef()
    render(<IrisTable columns={columns} data={rows} formulaTables={tables} tableRef={ref} />)
    const csv = ref.current!.exportCurrentViewCsv()
    const lines = csv.split('\n').map((l) => l.trim())
    expect(lines[0]).toContain('Taxed')
    expect(lines[1]).toContain('15')
    expect(lines[2]).toContain('6')
    expect(lines[3]).toContain('150')
    expect(rows[0]).toEqual({ id: 1, name: 'Alpha', price: 10, qty: 2 })
  })

  it('exportSelectionCsv materializes cross-table values on the selected rows', () => {
    const ref = tableRef()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        selectable="multi"
        formulaTables={tables}
        tableRef={ref}
      />,
    )
    selectRow(0)
    selectRow(2)
    const csv = ref.current!.exportSelectionCsv()
    const lines = csv.split('\n').map((l) => l.trim())
    expect(lines[0]).toContain('Taxed')
    expect(lines[1]).toBe('Alpha,15')
    expect(lines[2]).toBe('Gamma,150')
  })

  it('editable + cross-table formula is display-only (no editor, no data-editable)', () => {
    render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'taxed', title: 'Taxed', formula: 'price * rates!rate', editable: true },
        ]}
        data={rows}
        formulaTables={tables}
      />,
    )
    const taxedCell = document.querySelector('[data-iris-table-cell="taxed"]') as HTMLElement
    expect(taxedCell.getAttribute('data-editable')).toBeNull()
    act(() => {
      fireEvent.doubleClick(taxedCell)
    })
    expect(document.querySelector('[data-iris-table-editor]')).toBeNull()
  })

  it('summary aggregates the cross-table computed value', () => {
    render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'taxed', title: 'Taxed', formula: 'price * rates!rate', summary: 'sum' },
        ]}
        data={rows}
        formulaTables={tables}
      />,
    )
    const sumCell = document.querySelector(
      '[data-iris-table-summary-cell][data-iris-table-cell="taxed"]',
    )
    expect(sumCell?.textContent).toBe('171')
  })

  it('a NEW formulaTables object identity recomputes (immutable contract)', () => {
    const { rerender } = render(<IrisTable columns={columns} data={rows} formulaTables={tables} />)
    expect(cell('taxed').map((c) => c.textContent)).toEqual(['15', '6', '150'])
    const updated = { ...tables, rates: [{ rate: 2 }] as Row[] }
    rerender(<IrisTable columns={columns} data={rows} formulaTables={updated} />)
    expect(cell('taxed').map((c) => c.textContent)).toEqual(['20', '8', '200'])
    // Same object identity → memoized, values stable.
    rerender(<IrisTable columns={columns} data={rows} formulaTables={tables} />)
    expect(cell('taxed').map((c) => c.textContent)).toEqual(['15', '6', '150'])
  })

  it('multi-table pages stay isolated (each table reads its OWN formulaTables)', () => {
    render(
      <div>
        <IrisTable
          columns={[
            { key: 'name', title: 'Name' },
            { key: 'taxed', title: 'Taxed', formula: 'price * rates!rate' },
          ]}
          data={rows}
          formulaTables={{ rates: [{ rate: 2 }] as Row[] }}
        />
        <IrisTable
          columns={[
            { key: 'name', title: 'Name' },
            { key: 'taxed', title: 'Taxed', formula: 'price * rates!rate' },
          ]}
          data={rows.slice(0, 1)}
          formulaTables={{ rates: [{ rate: 10 }] as Row[] }}
        />
      </div>,
    )
    const all = Array.from(document.querySelectorAll('[data-iris-table-cell="taxed"]'))
    // First table (2×10, 2×4, 2×100) then the second (10×10).
    expect(all.map((c) => c.textContent)).toEqual(['20', '8', '200', '100'])
  })

  it('grouped headers / dataIndex columns resolve cross-table formulas through the same choke point', () => {
    render(
      <IrisTable
        columns={[
          {
            key: 'g',
            title: 'Group',
            children: [
              { key: 'name', title: 'Name' },
              { key: 'taxed', title: 'Taxed', formula: 'price * rates!rate', dataIndex: 'qty' },
            ],
          },
        ]}
        data={rows.slice(0, 1)}
        formulaTables={tables}
      />,
    )
    // formula wins over dataIndex: 10 * 1.5 = 15 (NOT qty=2).
    expect(cell('taxed').map((c) => c.textContent)).toEqual(['15'])
  })
})
