import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn, IrisTableFormulaTables, IrisTableHandle } from './types'

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
  { id: 1, name: 'Alpha', price: 10, qty: 2 },
  { id: 2, name: 'Beta', price: 4, qty: 5 },
  { id: 3, name: 'Gamma', price: 100, qty: 1 },
]

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'taxed', title: 'Taxed', formula: 'price * rates!rate', sortable: true },
]

const tables: IrisTableFormulaTables<Row> = {
  rates: [{ rate: 1.5 } as unknown as Row],
}

function cells(container: HTMLElement, key: string): string[] {
  return Array.from(container.querySelectorAll(`[data-iris-table-cell="${key}"]`)).map(
    (cell) => cell.textContent ?? '',
  )
}

describe('@iris-ui-kit/solid IrisTable cross-table formulas', () => {
  it('renders from the first row and keeps each table scope isolated', () => {
    const { container } = render(() => (
      <div>
        <IrisTable columns={columns} data={rows} formulaTables={tables} />
        <IrisTable
          columns={columns}
          data={rows.slice(0, 1)}
          formulaTables={{ rates: [{ rate: 10 } as unknown as Row] }}
        />
      </div>
    ))

    expect(cells(container, 'taxed')).toEqual(['15', '6', '150', '100'])
    expect(rows[0]).toEqual({ id: 1, name: 'Alpha', price: 10, qty: 2 })
  })

  it('is disabled without formulaTables and fails closed for bad references', () => {
    const { container } = render(() => (
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'missingTable', title: 'Missing table', formula: 'nope!rate + 1' },
          { key: 'emptyTable', title: 'Empty table', formula: 'empty!rate' },
          { key: 'missingField', title: 'Missing field', formula: 'rates!missing' },
          { key: 'badFormula', title: 'Bad formula', formula: 'rates!rate +' },
        ]}
        data={rows}
        formulaTables={{ ...tables, empty: [] }}
      />
    ))

    for (const key of ['missingTable', 'emptyTable', 'missingField', 'badFormula']) {
      expect(cells(container, key)).toEqual(['', '', ''])
    }

    const disabled = render(() => (
      <IrisTable
        columns={[{ key: 'taxed', title: 'Taxed', formula: 'price * rates!rate' }]}
        data={rows}
      />
    ))
    expect(cells(disabled.container, 'taxed')).toEqual(['', '', ''])
  })

  it('sorts and filters by the computed value', () => {
    const sorted = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        formulaTables={tables}
        defaultSort={{ key: 'taxed', direction: 'asc' }}
      />
    ))
    expect(cells(sorted.container, 'name')).toEqual(['Beta', 'Alpha', 'Gamma'])

    sorted.unmount()
    const filtered = render(() => (
      <IrisTable columns={columns} data={rows} formulaTables={tables} filters={{ taxed: '6' }} />
    ))
    expect(cells(filtered.container, 'name')).toEqual(['Beta'])
  })

  it('recomputes when a new formulaTables object is passed', () => {
    const [currentTables, setCurrentTables] = createSignal<IrisTableFormulaTables<Row>>(tables)
    const { container } = render(() => (
      <IrisTable columns={columns} data={rows} formulaTables={currentTables()} />
    ))

    expect(cells(container, 'taxed')).toEqual(['15', '6', '150'])
    setCurrentTables({ rates: [{ rate: 2 } as unknown as Row] })
    expect(cells(container, 'taxed')).toEqual(['20', '8', '200'])
  })

  it('aggregates the current cross-table values in the summary row', () => {
    const { container } = render(() => (
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'taxed', title: 'Taxed', formula: 'price * rates!rate', summary: 'sum' },
        ]}
        data={rows}
        formulaTables={tables}
      />
    ))

    expect(
      container.querySelector('[data-iris-table-row="summary"] [data-iris-table-cell="taxed"]')
        ?.textContent,
    ).toBe('171')
  })

  it('exports and copies computed values without changing source rows', async () => {
    const tableRef: { current: IrisTableHandle<Row> | null } = { current: null }
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        formulaTables={tables}
        tableRef={tableRef}
        cellRange
        clipConfig={{ copy: true }}
      />
    ))

    expect(tableRef.current!.exportCurrentViewCsv()).toBe('Name,Taxed\nAlpha,15\nBeta,6\nGamma,150')
    fireEvent.click(container.querySelector('[data-iris-cell-row="0"][data-iris-cell-col="0"]')!)
    fireEvent.click(container.querySelector('[data-iris-cell-row="2"][data-iris-cell-col="1"]')!, {
      shiftKey: true,
    })
    fireEvent.keyDown(container.querySelector('[data-iris-table]')!, { key: 'c', ctrlKey: true })
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Alpha\t15\nBeta\t6\nGamma\t150'))
    expect(rows[0]).toEqual({ id: 1, name: 'Alpha', price: 10, qty: 2 })
  })
})
