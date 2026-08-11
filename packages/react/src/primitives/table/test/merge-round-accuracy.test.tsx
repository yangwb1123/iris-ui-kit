import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IrisTable, type IrisTableColumn, type IrisTableMergeCell } from '../index'

afterEach(cleanup)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  qty: number
  price: number
}

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'qty', title: 'Qty', summary: 'sum' },
  { key: 'price', title: 'Price', summary: 'sum' },
]

const rows: Row[] = [
  { id: 1, name: 'A', qty: 10.333, price: 3.14159 },
  { id: 2, name: 'B', qty: 20.667, price: 2.71828 },
]

function headers(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll('[data-iris-table-header]')] as HTMLElement[]
}

describe('IrisTable mergeHeaderCells (vxe-grid parity, batch P)', () => {
  it('colspan merges adjacent header cells and skips the covered cell', () => {
    const merges: IrisTableMergeCell[] = [{ row: 0, col: 0, colspan: 2 }]
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" mergeHeaderCells={merges} />,
    )
    const h = headers(container)
    // name spans 2 → qty renders null; price stays.
    expect(h.length).toBe(2)
    expect(h[0]?.textContent).toBe('Name')
    expect(h[0]?.style.gridColumnEnd).toBe('span 2')
    expect(h[1]?.textContent).toBe('Price')
    expect(h[1]?.style.gridColumnEnd).toBe('')
  })

  it('no mergeHeaderCells leaves the header unchanged', () => {
    const { container } = render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    const h = headers(container)
    expect(h.length).toBe(3)
    expect(h.map((el) => el.textContent)).toEqual(['Name', 'Qty', 'Price'])
    expect(h.every((el) => el.style.gridColumnEnd === '')).toBe(true)
  })

  it('mergeHeaderCells is fail-closed under columnVirtualization', () => {
    const merges: IrisTableMergeCell[] = [{ row: 0, col: 0, colspan: 2 }]
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        mergeHeaderCells={merges}
        columnVirtualization
      />,
    )
    // jsdom viewport is 0 → the overscan window covers all 3 columns, but
    // the merge must NOT apply: no covered nulls, no gridColumnEnd spans
    // (the visible-window track shift would misalign them).
    const h = headers(container)
    expect(h.length).toBe(3)
    expect(h.map((el) => el.textContent)).toEqual(['Name', 'Qty', 'Price'])
    expect(h.every((el) => el.style.gridColumnEnd === '')).toBe(true)
  })

  it('entries with row > 0 are ignored (flat header is row 0 only)', () => {
    const merges: IrisTableMergeCell[] = [
      { row: 1, col: 0, colspan: 2 },
      { row: 0, col: 2, colspan: 2 },
    ]
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" mergeHeaderCells={merges} />,
    )
    const h = headers(container)
    // row 1 entry ignored → name untouched; price spans (col 3 is out of
    // range, so only the origin renders).
    expect(h.length).toBe(3)
    expect(h[0]?.textContent).toBe('Name')
    expect(h[0]?.style.gridColumnEnd).toBe('')
    expect(h[1]?.textContent).toBe('Qty')
    expect(h[1]?.style.gridColumnEnd).toBe('')
    expect(h[2]?.textContent).toBe('Price')
    expect(h[2]?.style.gridColumnEnd).toBe('span 2')
  })
})

describe('IrisTable footerSpanMethod (vxe footer-span-method parity, batch P)', () => {
  it('colspan merges footerMethod cells and skips the covered cell', () => {
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        footerMethod={() => [{ id: 9, name: 'Total', qty: 31, price: 5.86 }]}
        footerSpanMethod={({ columnIndex }) => (columnIndex === 0 ? { colspan: 2 } : null)}
      />,
    )
    const cells = [...container.querySelectorAll('[data-iris-table-footer-method-cell]')]
    // name spans 2 → qty covered; price renders.
    expect(cells.length).toBe(2)
    expect(cells[0]?.textContent).toBe('Total')
    expect((cells[0] as HTMLElement).style.gridColumnEnd).toBe('span 2')
  })

  it('rowIndex is 0-based over the rendered footer stack (summary then footerData)', () => {
    const seen: Array<[number, number]> = []
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        footerData={[{ id: 0, name: 'Grand', qty: 31, price: 5.86 }]}
        footerSpanMethod={(p) => {
          seen.push([p.rowIndex, p.columnIndex])
          return p.rowIndex === 0 && p.columnIndex === 0 ? { colspan: 2 } : null
        }}
      />,
    )
    // stack: summary row (0) then footerData row (1); the covered qty cell of
    // the summary row is skipped before the callback runs. (The component
    // renders twice in jsdom — the same pre-existing behavior as spanMethod —
    // so assert the first pass only.)
    expect(seen.slice(0, 5)).toEqual([
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
    ])
    // summary: name spans 2 → qty covered → only price renders an aggregate.
    const summaryCells = [...container.querySelectorAll('[data-iris-table-summary-cell]')]
    expect(summaryCells.length).toBe(1)
    expect(summaryCells[0]?.textContent).toBe('5.85987')
    // footerData is a separate stack row: rowIndex 1, no merge → 3 cells.
    const footerCells = [...container.querySelectorAll('[data-iris-table-footer-cell]')]
    expect(footerCells.length).toBe(3)
    expect(footerCells[0]?.textContent).toBe('Grand')
  })

  it('footerSpanMethod colspan also spans the summary row when footerMethod is absent', () => {
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        footerSpanMethod={({ columnIndex }) => (columnIndex === 0 ? { colspan: 2 } : null)}
      />,
    )
    const summaryCells = [...container.querySelectorAll('[data-iris-table-summary-cell]')]
    // name spans 2 → qty covered; price still aggregates.
    expect(summaryCells.length).toBe(1)
    expect(summaryCells[0]?.textContent).toBe('5.85987')
  })

  it('no footerSpanMethod leaves the footer untouched', () => {
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        footerMethod={() => [{ id: 9, name: 'Total', qty: 31, price: 5.86 }]}
      />,
    )
    const cells = [...container.querySelectorAll('[data-iris-table-footer-method-cell]')]
    expect(cells.length).toBe(3)
    expect(cells.every((el) => (el as HTMLElement).style.gridColumnEnd === '')).toBe(true)
  })

  it('footer rowspan is inert: later stack rows keep every cell', () => {
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        footerData={[{ id: 0, name: 'Grand', qty: 31, price: 5.86 }]}
        footerSpanMethod={({ columnIndex }) => (columnIndex === 0 ? { rowspan: 2 } : null)}
      />,
    )
    // Stack: summary (0) + footerData (1). `{rowspan:2}` at [0,0] must NOT
    // occupy row 1's cells (each row is its own grid container — the old
    // occupy marking made 'Grand' silently disappear) nor set gridRowEnd.
    const summaryCells = [...container.querySelectorAll('[data-iris-table-summary-cell]')]
    expect(summaryCells.length).toBe(2)
    const footerCells = [...container.querySelectorAll('[data-iris-table-footer-cell]')]
    expect(footerCells.length).toBe(3)
    expect(footerCells[0]?.textContent).toBe('Grand')
    const all = [
      ...container.querySelectorAll(
        '[data-iris-table-summary-cell], [data-iris-table-footer-cell], [data-iris-table-footer-method-cell]',
      ),
    ]
    expect(all.every((el) => (el as HTMLElement).style.gridRowEnd === '')).toBe(true)
  })
})

describe('IrisTable round + padding (batch P)', () => {
  it('round renders the lg radius when bordered', () => {
    const { container } = render(<IrisTable columns={cols} data={rows} rowKey="id" round />)
    const root = container.querySelector('[data-iris-table]') as HTMLElement
    expect(root.style.borderRadius).toBe('var(--iris-radius-lg, 10px)')
  })

  it('round without bordered keeps the default md radius', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" round bordered={false} />,
    )
    const root = container.querySelector('[data-iris-table]') as HTMLElement
    expect(root.style.borderRadius).toBe('var(--iris-radius-md, 6px)')
  })

  it('padding sets --iris-cell-pad and overrides cell padding', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" padding="2px 6px" />,
    )
    const root = container.querySelector('[data-iris-table]') as HTMLElement
    expect(root.style.getPropertyValue('--iris-cell-pad')).toBe('2px 6px')
    // cells read the var chain: --iris-cell-pad → --iris-cell-pad-y → default
    const cell = container.querySelector('[role="cell"]') as HTMLElement
    expect(cell.style.padding).toBe('var(--iris-cell-pad, var(--iris-cell-pad-y, 8px) 12px)')
  })

  it('no padding leaves the default cell padding fallback', () => {
    const { container } = render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    const root = container.querySelector('[data-iris-table]') as HTMLElement
    expect(root.style.getPropertyValue('--iris-cell-pad')).toBe('')
    const cell = container.querySelector('[role="cell"]') as HTMLElement
    expect(cell.style.padding).toBe('var(--iris-cell-pad, var(--iris-cell-pad-y, 8px) 12px)')
  })
})

describe('IrisTable aggregateAccuracy (vxe aggregateAccuracyConfig parity, batch P)', () => {
  it('rounds the summary sums at the given precision', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" aggregateAccuracy={2} />,
    )
    const summaryCells = [...container.querySelectorAll('[data-iris-table-summary-cell]')]
    // qty: 10.333 + 20.667 → 31; price: 3.14159 + 2.71828 → 5.86
    expect(summaryCells[0]?.textContent).toBe('31')
    expect(summaryCells[1]?.textContent).toBe('5.86')
  })

  it('renderSummary still wins and sees the rounded value', () => {
    const renderSummary = vi.fn((value: number) => `$${value.toFixed(1)}`)
    const { container } = render(
      <IrisTable
        columns={[{ key: 'a', title: 'A', summary: 'sum', renderSummary }]}
        data={[
          { id: 1, a: 1.234 },
          { id: 2, a: 2.345 },
        ]}
        rowKey="id"
        aggregateAccuracy={1}
      />,
    )
    // 1.234 + 2.345 = 3.579 → rounded 3.6 before the custom renderer.
    expect(renderSummary).toHaveBeenCalledWith(3.6, expect.any(Array))
    expect(container.querySelector('[data-iris-table-summary-cell]')?.textContent).toBe('$3.6')
  })

  it('aggregateAccuracy outside 0–100 is ignored (no toFixed RangeError)', () => {
    // toFixed(-1) / toFixed(101) throw RangeError — out-of-range accuracy
    // must disable rounding instead of crashing the render.
    const a = render(<IrisTable columns={cols} data={rows} rowKey="id" aggregateAccuracy={-1} />)
    expect(
      [...a.container.querySelectorAll('[data-iris-table-summary-cell]')].map(
        (el) => el.textContent,
      ),
    ).toEqual(['31', '5.85987'])
    cleanup()
    const b = render(<IrisTable columns={cols} data={rows} rowKey="id" aggregateAccuracy={101} />)
    expect(
      [...b.container.querySelectorAll('[data-iris-table-summary-cell]')].map(
        (el) => el.textContent,
      ),
    ).toEqual(['31', '5.85987'])
  })
})

describe('IrisTable header/footer tooltips (vxe tooltip-config parity, batch P)', () => {
  it('headerTooltipConfig renders title attrs on flat header cells', () => {
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        headerTooltipConfig={{ content: (col) => `Tip: ${col.title}` }}
      />,
    )
    const h = headers(container)
    expect(h.map((el) => el.getAttribute('title'))).toEqual(['Tip: Name', 'Tip: Qty', 'Tip: Price'])
  })

  it('headerTooltipConfig covers grouped header cells too', () => {
    const grouped: IrisTableColumn<Row>[] = [
      {
        key: 'g',
        title: 'Group',
        children: [
          { key: 'name', title: 'Name' },
          { key: 'qty', title: 'Qty' },
        ],
      },
      { key: 'price', title: 'Price' },
    ]
    const { container } = render(
      <IrisTable
        columns={grouped}
        data={rows}
        rowKey="id"
        headerTooltipConfig={{ content: (col) => `T:${col.title}` }}
      />,
    )
    const titles = new Set(headers(container).map((el) => el.getAttribute('title')))
    expect(titles).toEqual(new Set(['T:Group', 'T:Name', 'T:Qty', 'T:Price']))
  })

  it('empty header tooltip content drops the title', () => {
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        headerTooltipConfig={{ content: () => '' }}
      />,
    )
    expect(headers(container).every((el) => el.getAttribute('title') === null)).toBe(true)
  })

  it('footerTooltipConfig renders title attrs on summary and footerData cells', () => {
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        footerData={[{ id: 0, name: 'Grand', qty: 31, price: 5.86 }]}
        footerTooltipConfig={{ content: (col) => `F: ${col.title}` }}
      />,
    )
    const summaryCells = [...container.querySelectorAll('[data-iris-table-summary-cell]')]
    expect(summaryCells.map((el) => el.getAttribute('title'))).toEqual(['F: Qty', 'F: Price'])
    const footerCells = [...container.querySelectorAll('[data-iris-table-footer-cell]')]
    expect(footerCells.map((el) => el.getAttribute('title'))).toEqual([
      'F: Name',
      'F: Qty',
      'F: Price',
    ])
  })

  it('footerTooltipConfig covers footerMethod rows too', () => {
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        footerMethod={() => [{ id: 9, name: 'Total', qty: 31, price: 5.86 }]}
        footerTooltipConfig={{ content: (col) => `F: ${col.title}` }}
      />,
    )
    const cells = [...container.querySelectorAll('[data-iris-table-footer-method-cell]')]
    expect(cells.map((el) => el.getAttribute('title'))).toEqual(['F: Name', 'F: Qty', 'F: Price'])
  })

  it('empty footer tooltip content drops the title', () => {
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        footerData={[{ id: 0, name: 'Grand', qty: 31, price: 5.86 }]}
        footerTooltipConfig={{ content: () => '' }}
      />,
    )
    const cells = [
      ...container.querySelectorAll(
        '[data-iris-table-summary-cell], [data-iris-table-footer-cell], [data-iris-table-footer-method-cell]',
      ),
    ]
    expect(cells.every((el) => el.getAttribute('title') === null)).toBe(true)
  })
})
