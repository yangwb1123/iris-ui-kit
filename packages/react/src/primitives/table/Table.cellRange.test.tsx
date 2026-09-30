import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
  { id: 3, name: 'Bob', age: 28 },
]

const baseColumns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true, align: 'right' },
]

describe('@iris-ui-kit/react IrisTable cellRange', () => {
  function cell(rowIdx: number, colIdx: number): HTMLElement {
    return document.querySelector(
      `[data-iris-cell-row="${rowIdx}"][data-iris-cell-col="${colIdx}"]`,
    ) as HTMLElement
  }
  function selectedCells(): HTMLElement[] {
    return Array.from(document.querySelectorAll('[data-iris-cell-selected="true"]'))
  }

  it('renders data-iris-cell-row/col attributes on all data cells when cellRange=true', () => {
    render(<IrisTable columns={baseColumns} data={rows} cellRange />)
    expect(document.querySelectorAll('[data-iris-cell-row]').length).toBe(6)
    expect(cell(0, 0)).not.toBeNull()
    expect(cell(2, 1)).not.toBeNull()
  })

  it('click on a cell starts a 1×1 range and marks it selected', () => {
    render(<IrisTable columns={baseColumns} data={rows} cellRange />)
    act(() => fireEvent.click(cell(1, 0)))
    expect(selectedCells()).toHaveLength(1)
    expect(cell(1, 0).getAttribute('data-iris-cell-selected')).toBe('true')
  })

  it('Shift+Click extends the range and selects all cells within the rectangle', () => {
    render(<IrisTable columns={baseColumns} data={rows} cellRange />)
    act(() => fireEvent.click(cell(0, 0)))
    act(() => fireEvent.click(cell(2, 1), { shiftKey: true }))
    expect(selectedCells()).toHaveLength(6)
  })

  it('does NOT add cell-range attributes when cellRange is false (default)', () => {
    render(<IrisTable columns={baseColumns} data={rows} />)
    expect(document.querySelectorAll('[data-iris-cell-row]')).toHaveLength(0)
  })

  it('Escape clears the selection', () => {
    render(<IrisTable columns={baseColumns} data={rows} cellRange />)
    act(() => fireEvent.click(cell(0, 0)))
    expect(selectedCells()).toHaveLength(1)
    const table = document.querySelector('[data-iris-table]') as HTMLElement
    act(() => fireEvent.keyDown(table, { key: 'Escape' }))
    expect(selectedCells()).toHaveLength(0)
  })
})
