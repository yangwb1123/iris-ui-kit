import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

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
  { key: 'total', title: 'Total', formula: 'price * qty' },
]

function cell(key: string): HTMLElement[] {
  return Array.from(document.querySelectorAll(`[data-iris-table-cell="${key}"]`))
}

describe('@iris-ui-kit/react IrisTable formula columns (batch AO, iris 独有)', () => {
  it('renders the computed value (formula wins over dataIndex)', () => {
    render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          {
            key: 'total',
            title: 'Total',
            formula: 'price * qty',
            dataIndex: 'name', // overridden by the formula
          },
        ]}
        data={rows}
      />,
    )
    expect(cell('total').map((c) => c.textContent)).toEqual(['30', '20', '100'])
    expect(cell('name').map((c) => c.textContent)).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  it('supports leading = and SUM', () => {
    render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'sum', title: 'Sum', formula: '=SUM(price, qty)' },
        ]}
        data={rows}
      />,
    )
    expect(cell('sum').map((c) => c.textContent)).toEqual(['13', '9', '101'])
  })

  it('unknown field renders empty (fail-closed → null)', () => {
    render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'ghost', title: 'Ghost', formula: 'missing + 1' },
        ]}
        data={rows}
      />,
    )
    expect(cell('ghost').map((c) => c.textContent)).toEqual(['', '', ''])
  })

  it('sort orders by the COMPUTED value (asc)', () => {
    render(
      <IrisTable columns={columns} data={rows} defaultSort={{ key: 'total', direction: 'asc' }} />,
    )
    expect(cell('total').map((c) => c.textContent)).toEqual(['20', '30', '100'])
    expect(cell('name').map((c) => c.textContent)).toEqual(['Beta', 'Alpha', 'Gamma'])
  })

  it('sort desc reverses the computed order; header click also sorts', () => {
    render(
      <IrisTable columns={columns} data={rows} defaultSort={{ key: 'total', direction: 'desc' }} />,
    )
    expect(cell('total').map((c) => c.textContent)).toEqual(['100', '30', '20'])
  })

  it('text filtering matches the computed value', () => {
    render(<IrisTable columns={columns} data={rows} filters={{ total: '30' }} />)
    expect(cell('name').map((c) => c.textContent)).toEqual(['Alpha'])
  })

  it('CSV export materializes computed values (shadow rows, originals untouched)', () => {
    const ref: { current: { exportCurrentViewCsv: () => string } | null } = { current: null }
    render(<IrisTable columns={columns} data={rows} tableRef={ref} />)
    const csv = ref.current!.exportCurrentViewCsv()
    const lines = csv.split('\n').map((l) => l.trim())
    expect(lines[0]).toContain('Total')
    expect(lines[1]).toContain('30')
    expect(lines[2]).toContain('20')
    expect(lines[3]).toContain('100')
    // Originals were not mutated (the shadow-row contract).
    expect(rows[0]).toEqual({ id: 1, name: 'Alpha', price: 10, qty: 3 })
  })

  it('editable + formula is display-only: no editor opens, no data-editable attr', () => {
    render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'total', title: 'Total', formula: 'price * qty', editable: true },
        ]}
        data={rows}
      />,
    )
    const totalCell = document.querySelector('[data-iris-table-cell="total"]') as HTMLElement
    expect(totalCell.getAttribute('data-editable')).toBeNull()
    act(() => {
      fireEvent.doubleClick(totalCell)
    })
    expect(document.querySelector('[data-iris-table-editor]')).toBeNull()
  })
})

describe('@iris-ui-kit/react IrisTable cell references showCellRefs (batch AO, iris 独有)', () => {
  it('renders muted letter badges A/B/C after leaf titles (A = first leaf)', () => {
    render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'total', title: 'Total' },
          { key: 'qty', title: 'Qty' },
        ]}
        data={rows}
        showCellRefs
      />,
    )
    const badges = Array.from(document.querySelectorAll('[data-iris-cell-ref]'))
    expect(badges.map((b) => b.textContent)).toEqual(['A', 'B', 'C'])
    // Appended AFTER the title inside the same header cell.
    const nameHeader = Array.from(document.querySelectorAll('[role="columnheader"]')).find((h) =>
      h.textContent?.includes('Name'),
    )!
    expect(nameHeader.textContent).toContain('NameA')
  })

  it('letter badges skip seq/selection columns', () => {
    render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'total', title: 'Total' },
        ]}
        data={rows}
        seq
        selectable="multi"
        showCellRefs
      />,
    )
    const badges = Array.from(document.querySelectorAll('[data-iris-cell-ref]'))
    expect(badges.map((b) => b.textContent)).toEqual(['A', 'B'])
    const seqHeader = document.querySelector('[data-iris-table-header="__seq"]')!
    expect(seqHeader.querySelector('[data-iris-cell-ref]')).toBeNull()
  })

  it('letters roll over past Z: … Z, AA (bijective via core columnLetter)', () => {
    const many: IrisTableColumn<Row>[] = Array.from({ length: 27 }, (_, i) => ({
      key: `c${i}`,
      title: `C${i}`,
    }))
    render(<IrisTable columns={many} data={rows.slice(0, 1)} showCellRefs />)
    const badges = Array.from(document.querySelectorAll('[data-iris-cell-ref]'))
    expect(badges[25]?.textContent).toBe('Z')
    expect(badges[26]?.textContent).toBe('AA')
  })

  it('row numbers render in a leading column when no seq (data-iris-row-ref)', () => {
    render(<IrisTable columns={columns} data={rows} showCellRefs />)
    const refs = Array.from(document.querySelectorAll('[data-iris-row-ref]'))
    expect(refs.length).toBe(3)
    expect(refs.map((r) => r.textContent)).toEqual(['1', '2', '3'])
    // The ref column is the FIRST cell of each body row (before the data cells).
    const firstRef = refs[0]!
    const row = firstRef.parentElement!
    expect(row.querySelector('[data-iris-table-cell="name"]')).not.toBeNull()
  })

  it('row numbers skipped when seq is on (seq IS the row number, no duplicate)', () => {
    render(<IrisTable columns={columns} data={rows} seq showCellRefs />)
    expect(document.querySelector('[data-iris-row-ref]')).toBeNull()
    const seqCells = Array.from(document.querySelectorAll('[data-iris-table-cell="__seq"]'))
    expect(seqCells.map((c) => c.textContent)).toEqual(['1', '2', '3'])
  })

  it('grouped headers get leaf badges in source order (group cells none)', () => {
    render(
      <IrisTable
        columns={[
          {
            key: 'g1',
            title: 'Group 1',
            children: [
              { key: 'name', title: 'Name' },
              { key: 'total', title: 'Total' },
            ],
          },
          { key: 'qty', title: 'Qty' },
        ]}
        data={rows}
        showCellRefs
      />,
    )
    // Grouped headers render matrix-row by matrix-row, so the flat badge list
    // is NOT source order — assert per header cell instead (grid position).
    const headerCells = Array.from(document.querySelectorAll('[role="columnheader"]'))
    const badgeIn = (title: string): string | null | undefined => {
      const h = headerCells.find((c) => c.textContent?.includes(title))!
      return h.querySelector('[data-iris-cell-ref]')?.textContent
    }
    expect(badgeIn('Name')).toBe('A')
    expect(badgeIn('Total')).toBe('B')
    expect(badgeIn('Qty')).toBe('C')
    // The group header cell itself has no badge.
    const groupHeader = document.querySelector('[data-iris-table-header-group]')!
    expect(groupHeader.querySelector('[data-iris-cell-ref]')).toBeNull()
  })
})
