import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'

afterEach(cleanup)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number | string
  score?: unknown
  joined?: unknown
  active?: unknown
  total?: unknown
}

function headerCell(key: string): HTMLElement {
  return document.querySelector(`[data-iris-table-header="${key}"]`) as HTMLElement
}

function cellTexts(key: string): Array<string | null> {
  return Array.from(document.querySelectorAll(`[data-iris-table-cell="${key}"]`)).map(
    (c) => c.textContent,
  )
}

/** The row-key order the cells render in — the visible sort order. */
function cellRowOrder(key: string): Array<string | null> {
  return Array.from(document.querySelectorAll(`[data-iris-table-cell="${key}"]`)).map(
    (c) => c.closest('[data-iris-table-row]')?.getAttribute('data-iris-table-row') ?? null,
  )
}

// ── Auto column-type detection (iris 独有, batch CX) ──────────────────────
describe('IrisTable autoDetectTypes', () => {
  it('numeric column → header right-aligned (spec ①: closes the header-align gap)', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age' },
    ]
    const rows: Row[] = [
      { id: 1, name: 'Alice', age: 32 },
      { id: 2, name: 'Bob', age: 28 },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" autoDetectTypes />)
    // The pre-prop gap: the body cell already right-aligns numbers, the
    // header stayed left — detection fills col.align so both agree now.
    expect(headerCell('age').style.justifyContent).toBe('flex-end')
    expect(headerCell('name').style.justifyContent).toBe('flex-start')
    expect(
      (document.querySelector('[data-iris-table-cell="age"]') as HTMLElement).style.justifyContent,
    ).toBe('flex-end')
  })

  it('numeric column sorts numerically across heterogeneous (nullish) rows (spec ②)', () => {
    const cols: IrisTableColumn<Row>[] = [{ key: 'score', title: 'Score', sortable: true }]
    const rows: Row[] = [
      { id: 1, score: 10 },
      { id: 2, score: null },
      { id: 3, score: 3 },
      { id: 4, score: 20 },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" autoDetectTypes />)
    act(() => {
      fireEvent.click(headerCell('score'))
    })
    // Detection skips the nullish cell (still 'number') → the pinned
    // 'number' sortType sorts numerically; nulls sort first per compareValues.
    expect(cellTexts('score')).toEqual(['', '3', '10', '20'])
  })

  it('string column → left align + string sort (spec ③)', () => {
    const cols: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name', sortable: true }]
    const rows: Row[] = [
      { id: 1, name: 'Bob' },
      { id: 2, name: 'Alice' },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" autoDetectTypes />)
    expect(headerCell('name').style.justifyContent).toBe('flex-start')
    act(() => {
      fireEvent.click(headerCell('name'))
    })
    expect(cellTexts('name')).toEqual(['Alice', 'Bob'])
  })

  it('ISO date column → left align + chronological string sort (spec ③)', () => {
    const cols: IrisTableColumn<Row>[] = [{ key: 'joined', title: 'Joined', sortable: true }]
    const rows: Row[] = [
      { id: 1, joined: '2024-01-15' },
      { id: 2, joined: '2023-06-01' },
      { id: 3, joined: '2024-06-01' },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" autoDetectTypes />)
    expect(headerCell('joined').style.justifyContent).toBe('flex-start')
    act(() => {
      fireEvent.click(headerCell('joined'))
    })
    expect(cellTexts('joined')).toEqual(['2023-06-01', '2024-01-15', '2024-06-01'])
  })

  it('boolean column → left align + string sort (spec ③)', () => {
    const cols: IrisTableColumn<Row>[] = [{ key: 'active', title: 'Active', sortable: true }]
    const rows: Row[] = [
      { id: 1, active: true },
      { id: 2, active: false },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" autoDetectTypes />)
    expect(headerCell('active').style.justifyContent).toBe('flex-start')
    act(() => {
      fireEvent.click(headerCell('active'))
    })
    // React renders `false` as an empty node — assert the visible ORDER via
    // the row keys instead: "false" < "true" sorts row 2 before row 1.
    expect(cellRowOrder('active')).toEqual(['2', '1'])
  })

  it('off by default → byte-identical (header keeps left; no sortType fill)', () => {
    const cols: IrisTableColumn<Row>[] = [{ key: 'age', title: 'Age' }]
    const rows: Row[] = [{ id: 1, age: 32 }]
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    // The pre-prop behavior: body falls back per-cell, the header stays left.
    expect(headerCell('age').style.justifyContent).toBe('flex-start')
    expect(
      (document.querySelector('[data-iris-table-cell="age"]') as HTMLElement).style.justifyContent,
    ).toBe('flex-end')
  })

  it('explicit align/sortType always win over detection', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'age', title: 'Age', align: 'center', sortType: 'string', sortable: true },
    ]
    const rows: Row[] = [
      { id: 1, age: 10 },
      { id: 2, age: 2 },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" autoDetectTypes />)
    // align: 'center' survives the number detection (fills only undefined).
    expect(headerCell('age').style.justifyContent).toBe('center')
    // sortType stays the explicit contract — here the caller pinned string:
    // a numeric column with explicit string sort orders "10" before "2".
    act(() => {
      fireEvent.click(headerCell('age'))
    })
    expect(cellTexts('age')).toEqual(['10', '2'])
  })

  it('preset defaults survive detection (defined-fields-only fill)', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'price', title: 'Price', preset: 'money', sortable: true },
    ]
    const rows: Row[] = [
      { id: 1, price: 10 },
      { id: 2, price: 3 },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" autoDetectTypes />)
    // The money preset already right-aligns — detection keeps it and pins
    // the (previously unset) sortType to 'number'.
    expect(headerCell('price').style.justifyContent).toBe('flex-end')
    act(() => {
      fireEvent.click(headerCell('price'))
    })
    // The money preset's 2-decimal formatter applies to the cells.
    expect(cellTexts('price')).toEqual(['3.00', '10.00'])
  })

  it('one-shot per mount: a later data re-feed does not re-detect', () => {
    const cols: IrisTableColumn<Row>[] = [{ key: 'age', title: 'Age' }]
    const { rerender } = render(
      <IrisTable columns={cols} data={[{ id: 1, age: 32 }]} rowKey="id" autoDetectTypes />,
    )
    expect(headerCell('age').style.justifyContent).toBe('flex-end')
    // Re-feed with strings: the one-shot guard keeps the number inference.
    rerender(
      <IrisTable
        columns={cols}
        data={[{ id: 1, age: 'thirty-two' }]}
        rowKey="id"
        autoDetectTypes
      />,
    )
    expect(headerCell('age').style.justifyContent).toBe('flex-end')
  })

  it('async arrival: empty at mount → detects on the first non-empty data', () => {
    const cols: IrisTableColumn<Row>[] = [{ key: 'age', title: 'Age' }]
    const { rerender } = render(<IrisTable columns={cols} data={[]} rowKey="id" autoDetectTypes />)
    expect(headerCell('age').style.justifyContent).toBe('flex-start')
    rerender(<IrisTable columns={cols} data={[{ id: 1, age: 32 }]} rowKey="id" autoDetectTypes />)
    expect(headerCell('age').style.justifyContent).toBe('flex-end')
  })

  it('grouped headers: leaf columns get detected, the group cell stays centered', () => {
    const cols: IrisTableColumn<Row>[] = [
      {
        key: 'info',
        title: 'Info',
        children: [
          { key: 'age', title: 'Age' },
          { key: 'name', title: 'Name' },
        ],
      },
    ]
    const rows: Row[] = [
      { id: 1, name: 'Alice', age: 32 },
      { id: 2, name: 'Bob', age: 28 },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" autoDetectTypes />)
    expect(headerCell('info').style.justifyContent).toBe('center')
    expect(headerCell('age').style.justifyContent).toBe('flex-end')
    expect(headerCell('name').style.justifyContent).toBe('flex-start')
  })

  it('formula columns skipped; mixed values fail back to string', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'total', title: 'Total', formula: '=price * qty' },
      { key: 'score', title: 'Score' },
    ]
    const rows: Row[] = [
      { id: 1, price: 2, qty: 3, score: 1 },
      { id: 2, price: 4, qty: 1, score: 'two' },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" autoDetectTypes />)
    // Formula columns are skipped entirely — no detection fill (their
    // sortType is the caller's contract on the computed value).
    expect(headerCell('total').style.justifyContent).toBe('flex-start')
    // Mixed [1, 'two'] → 'string' fail-safe → left align, no numeric pin.
    expect(headerCell('score').style.justifyContent).toBe('flex-start')
  })
})
