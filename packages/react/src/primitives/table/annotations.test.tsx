import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => {
  cleanup()
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Alexandra', age: 25 },
  { id: 2, name: 'Bob', age: 32 },
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

function cell(rowId: number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}

function badgeOf(el: HTMLElement): HTMLElement | null {
  return el.querySelector('[data-iris-cell-note-badge]')
}

describe('@iris-ui-kit/react IrisTable cell annotations (batch AZ, iris 独有)', () => {
  it('a static annotations entry renders the badge + note attr + title', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        annotations={{ '1::name': 'VIP customer' }}
      />,
    )
    const c = cell(1, 'name')
    expect(c.getAttribute('data-iris-cell-note')).toBe('true')
    expect(badgeOf(c)).not.toBeNull()
    expect(c.getAttribute('title')).toBe('VIP customer')
  })

  it('keys use the `${rowKey}::${columnKey}` delimiter (same as cellId)', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        annotations={{ '2::age': 'retiring soon' }}
      />,
    )
    expect(cell(2, 'age').getAttribute('data-iris-cell-note')).toBe('true')
    expect(cell(2, 'age').getAttribute('title')).toBe('retiring soon')
    // Other cells stay clean.
    expect(cell(1, 'name').getAttribute('data-iris-cell-note')).toBeNull()
    expect(badgeOf(cell(1, 'name'))).toBeNull()
  })

  it('a dynamic cellNote receives the row + column and renders the note', () => {
    const seen: Array<[Row, IrisTableColumn<Row>]> = []
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellNote={(row, column) => {
          seen.push([row, column])
          return row.age > 30 ? `over 30 (${column.key})` : null
        }}
      />,
    )
    const c = cell(2, 'age')
    expect(c.getAttribute('data-iris-cell-note')).toBe('true')
    expect(c.getAttribute('title')).toBe('over 30 (age)')
    expect(seen.some(([r, col]) => r.id === 2 && col.key === 'age')).toBe(true)
    // Null notes render nothing.
    expect(cell(1, 'name').getAttribute('data-iris-cell-note')).toBeNull()
    expect(badgeOf(cell(1, 'name'))).toBeNull()
  })

  it('cellNote wins over the static annotations map', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        annotations={{ '1::name': 'static note' }}
        cellNote={(row) => (row.id === 1 ? 'dynamic note' : null)}
      />,
    )
    const c = cell(1, 'name')
    expect(c.getAttribute('data-iris-cell-note')).toBe('true')
    expect(c.getAttribute('title')).toBe('dynamic note')
    expect(badgeOf(c)).not.toBeNull()
  })

  it('no annotations/cellNote → no badge, no attr, no note title', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    for (const r of [1, 2]) {
      for (const k of ['name', 'age']) {
        const c = cell(r, k)
        expect(c.getAttribute('data-iris-cell-note')).toBeNull()
        expect(badgeOf(c)).toBeNull()
        expect(c.getAttribute('title')).toBeNull()
      }
    }
  })

  it('the note title beats the tooltipConfig tooltip; un-noted cells keep it', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        annotations={{ '1::name': 'VIP customer' }}
        tooltipConfig={{}}
      />,
    )
    // Note wins over the raw-value tooltip on the noted cell.
    expect(cell(1, 'name').getAttribute('title')).toBe('VIP customer')
    // Un-noted cells still get the tooltipConfig title.
    expect(cell(2, 'name').getAttribute('title')).toBe('Bob')
    expect(cell(1, 'age').getAttribute('title')).toBe('25')
  })

  it('editing cells stay exempt from the note title (badge stays)', () => {
    const editCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age', editable: true },
    ]
    render(
      <IrisTable
        columns={editCols}
        data={rows}
        rowKey="id"
        annotations={{ '1::age': 'audit target' }}
      />,
    )
    const c = cell(1, 'age')
    expect(c.getAttribute('data-iris-cell-note')).toBe('true')
    expect(c.getAttribute('title')).toBe('audit target')
    // While editing, the note title is exempt (same chain as tooltips) but
    // the badge + attr stay.
    act(() => {
      fireEvent.doubleClick(c)
    })
    expect(c.getAttribute('data-iris-cell-note')).toBe('true')
    expect(badgeOf(c)).not.toBeNull()
    expect(c.getAttribute('title')).toBeNull()
  })

  it('the badge uses token-only colors (warning with primary fallback)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" annotations={{ '1::name': 'VIP' }} />)
    const badge = badgeOf(cell(1, 'name'))!
    expect(badge.style.position).toBe('absolute')
    expect(badge.style.background).toBe('var(--iris-warning, var(--iris-primary))')
    expect(badge.style.width).toBe('6px')
    expect(badge.style.height).toBe('6px')
  })
})
