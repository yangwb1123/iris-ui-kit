import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(cleanup)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

const current: Row[] = [
  { id: 1, name: 'Alice', age: 32 },
  { id: 2, name: 'Bob', age: 28 },
]

/** Snapshot for the compare view: id=1 differs (age 99), id=3 is snapshot-only. */
const snapshot: Row[] = [
  { id: 1, name: 'Alice', age: 99 },
  { id: 3, name: 'Carol', age: 44 },
]

function row(rowId: string | number): HTMLElement {
  return document.querySelector(`[data-iris-table-row="${rowId}"]`) as HTMLElement
}

function cell(rowId: string | number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}

function attrs(el: HTMLElement): string[] {
  return ['added', 'removed', 'changed']
    .filter((kind) => el.hasAttribute(`data-iris-row-${kind}`))
    .map((kind) => kind)
}

// ── Compare view (iris 独有, batch AU) ────────────────────────────────────
describe('IrisTable compare view (compareWith)', () => {
  it('marks a row present in both with differing cells as changed (+ cell attr)', () => {
    render(<IrisTable columns={cols} data={current} rowKey="id" compareWith={snapshot} />)
    expect(attrs(row(1))).toEqual(['changed'])
    expect(cell(1, 'age').getAttribute('data-iris-cell-changed')).toBe('true')
    expect(cell(1, 'name').getAttribute('data-iris-cell-changed')).toBeNull()
  })

  it('marks a live row absent from the snapshot as removed', () => {
    render(<IrisTable columns={cols} data={current} rowKey="id" compareWith={snapshot} />)
    expect(attrs(row(2))).toEqual(['removed'])
    expect(row(2).getAttribute('data-iris-row-changed')).toBeNull()
  })

  it('leaves rows identical in both lists unmarked', () => {
    render(<IrisTable columns={cols} data={current} rowKey="id" compareWith={snapshot} />)
    // id=3 is snapshot-only (no rendered slot — the compare view renders the
    // live dataset, documented); id=1/2 carry only their own status.
    expect(document.querySelector('[data-iris-table-row="3"]')).toBeNull()
  })

  it('changed cell tooltip shows old → new (live value → snapshot value)', () => {
    render(<IrisTable columns={cols} data={current} rowKey="id" compareWith={snapshot} />)
    expect(cell(1, 'age').getAttribute('title')).toBe('Old: 32 → New: 99')
  })

  it('the compare tooltip overrides the tooltipConfig title on changed cells', () => {
    const withTip: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age' },
    ]
    render(
      <IrisTable
        columns={withTip}
        data={current}
        rowKey="id"
        compareWith={snapshot}
        tooltipConfig={{ content: (row) => `tip-${row.id}` }}
      />,
    )
    // Changed cell: compare tooltip wins.
    expect(cell(1, 'age').getAttribute('title')).toBe('Old: 32 → New: 99')
    // Unchanged cell on the same row: tooltipConfig still applies.
    expect(cell(1, 'name').getAttribute('title')).toBe('tip-1')
  })

  it('tooltipConfig keeps working on changed rows without compareWith', () => {
    render(
      <IrisTable
        columns={cols}
        data={current}
        rowKey="id"
        tooltipConfig={{ content: (row) => `tip-${row.id}` }}
      />,
    )
    expect(cell(1, 'name').getAttribute('title')).toBe('tip-1')
  })

  it('no compareWith → no compare attrs at all', () => {
    render(<IrisTable columns={cols} data={current} rowKey="id" />)
    expect(attrs(row(1))).toEqual([])
    expect(attrs(row(2))).toEqual([])
    expect(cell(1, 'age').getAttribute('data-iris-cell-changed')).toBeNull()
    expect(cell(1, 'age').getAttribute('title')).toBeNull()
  })

  it('an identical snapshot produces no attrs', () => {
    render(
      <IrisTable
        columns={cols}
        data={current}
        rowKey="id"
        compareWith={current.map((r) => ({ ...r }))}
      />,
    )
    expect(attrs(row(1))).toEqual([])
    expect(attrs(row(2))).toEqual([])
    expect(cell(1, 'age').getAttribute('data-iris-cell-changed')).toBeNull()
  })

  it('rows without the key field stay inert (no diff identity)', () => {
    interface LooseRow extends Record<string, unknown> {
      name: string
      age: number
    }
    const looseCols: IrisTableColumn<LooseRow>[] = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age' },
    ]
    const keyless: LooseRow[] = [
      { name: 'Alice', age: 32 },
      { name: 'Bob', age: 28 },
    ]
    const snap: LooseRow[] = [{ name: 'Alice', age: 99 }]
    render(<IrisTable columns={looseCols} data={keyless} compareWith={snap} />)
    expect(document.querySelector('[data-iris-row-changed="true"]')).toBeNull()
    expect(document.querySelector('[data-iris-row-removed="true"]')).toBeNull()
    expect(document.querySelector('[data-iris-cell-changed]')).toBeNull()
  })

  it('dataIndex columns resolve their changed cell via the object key', () => {
    const indexed: IrisTableColumn<Row>[] = [
      { key: 'alias', dataIndex: 'name', title: 'Alias' },
      { key: 'age', title: 'Age' },
    ]
    const snap: Row[] = [{ id: 1, name: 'Zoe', age: 99 }]
    render(<IrisTable columns={indexed} data={current} rowKey="id" compareWith={snap} />)
    expect(attrs(row(1))).toEqual(['changed'])
    expect(cell(1, 'alias').getAttribute('data-iris-cell-changed')).toBe('true')
    expect(cell(1, 'alias').getAttribute('title')).toBe('Old: Alice → New: Zoe')
  })

  it('flags every changed cell of a multi-change row', () => {
    const wide: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age' },
    ]
    const snap: Row[] = [{ id: 1, name: 'Zoe', age: 99 }]
    render(<IrisTable columns={wide} data={current} rowKey="id" compareWith={snap} />)
    expect(attrs(row(1))).toEqual(['changed'])
    expect(cell(1, 'name').getAttribute('data-iris-cell-changed')).toBe('true')
    expect(cell(1, 'age').getAttribute('data-iris-cell-changed')).toBe('true')
    expect(cell(1, 'name').getAttribute('title')).toBe('Old: Alice → New: Zoe')
    expect(cell(1, 'age').getAttribute('title')).toBe('Old: 32 → New: 99')
  })

  it('null/empty values render in the tooltip without "undefined"', () => {
    const snap: Row[] = [{ id: 1, name: 'Alice', age: null as unknown as number }]
    render(<IrisTable columns={cols} data={current} rowKey="id" compareWith={snap} />)
    expect(cell(1, 'age').getAttribute('title')).toBe('Old: 32 → New: ')
  })

  it('row and cell attributes disappear when compareWith is removed', () => {
    const { rerender } = render(
      <IrisTable columns={cols} data={current} rowKey="id" compareWith={snapshot} />,
    )
    expect(attrs(row(1))).toEqual(['changed'])
    rerender(<IrisTable columns={cols} data={current} rowKey="id" />)
    expect(attrs(row(1))).toEqual([])
    expect(cell(1, 'age').getAttribute('data-iris-cell-changed')).toBeNull()
  })
})
