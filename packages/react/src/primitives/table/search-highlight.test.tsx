import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
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
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

/** Body-cell lookup: row index → leaf cell index (works without cellRange). */
function cellAt(row: number, col: number): HTMLElement {
  const bodyRows = Array.from(
    document.querySelectorAll('[data-iris-table-row]:not([data-iris-table-row=header])'),
  )
  return bodyRows[row]!.querySelectorAll('[data-iris-table-cell]')[col] as HTMLElement
}

function marksIn(cell: HTMLElement): HTMLElement[] {
  return Array.from(cell.querySelectorAll('mark[data-iris-search-hit]'))
}

describe('@iris-ui-kit/react IrisTable searchHighlight', () => {
  it('renders no marks without the prop (fail-closed)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    expect(document.querySelector('mark[data-iris-search-hit]')).toBeNull()
    expect(cellAt(0, 0).textContent).toBe('Charlie')
  })

  it('renders no marks for an empty query (fail-closed)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" searchHighlight="" />)
    expect(document.querySelector('mark[data-iris-search-hit]')).toBeNull()
  })

  it('wraps the matched substring in mark[data-iris-search-hit]', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" searchHighlight="li" />)
    const mark = marksIn(cellAt(0, 0))[0]!
    expect(mark).not.toBeNull()
    expect(mark.textContent).toBe('li')
    // Cell text stays byte-identical (highlight is a wrapper, not a rewrite).
    expect(cellAt(0, 0).textContent).toBe('Charlie')
  })

  it('matches case-insensitively but preserves the original casing', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" searchHighlight="CHARL" />)
    const mark = marksIn(cellAt(0, 0))[0]!
    expect(mark.textContent).toBe('Charl')
    expect(cellAt(0, 0).textContent).toBe('Charlie')
  })

  it('highlights every occurrence (multi-hit)', () => {
    const bananaRows: Row[] = [{ id: 1, name: 'banana', age: 1 }]
    render(<IrisTable columns={cols} data={bananaRows} rowKey="id" searchHighlight="an" />)
    const marks = marksIn(cellAt(0, 0))
    expect(marks.length).toBe(2)
    expect(marks[0]!.textContent).toBe('an')
    expect(marks[1]!.textContent).toBe('an')
    expect(cellAt(0, 0).textContent).toBe('banana')
  })

  it('leaves non-string raw values untouched (numbers)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" searchHighlight="2" />)
    expect(marksIn(cellAt(0, 1)).length).toBe(0)
    expect(cellAt(0, 1).textContent).toBe('25')
  })

  it('highlights the formatter output string, not the raw value', () => {
    const fmtCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', formatter: (v) => `user:${String(v)}` },
      { key: 'age', title: 'Age' },
    ]
    render(<IrisTable columns={fmtCols} data={rows} rowKey="id" searchHighlight="user" />)
    const mark = marksIn(cellAt(0, 0))[0]!
    expect(mark.textContent).toBe('user')
    expect(cellAt(0, 0).textContent).toBe('user:Charlie')
  })

  it('leaves col.render and col.html cells untouched', () => {
    const mixedCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', render: (v) => <span data-custom-render>{String(v)}</span> },
      { key: 'age', title: 'Age', html: true },
    ]
    const htmlRows: Row[] = [{ id: 1, name: 'Charlie', age: '<b>25</b>' }]
    render(<IrisTable columns={mixedCols} data={htmlRows} rowKey="id" searchHighlight="25" />)
    expect(document.querySelector('mark[data-iris-search-hit]')).toBeNull()
    expect(cellAt(0, 0).querySelector('[data-custom-render]')).not.toBeNull()
    expect(cellAt(0, 1).querySelector('b')).not.toBeNull()
  })

  it('leaves col.link labels untouched (link wins)', () => {
    const linkCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', link: () => 'https://example.com' },
      { key: 'age', title: 'Age' },
    ]
    render(<IrisTable columns={linkCols} data={rows} rowKey="id" searchHighlight="Char" />)
    const a = cellAt(0, 0).querySelector('a[data-iris-table-link]')!
    expect(a).not.toBeNull()
    expect(a.textContent).toBe('Charlie')
    expect(marksIn(cellAt(0, 0)).length).toBe(0)
  })

  it('coexists with fnr — inline mark plus whole-cell fnr match on the same cell', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" fnr searchHighlight="ali" />)
    fireEvent.keyDown(document.querySelector('[data-iris-table]')!, { key: 'f', ctrlKey: true })
    fireEvent.change(document.querySelector('[data-iris-fnr-find]')!, {
      target: { value: 'ali' },
    })
    const alice = cellAt(1, 0)
    expect(alice.getAttribute('data-iris-fnr-match')).toBe('true')
    const marks = marksIn(alice)
    expect(marks.length).toBe(1)
    // Case-insensitive match preserves the ORIGINAL casing.
    expect(marks[0]!.textContent).toBe('Ali')
  })

  it('clears the marks when the prop is removed (rerender)', () => {
    const { rerender } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" searchHighlight="li" />,
    )
    expect(marksIn(cellAt(0, 0)).length).toBe(1)
    rerender(<IrisTable columns={cols} data={rows} rowKey="id" />)
    expect(document.querySelector('mark[data-iris-search-hit]')).toBeNull()
    expect(cellAt(0, 0).textContent).toBe('Charlie')
  })
})
