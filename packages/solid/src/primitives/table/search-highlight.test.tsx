import { afterEach, describe, expect, it } from 'vitest'
import { createSignal } from 'solid-js'
import { cleanup, render, waitFor } from '@solidjs/testing-library'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn } from './types'

afterEach(cleanup)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
]

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

function cellAt(container: HTMLElement, rowIndex: number, columnKey: string): HTMLElement {
  const rows = container.querySelectorAll<HTMLElement>('[role="row"][data-iris-table-row=""]')
  return rows[rowIndex]!.querySelector<HTMLElement>(`[data-iris-table-cell="${columnKey}"]`)!
}

function marksIn(cell: HTMLElement): HTMLElement[] {
  return Array.from(cell.querySelectorAll<HTMLElement>('mark[data-iris-search-hit]'))
}

describe('@iris-ui-kit/solid IrisTable searchHighlight', () => {
  it('renders no marks when the prop is absent', () => {
    const { container } = render(() => <IrisTable columns={columns} data={rows} rowKey="id" />)
    expect(container.querySelector('mark[data-iris-search-hit]')).toBeNull()
    expect(cellAt(container, 0, 'name').textContent).toBe('Charlie')
  })

  it('renders no marks for an empty query', () => {
    const { container } = render(() => (
      <IrisTable columns={columns} data={rows} rowKey="id" searchHighlight="" />
    ))
    expect(container.querySelector('mark[data-iris-search-hit]')).toBeNull()
    expect(cellAt(container, 0, 'name').textContent).toBe('Charlie')
  })

  it('wraps a literal hit while preserving the cell text', () => {
    const { container } = render(() => (
      <IrisTable columns={columns} data={rows} rowKey="id" searchHighlight="li" />
    ))
    const cell = cellAt(container, 0, 'name')
    expect(marksIn(cell).map((mark) => mark.textContent)).toEqual(['li'])
    expect(cell.textContent).toBe('Charlie')
  })

  it('matches case-insensitively and preserves source casing', () => {
    const { container } = render(() => (
      <IrisTable columns={columns} data={rows} rowKey="id" searchHighlight="CHARL" />
    ))
    const cell = cellAt(container, 0, 'name')
    expect(marksIn(cell).map((mark) => mark.textContent)).toEqual(['Charl'])
    expect(cell.textContent).toBe('Charlie')
  })

  it('marks every non-overlapping adjacent occurrence', () => {
    const adjacentRows: Row[] = [{ id: 1, name: 'aaaa', age: 1 }]
    const { container } = render(() => (
      <IrisTable columns={columns} data={adjacentRows} rowKey="id" searchHighlight="aa" />
    ))
    const cell = cellAt(container, 0, 'name')
    expect(marksIn(cell).map((mark) => mark.textContent)).toEqual(['aa', 'aa'])
    expect(cell.textContent).toBe('aaaa')
  })

  it('leaves an unmatched string unchanged', () => {
    const { container } = render(() => (
      <IrisTable columns={columns} data={rows} rowKey="id" searchHighlight="missing" />
    ))
    const cell = cellAt(container, 0, 'name')
    expect(marksIn(cell)).toHaveLength(0)
    expect(cell.textContent).toBe('Charlie')
  })

  it('does not wrap raw numbers or non-string formatter results', () => {
    const formattedColumns: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', formatter: () => 25 },
      { key: 'age', title: 'Age' },
    ]
    const { container } = render(() => (
      <IrisTable columns={formattedColumns} data={rows} rowKey="id" searchHighlight="25" />
    ))
    expect(marksIn(cellAt(container, 0, 'name'))).toHaveLength(0)
    expect(marksIn(cellAt(container, 0, 'age'))).toHaveLength(0)
    expect(cellAt(container, 0, 'name').textContent).toBe('25')
    expect(cellAt(container, 0, 'age').textContent).toBe('25')
  })

  it('searches formatter output after applying the mask, not the raw value', () => {
    const displayColumns: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        mask: () => 'SECRET',
        formatter: (value) => `display:${String(value)}`,
      },
      { key: 'age', title: 'Age' },
    ]
    const { container } = render(() => (
      <IrisTable columns={displayColumns} data={rows} rowKey="id" searchHighlight="secret" />
    ))
    const cell = cellAt(container, 0, 'name')
    expect(marksIn(cell).map((mark) => mark.textContent)).toEqual(['SECRET'])
    expect(cell.textContent).toBe('display:SECRET')
  })

  it('leaves renderCell output untouched', () => {
    const customColumns: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        renderCell: (row) => <span data-custom-render>{row.name}</span>,
      },
    ]
    const { container } = render(() => (
      <IrisTable columns={customColumns} data={rows} rowKey="id" searchHighlight="char" />
    ))
    const cell = cellAt(container, 0, 'name')
    expect(cell.querySelector('[data-custom-render]')?.textContent).toBe('Charlie')
    expect(marksIn(cell)).toHaveLength(0)
  })

  it('removes marks when the query is removed without changing text', async () => {
    const [query, setQuery] = createSignal<string | undefined>('li')
    const { container } = render(() => (
      <IrisTable columns={columns} data={rows} rowKey="id" searchHighlight={query()} />
    ))
    const cell = (): HTMLElement => cellAt(container, 0, 'name')
    expect(marksIn(cell())).toHaveLength(1)
    expect(cell().textContent).toBe('Charlie')

    setQuery(undefined)
    await waitFor(() => expect(marksIn(cell())).toHaveLength(0))
    expect(cell().textContent).toBe('Charlie')
  })
})
