import { afterEach, describe, expect, it, vi } from 'vitest'
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
  { id: 1, name: 'Alpha', price: 10, qty: 3 },
  { id: 2, name: 'Beta', price: 4, qty: 5 },
  { id: 3, name: 'Gamma', price: 100, qty: 1 },
]

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'price', title: 'Price', summary: 'sum' },
  { key: 'qty', title: 'Qty', summary: 'sum' },
]

function tableRef(): { current: IrisTableHandle<Row> | null } {
  return { current: null }
}

function summary(): HTMLElement | null {
  return document.querySelector('[data-iris-selection-summary]')
}

function summaryText(): string {
  return summary()?.textContent ?? ''
}

function clearBtn(): HTMLElement | null {
  return document.querySelector('[data-iris-selection-clear]')
}

function rowCheckboxes(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[type=checkbox]')).slice(1)
}

function selectRow(i: number): void {
  act(() => {
    fireEvent.click(rowCheckboxes()[i]!)
  })
}

describe('@iris-ui-kit/react IrisTable selectionSummary (batch AP, iris 独有)', () => {
  it('defaults off — no summary element even with a selection', () => {
    render(<IrisTable columns={columns} data={rows} selectable="multi" toolbar={{}} />)
    selectRow(0)
    expect(summary()).toBeNull()
  })

  it('hides without a selection', () => {
    render(
      <IrisTable columns={columns} data={rows} selectable="multi" toolbar={{}} selectionSummary />,
    )
    expect(summary()).toBeNull()
  })

  it('shows the count + per-sum-column totals once rows are selected', () => {
    render(
      <IrisTable columns={columns} data={rows} selectable="multi" toolbar={{}} selectionSummary />,
    )
    expect(summary()).toBeNull()
    selectRow(0)
    expect(summaryText()).toContain('1 selected')
    expect(summaryText()).toContain('· sum 10')
    expect(summaryText()).toContain('· sum 3')
    selectRow(1)
    expect(summaryText()).toContain('2 selected')
    // 10+4 = 14, 3+5 = 8 — sums over the SELECTED rows only (Beta not 100).
    expect(summaryText()).toContain('· sum 14')
    expect(summaryText()).toContain('· sum 8')
    expect(summaryText()).not.toContain('· sum 100')
  })

  it('single mode never renders the summary (multi gate)', () => {
    render(
      <IrisTable columns={columns} data={rows} selectable="single" toolbar={{}} selectionSummary />,
    )
    const radios = Array.from(document.querySelectorAll('input[type=radio]'))
    act(() => {
      fireEvent.click(radios[0]!)
    })
    expect(summary()).toBeNull()
  })

  it('only sum ops render — avg/min/max/count columns are skipped', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'price', title: 'Price', summary: 'sum' },
      { key: 'qty', title: 'Qty', summary: 'avg' },
      { key: 'id', title: 'Id', summary: 'count' },
    ]
    render(
      <IrisTable columns={cols} data={rows} selectable="multi" toolbar={{}} selectionSummary />,
    )
    selectRow(0)
    selectRow(1)
    const text = summaryText()
    expect(text).toContain('· sum 14')
    expect(text).not.toContain('avg')
    expect(text).not.toContain('count')
  })

  it('applies aggregateAccuracy rounding to the totals', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'price', title: 'Price', summary: 'sum' },
    ]
    const data: Row[] = [
      { id: 1, name: 'A', price: 1.005, qty: 1 },
      { id: 2, name: 'B', price: 1.005, qty: 1 },
    ]
    render(
      <IrisTable
        columns={cols}
        data={data}
        selectable="multi"
        toolbar={{}}
        selectionSummary
        aggregateAccuracy={2}
      />,
    )
    selectRow(0)
    selectRow(1)
    expect(summaryText()).toContain('· sum 2.01')
  })

  it('clear button clears the selection (uncontrolled) and hides the summary', () => {
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        selectable="multi"
        toolbar={{}}
        selectionSummary
        onSelectionChange={onChange}
      />,
    )
    selectRow(0)
    selectRow(1)
    expect(summary()).not.toBeNull()
    act(() => {
      fireEvent.click(clearBtn()!)
    })
    expect(onChange).toHaveBeenLastCalledWith([])
    expect(summary()).toBeNull()
    expect(rowCheckboxes().every((cb) => !cb.checked)).toBe(true)
  })

  it('clear button fires the shared clearSelection path in controlled mode', () => {
    const onChange = vi.fn()
    function Controlled({ value }: { value: Array<string | number> }) {
      return (
        <IrisTable
          columns={columns}
          data={rows}
          selectable="multi"
          toolbar={{}}
          selectionSummary
          selection={value}
          onSelectionChange={onChange}
        />
      )
    }
    const { rerender } = render(<Controlled value={[1, 2]} />)
    expect(summaryText()).toContain('2 selected')
    act(() => {
      fireEvent.click(clearBtn()!)
    })
    // Emits the cleared list; the parent must write it back (true controlled).
    expect(onChange).toHaveBeenLastCalledWith([])
    rerender(<Controlled value={[]} />)
    expect(summary()).toBeNull()
  })
})

describe('@iris-ui-kit/react IrisTable exportSelectionCsv (batch AP, iris 独有)', () => {
  it('exports the selected rows in bodyData order, not selection order', () => {
    const ref = tableRef()
    render(
      <IrisTable columns={columns} data={rows} rowKey="id" selectable="multi" tableRef={ref} />,
    )
    selectRow(2) // Gamma
    selectRow(0) // Alpha
    const csv = ref.current!.exportSelectionCsv()
    expect(csv).toBe('Name,Price,Qty\nAlpha,10,3\nGamma,100,1')
  })

  it('empty selection returns an empty string', () => {
    const ref = tableRef()
    render(
      <IrisTable columns={columns} data={rows} rowKey="id" selectable="multi" tableRef={ref} />,
    )
    expect(ref.current!.exportSelectionCsv()).toBe('')
  })

  it('excludes hidden columns (columnVisibility)', () => {
    const ref = tableRef()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        selectable="multi"
        tableRef={ref}
        columnVisibility={{ qty: false }}
      />,
    )
    selectRow(0)
    expect(ref.current!.exportSelectionCsv()).toBe('Name,Price\nAlpha,10')
  })

  it('materializes formula columns on shadow rows', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'total', title: 'Total', formula: 'price * qty' },
    ]
    const ref = tableRef()
    render(<IrisTable columns={cols} data={rows} rowKey="id" selectable="multi" tableRef={ref} />)
    selectRow(0)
    selectRow(1)
    expect(ref.current!.exportSelectionCsv()).toBe('Name,Total\nAlpha,30\nBeta,20')
  })

  it('follows bodyData order after a sort, and skips rows filtered out', () => {
    const ref = tableRef()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        selectable="multi"
        tableRef={ref}
        defaultSort={{ key: 'price', direction: 'desc' }}
        filters={{ price: '1' }}
      />,
    )
    // Select the master checkbox — every visible (filtered) row.
    const master = document.querySelectorAll('input[type=checkbox]')[0]!
    act(() => {
      fireEvent.click(master)
    })
    // bodyData = sorted by price desc (Gamma, Alpha, Beta) THEN filtered to
    // price containing '1' (Gamma 100 + Alpha 10; Beta 4 dropped) —
    // selection maps through bodyData order, not click order.
    expect(ref.current!.exportSelectionCsv()).toBe('Name,Price,Qty\nGamma,100,1\nAlpha,10,3')
  })
})
