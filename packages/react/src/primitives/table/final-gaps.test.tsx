import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

interface Row extends Record<string, unknown> {
  id?: number
  name?: string
  age?: number
  a?: string
  b?: string
  c?: string
}

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'age', title: 'Age' },
]

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
]

function root(): HTMLElement {
  return document.querySelector('[data-iris-table]') as HTMLElement
}

function bodyCell(rowId: string | number, key: string): HTMLElement | null {
  return document.querySelector(`[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`)
}

function footerCell(key: string): HTMLElement | null {
  return document.querySelector(`[data-iris-table-footer-cell][data-iris-table-cell="${key}"]`)
}

function summaryCell(key: string): HTMLElement | null {
  return document.querySelector(`[data-iris-table-summary-cell][data-iris-table-cell="${key}"]`)
}

function editor(): HTMLInputElement | null {
  return document.querySelector('[data-iris-table-editor]')
}

/** Commit a new value into a cell via the editor (dblclick → change → Enter). */
function commitCell(rowId: string | number, key: string, value: string): void {
  act(() => {
    fireEvent.doubleClick(bodyCell(rowId, key)!)
  })
  act(() => {
    fireEvent.change(editor()!, { target: { value } })
    fireEvent.keyDown(editor()!, { key: 'Enter' })
  })
}

describe('@iris-ui-kit/react IrisTable zIndex (batch R)', () => {
  it('applies z-index to the root with position: relative', () => {
    render(<IrisTable columns={cols} data={rows} zIndex={10} />)
    expect(root().style.zIndex).toBe('10')
    expect(root().style.position).toBe('relative')
  })

  it('omits both by default and lets a caller style override', () => {
    const { unmount } = render(<IrisTable columns={cols} data={rows} />)
    expect(root().style.zIndex).toBe('')
    expect(root().style.position).toBe('')
    unmount()
    render(<IrisTable columns={cols} data={rows} zIndex={10} style={{ zIndex: 99 }} />)
    expect(root().style.zIndex).toBe('99')
  })
})

describe('@iris-ui-kit/react IrisTable syncResize (batch R)', () => {
  function installMeasureSpy(el: HTMLElement, measures: ReturnType<typeof vi.fn>): void {
    Object.defineProperty(el, 'clientWidth', {
      configurable: true,
      get: () => {
        measures()
        return 600
      },
    })
    Object.defineProperty(el, 'clientHeight', {
      configurable: true,
      get: () => {
        measures()
        return 300
      },
    })
  }

  it('runs the shared root measure on mount and again on data change', () => {
    const measures = vi.fn()
    const { rerender } = render(<IrisTable columns={cols} data={rows} syncResize />)
    const el = root()
    // The mount measure already ran (autoSize engaged the fixed-height
    // machinery); install the spy so later measures are observable.
    expect(el.getAttribute('data-iris-table-fixed-height')).toBe('true')
    expect(el.style.height).toBe('100%')
    installMeasureSpy(el, measures)
    const next = [{ id: 3, name: 'Bob', age: 40 }]
    rerender(<IrisTable columns={cols} data={next} syncResize />)
    expect(measures).toHaveBeenCalledTimes(2)
    // Unchanged data reference (same props) does not re-measure.
    rerender(<IrisTable columns={cols} data={next} syncResize />)
    expect(measures).toHaveBeenCalledTimes(2)
  })

  it('does nothing when a height is set (explicit height wins)', () => {
    const measures = vi.fn()
    const { rerender } = render(<IrisTable columns={cols} data={rows} syncResize height={300} />)
    installMeasureSpy(root(), measures)
    rerender(<IrisTable columns={cols} data={[{ id: 3, name: 'Bob' }]} syncResize height={300} />)
    expect(measures).not.toHaveBeenCalled()
    expect(root().style.height).toBe('300px')
  })
})

describe('@iris-ui-kit/react IrisTable keepSource (batch R)', () => {
  it('seeds liveData with a copy — mutating the original after mount changes nothing', () => {
    const src: Row[] = [{ id: 1, name: 'A' }]
    const { rerender } = render(<IrisTable columns={cols} data={src} keepSource />)
    expect(document.querySelectorAll('[data-iris-table-cell="name"]')).toHaveLength(1)
    act(() => {
      src.push({ id: 2, name: 'B' })
    })
    rerender(<IrisTable columns={cols} data={src} keepSource />)
    expect(document.querySelectorAll('[data-iris-table-cell="name"]')).toHaveLength(1)
    expect(bodyCell(2, 'name')).toBeNull()
  })

  it('without keepSource the seed keeps the reference (mutation is visible)', () => {
    const src: Row[] = [{ id: 1, name: 'A' }]
    const { rerender } = render(<IrisTable columns={cols} data={src} />)
    act(() => {
      src.push({ id: 2, name: 'B' })
    })
    rerender(<IrisTable columns={cols} data={src} />)
    expect(document.querySelectorAll('[data-iris-table-cell="name"]')).toHaveLength(2)
    expect(bodyCell(2, 'name')).not.toBeNull()
  })
})

describe('@iris-ui-kit/react IrisTable rowId (batch R)', () => {
  const unkeyed: Row[] = [{ name: 'A' }, { name: 'B' }]

  it('rows without the rowKey field get the rowId key (selection)', () => {
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={unkeyed}
        rowKey="id"
        selectable="multi"
        rowId={(row, i) => i}
        onSelectionChange={onChange}
      />,
    )
    const checkboxes = Array.from(document.querySelectorAll('input[type=checkbox]'))
    // [0] is the header select-all; row checkboxes follow.
    act(() => {
      fireEvent.click(checkboxes[1]!)
    })
    expect(onChange).toHaveBeenCalledWith([0])
    expect(
      document.querySelector('[data-iris-table-row="0"][data-iris-table-row-selected="true"]'),
    ).not.toBeNull()
  })

  it('edits commit by the rowId key (write-back locates the row by computed key)', () => {
    render(<IrisTable columns={cols} data={unkeyed} rowKey="id" rowId={(row, i) => i} />)
    expect(bodyCell(0, 'name')!.textContent).toBe('A')
    commitCell(0, 'name', 'A Edited')
    expect(bodyCell(0, 'name')!.textContent).toBe('A Edited')
    expect(bodyCell(1, 'name')!.textContent).toBe('B')
  })

  it('rowKey wins over rowId', () => {
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        selectable="multi"
        rowId={(row, i) => 100 + i}
        onSelectionChange={onChange}
      />,
    )
    const checkboxes = Array.from(document.querySelectorAll('input[type=checkbox]'))
    // [0] is the header select-all; row checkboxes follow.
    act(() => {
      fireEvent.click(checkboxes[2]!)
    })
    expect(onChange).toHaveBeenCalledWith([2])
    expect(document.querySelector('[data-iris-table-row="2"]')).not.toBeNull()
    expect(document.querySelector('[data-iris-table-row="101"]')).toBeNull()
  })

  it('tree flatten keys use rowId too', () => {
    const tree: Row[] = [{ name: 'root' }, { name: 'leaf' }]
    render(
      <IrisTable
        columns={cols}
        data={tree}
        rowKey="id"
        rowId={(row) => String(row.name)}
        getSubRows={(row) => (row.name === 'root' ? [{ name: 'child' }] : undefined)}
      />,
    )
    act(() => {
      fireEvent.click(document.querySelector('[data-iris-table-tree-toggle]')!)
    })
    expect(document.querySelector('[data-iris-table-row="child"]')).not.toBeNull()
    expect(document.querySelector('[data-iris-table-row="root"]')).not.toBeNull()
  })

  it('expandAll seeds keyless tree parents with flattenTree keys, not indices', () => {
    // Keyless rows (no rowKey field, no rowId): flattenTree getKey falls
    // back to `String(rowKeyOf(row))` → "undefined" for every keyless row.
    // The expandAll seed MUST use the same expression — index keys (batch R
    // regression) would never match flattenTree's, breaking the additive
    // guard. (Children of fully-keyless rows stay invisible regardless —
    // flattenTree's seen-guard collides on the shared key, pre-existing
    // degenerate behavior.)
    const onExpanded = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={[{ name: 'root' }]}
        rowKey="id"
        getSubRows={(row) => (row.name === 'root' ? [{ name: 'child' }] : undefined)}
        expandAll
        onExpandedRowsChange={onExpanded}
      />,
    )
    expect(onExpanded).toHaveBeenCalledWith(['undefined'])
  })
})

describe('@iris-ui-kit/react IrisTable mergeFooterItems (batch R)', () => {
  const three: IrisTableColumn<Row>[] = [
    { key: 'a', title: 'A' },
    { key: 'b', title: 'B' },
    { key: 'c', title: 'C' },
  ]
  const footerRows: Row[] = [{ id: 9, name: 'Total', a: 'Total', b: 'X', c: 'Y' }]

  it('colspan merges footerData cells and the covered cell renders null', () => {
    render(
      <IrisTable
        columns={three}
        data={rows}
        footerData={footerRows}
        mergeFooterItems={[{ row: 0, col: 0, colspan: 2 }]}
      />,
    )
    const a = footerCell('a')!
    expect(a.style.gridColumnEnd).toBe('span 2')
    expect(footerCell('b')).toBeNull()
    expect(footerCell('c')).not.toBeNull()
  })

  it('rowspan is inert — covered cells of later rows keep their data', () => {
    const two = [
      { id: 9, name: 'Total', a: 'Total', b: 'X' },
      { id: 10, name: 'Sub', a: 'Sub', b: 'Y' },
    ]
    render(
      <IrisTable
        columns={three}
        data={rows}
        footerData={two}
        mergeFooterItems={[{ row: 0, col: 0, rowspan: 2 }]}
      />,
    )
    // Inert rowspan (review fix): each footer row is its own grid container,
    // so no gridRowEnd span — and the covered cell of row 1 renders its own
    // data (a null would auto-place the remaining cells into earlier tracks,
    // putting data under the wrong columns).
    expect(footerCell('a')!.style.gridRowEnd).toBe('')
    const aCells = Array.from(
      document.querySelectorAll('[data-iris-table-footer-cell][data-iris-table-cell="a"]'),
    )
    expect(aCells).toHaveLength(2)
    expect(aCells[0]!.textContent).toBe('Total')
    expect(aCells[1]!.textContent).toBe('Sub')
    const bCells = Array.from(
      document.querySelectorAll('[data-iris-table-footer-cell][data-iris-table-cell="b"]'),
    )
    expect(bCells).toHaveLength(2)
    expect(bCells[0]!.textContent).toBe('X')
    expect(bCells[1]!.textContent).toBe('Y')
  })

  it('applies to the summary row path (renderSummaryRow)', () => {
    const summaryCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age', summary: 'sum' },
    ]
    render(
      <IrisTable
        columns={summaryCols}
        data={rows}
        mergeFooterItems={[{ row: 0, col: 0, colspan: 2 }]}
      />,
    )
    const summaryName = document.querySelector(
      '[data-iris-table-row="summary"] [data-iris-table-cell="name"]',
    ) as HTMLElement
    expect(summaryName.style.gridColumnEnd).toBe('span 2')
    expect(summaryCell('age')).toBeNull()
  })

  it('applies to the footerMethod path', () => {
    render(
      <IrisTable
        columns={three}
        data={rows}
        footerMethod={() => footerRows}
        mergeFooterItems={[{ row: 0, col: 0, colspan: 2 }]}
      />,
    )
    const a = document.querySelector(
      '[data-iris-table-footer-method-cell][data-iris-table-cell="a"]',
    ) as HTMLElement
    expect(a.style.gridColumnEnd).toBe('span 2')
    expect(footerCell('b')).toBeNull()
  })

  it('footerSpanMethod wins when both are provided', () => {
    render(
      <IrisTable
        columns={three}
        data={rows}
        footerData={footerRows}
        mergeFooterItems={[{ row: 0, col: 0, colspan: 2 }]}
        footerSpanMethod={() => null}
      />,
    )
    expect(footerCell('a')).not.toBeNull()
    expect(footerCell('b')).not.toBeNull()
    expect(footerCell('a')!.style.gridColumnEnd).toBe('')
  })

  it('out-of-stack entries are no-ops', () => {
    render(
      <IrisTable
        columns={three}
        data={rows}
        footerData={footerRows}
        mergeFooterItems={[{ row: 5, col: 0, colspan: 2 }]}
      />,
    )
    expect(footerCell('a')).not.toBeNull()
    expect(footerCell('b')).not.toBeNull()
  })
})
