import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
  price?: number
  progress?: number
  date?: string
  status?: string
}

const rows: Row[] = [
  {
    id: 1,
    name: 'Charlie',
    age: 25,
    price: 1234.5,
    progress: 0.42,
    date: '2026-08-13',
    status: 'active',
  },
  { id: 2, name: 'Alice', age: 32, price: 99.9, progress: 2, date: '2026-08-14', status: 'paused' },
  { id: 3, name: 'Bob', age: 28, price: 0, progress: 1, date: '2026-08-15', status: 'offline' },
]

// Lean rows for the shortcut write-back assertions (exact row-list equality).
const shortRows: Row[] = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
  { id: 3, name: 'Bob', age: 28 },
]

function cellAt(r: number, c: number): HTMLElement | null {
  return document.querySelector(`[data-grid-row="${r}"][data-grid-col="${c}"]`)
}

function bodyCell(key: string): HTMLElement {
  return document.querySelector(`[data-iris-table-cell="${key}"]`) as HTMLElement
}

function editor(): HTMLInputElement | null {
  return document.querySelector('[data-iris-table-editor]')
}

function focusGridCell(r: number, c: number): HTMLElement {
  const cell = cellAt(r, c)!
  act(() => {
    cell.focus()
    fireEvent.focus(cell)
  })
  return cell
}

describe('@iris-ui-kit/react IrisTable shortcuts (batch AN, iris 独有)', () => {
  const cols: IrisTableColumn<Row>[] = [
    { key: 'name', title: 'Name', editable: true },
    { key: 'age', title: 'Age', editable: true, editor: 'number' },
  ]

  it('F2 begins editing the focused cell (editable column, seeded value)', () => {
    render(<IrisTable columns={cols} data={rows} keyboardNavigation tableShortcuts />)
    const cell = focusGridCell(0, 0)
    act(() => fireEvent.keyDown(cell, { key: 'F2' }))
    expect(editor()).not.toBeNull()
    expect(editor()!.value).toBe('Charlie')
  })

  it('F2 on a non-editable column does nothing', () => {
    const nonEditable: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age' },
    ]
    render(<IrisTable columns={nonEditable} data={rows} keyboardNavigation tableShortcuts />)
    const cell = focusGridCell(0, 0)
    act(() => fireEvent.keyDown(cell, { key: 'F2' }))
    expect(editor()).toBeNull()
  })

  it('Delete clears the focused cell to "" via one commitRowList (onDataChange once)', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={shortRows}
        keyboardNavigation
        tableShortcuts
        onDataChange={onDataChange}
      />,
    )
    const cell = focusGridCell(0, 1)
    act(() => fireEvent.keyDown(cell, { key: 'Delete' }))
    expect(onDataChange).toHaveBeenCalledTimes(1)
    expect(onDataChange).toHaveBeenCalledWith([
      { id: 1, name: 'Charlie', age: '' },
      { id: 2, name: 'Alice', age: 32 },
      { id: 3, name: 'Bob', age: 28 },
    ])
    expect(cell.textContent).toBe('')
    expect(editor()).toBeNull() // no editor involved
  })

  it('Backspace clears the focused cell too', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={shortRows}
        keyboardNavigation
        tableShortcuts
        onDataChange={onDataChange}
      />,
    )
    const cell = focusGridCell(0, 0)
    act(() => fireEvent.keyDown(cell, { key: 'Backspace' }))
    expect(onDataChange).toHaveBeenCalledWith([
      { id: 1, name: '', age: 25 },
      { id: 2, name: 'Alice', age: 32 },
      { id: 3, name: 'Bob', age: 28 },
    ])
    expect(cell.textContent).toBe('')
  })

  it('inert without tableShortcuts (even with keyboardNavigation)', () => {
    const onDataChange = vi.fn()
    render(<IrisTable columns={cols} data={rows} keyboardNavigation onDataChange={onDataChange} />)
    const cell = focusGridCell(0, 0)
    act(() => fireEvent.keyDown(cell, { key: 'F2' }))
    act(() => fireEvent.keyDown(cell, { key: 'Delete' }))
    expect(editor()).toBeNull()
    expect(onDataChange).not.toHaveBeenCalled()
  })

  it('inert without keyboardNavigation (no focused-cell state)', () => {
    const onDataChange = vi.fn()
    render(<IrisTable columns={cols} data={rows} tableShortcuts onDataChange={onDataChange} />)
    const cell = bodyCell('name')
    act(() => {
      cell.focus()
      fireEvent.focus(cell)
    })
    act(() => fireEvent.keyDown(cell, { key: 'F2' }))
    act(() => fireEvent.keyDown(cell, { key: 'Delete' }))
    expect(editor()).toBeNull()
    expect(onDataChange).not.toHaveBeenCalled()
  })

  it('inert while an inline editor is open (editor keys win)', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        keyboardNavigation
        tableShortcuts
        onDataChange={onDataChange}
      />,
    )
    focusGridCell(0, 0)
    act(() => fireEvent.keyDown(cellAt(0, 0)!, { key: 'F2' }))
    expect(editor()).not.toBeNull()
    // F2 / Delete from the editor input must not start a second session or clear.
    act(() => fireEvent.keyDown(editor()!, { key: 'F2' }))
    act(() => fireEvent.keyDown(editor()!, { key: 'Delete' }))
    expect(editor()).not.toBeNull()
    expect(editor()!.value).toBe('Charlie')
    expect(onDataChange).not.toHaveBeenCalled()
  })
})

describe('@iris-ui-kit/react IrisTable column presets (batch AN, iris 独有)', () => {
  it('money preset formats 2 decimals + thousands, right-aligned, number editor', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'price', title: 'Price', preset: 'money', editable: true },
    ]
    render(<IrisTable columns={cols} data={rows} />)
    const cell = bodyCell('price')
    expect(cell.textContent).toBe('1,234.50')
    expect(cell.style.justifyContent).toBe('flex-end')
    act(() => fireEvent.doubleClick(cell))
    expect(editor()!.type).toBe('number')
  })

  it('progress preset renders percent text (0..1 vs raw), right-aligned', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'progress', title: 'Progress', preset: 'progress' },
    ]
    render(<IrisTable columns={cols} data={rows} />)
    const cells = Array.from(document.querySelectorAll('[data-iris-table-cell="progress"]'))
    expect(cells.map((c) => c.textContent)).toEqual(['42%', '2%', '100%'])
    expect((cells[0] as HTMLElement).style.justifyContent).toBe('flex-end')
  })

  it('date preset passes the value through as String, left-aligned', () => {
    const cols: IrisTableColumn<Row>[] = [{ key: 'date', title: 'Date', preset: 'date' }]
    render(<IrisTable columns={cols} data={rows} />)
    const cells = Array.from(document.querySelectorAll('[data-iris-table-cell="date"]'))
    expect(cells.map((c) => c.textContent)).toEqual(['2026-08-13', '2026-08-14', '2026-08-15'])
    expect((cells[0] as HTMLElement).style.justifyContent).toBe('flex-start')
  })

  it('status preset renders UPPERCASE text, centered', () => {
    const cols: IrisTableColumn<Row>[] = [{ key: 'status', title: 'Status', preset: 'status' }]
    render(<IrisTable columns={cols} data={rows} />)
    const cells = Array.from(document.querySelectorAll('[data-iris-table-cell="status"]'))
    expect(cells.map((c) => c.textContent)).toEqual(['ACTIVE', 'PAUSED', 'OFFLINE'])
    expect((cells[0] as HTMLElement).style.justifyContent).toBe('center')
  })

  it('user fields win over preset defaults (formatter + align)', () => {
    const cols: IrisTableColumn<Row>[] = [
      {
        key: 'price',
        title: 'Price',
        preset: 'money',
        align: 'left',
        formatter: (v) => `$${String(v)}`,
      },
    ]
    render(<IrisTable columns={cols} data={rows} />)
    const cell = bodyCell('price')
    expect(cell.textContent).toBe('$1234.5')
    expect(cell.style.justifyContent).toBe('flex-start')
  })

  it('grouped headers: leaf columns inherit the preset', () => {
    const cols: IrisTableColumn<Row>[] = [
      {
        key: 'money',
        title: 'Money',
        children: [
          { key: 'price', title: 'Price', preset: 'money' },
          { key: 'progress', title: 'Progress', preset: 'progress' },
        ],
      },
    ]
    render(<IrisTable columns={cols} data={rows} />)
    expect(bodyCell('price').textContent).toBe('1,234.50')
    expect(bodyCell('progress').textContent).toBe('42%')
    expect(bodyCell('price').style.justifyContent).toBe('flex-end')
  })
})
