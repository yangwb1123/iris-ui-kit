import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
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
  { key: 'age', title: 'Age', sparkline: true },
]

const rows: Row[] = [
  { id: 1, name: 'Alice', age: 10 },
  { id: 2, name: 'Bob', age: 4 },
  { id: 3, name: 'Carol', age: 8 },
]

function cell(rowId: string | number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}

function sparkSvg(rowId: string | number, key = 'age'): SVGSVGElement | null {
  return document.querySelector(`[data-iris-table-row="${rowId}"] [data-iris-sparkline="${key}"]`)
}

// ── Column sparkline (iris 独有, batch BI — vxe has no equivalent) ───────
describe('IrisTable column sparkline', () => {
  it('renders a polyline per numeric cell (inclusive prefix series)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    // All three rows are numeric → three SVGs, one per row.
    expect(document.querySelectorAll('[data-iris-sparkline="age"]')).toHaveLength(3)
    // Row 3 charts the full prefix [10, 4, 8] → a 3-point polyline.
    const last = sparkSvg(3)!
    expect(last.querySelectorAll('polyline')).toHaveLength(1)
    const points = last.querySelector('polyline')!.getAttribute('points')!.trim()
    expect(points.split(/\s+/)).toHaveLength(3)
    expect(last.getAttribute('viewBox')).toBe('0 0 20 8')
  })

  it('renders nothing for a non-numeric column (per-cell numeric gate)', () => {
    const c: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', sparkline: true },
      { key: 'age', title: 'Age', sparkline: true },
    ]
    render(<IrisTable columns={c} data={rows} rowKey="id" />)
    expect(document.querySelectorAll('[data-iris-sparkline="name"]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-iris-sparkline="age"]')).toHaveLength(3)
  })

  it('numeric STRING cells fail the gate too (typeof number)', () => {
    type Loose = { id: number; v: string | number }
    const c: IrisTableColumn<Loose>[] = [{ key: 'v', title: 'V', sparkline: true }]
    const d: Loose[] = [
      { id: 1, v: '10' },
      { id: 2, v: '20' },
    ]
    render(<IrisTable columns={c} data={d} rowKey="id" />)
    expect(document.querySelectorAll('[data-iris-sparkline="v"]')).toHaveLength(0)
  })

  it('a null cell renders no SVG while numeric siblings still chart', () => {
    type Loose = { id: number; v: number | null }
    const c: IrisTableColumn<Loose>[] = [{ key: 'v', title: 'V', sparkline: true }]
    const d: Loose[] = [
      { id: 1, v: 5 },
      { id: 2, v: null },
      { id: 3, v: 7 },
    ]
    render(<IrisTable columns={c} data={d} rowKey="id" />)
    expect(sparkSvg(2, 'v')).toBeNull()
    // Row 1's single-point prefix → circle dot only.
    expect(sparkSvg(1, 'v')!.querySelectorAll('circle')).toHaveLength(1)
    expect(sparkSvg(3, 'v')).not.toBeNull()
  })

  it('cell title and aria-label show the inclusive series', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    expect(cell(1, 'age').getAttribute('title')).toBe('10')
    expect(cell(2, 'age').getAttribute('title')).toBe('10, 4')
    expect(cell(3, 'age').getAttribute('title')).toBe('10, 4, 8')
    expect(sparkSvg(3)!.getAttribute('aria-label')).toBe('10, 4, 8')
  })

  it('a gap breaks the polyline into separate segments', () => {
    type Loose = { id: number; v: number | null }
    const c: IrisTableColumn<Loose>[] = [{ key: 'v', title: 'V', sparkline: true }]
    const d: Loose[] = [
      { id: 1, v: 5 },
      { id: 2, v: 3 },
      { id: 3, v: null },
      { id: 4, v: 7 },
    ]
    render(<IrisTable columns={c} data={d} rowKey="id" />)
    const last = sparkSvg(4, 'v')!
    // Prefix [5, 3, null, 7] → run [5,3] and run [7].
    const polys = last.querySelectorAll('polyline')
    expect(polys).toHaveLength(2)
    expect(polys[0]!.getAttribute('points')!.trim().split(/\s+/)).toHaveLength(2)
    expect(polys[1]!.getAttribute('points')!.trim().split(/\s+/)).toHaveLength(1)
    expect(last.getAttribute('aria-label')).toBe('5, 3, , 7')
  })

  it('a single-point prefix renders a circle dot (polyline run is inert)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    const first = sparkSvg(1)!
    // The prefix [10] is one finite point → the circle dot carries it (the
    // single-point polyline run draws nothing, ChartPanel parity).
    expect(first.querySelectorAll('circle')).toHaveLength(1)
    expect(first.querySelectorAll('polyline')).toHaveLength(1)
    expect(
      first.querySelector('polyline')!.getAttribute('points')!.trim().split(/\s+/),
    ).toHaveLength(1)
    // Later rows chart polylines without the dot.
    expect(sparkSvg(3)!.querySelectorAll('circle')).toHaveLength(0)
  })

  it('reads through the dataIndex indirection (getCellValue parity)', () => {
    const c: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'ageDisplay', title: 'Age', dataIndex: 'age', sparkline: true },
    ]
    render(<IrisTable columns={c} data={rows} rowKey="id" />)
    expect(sparkSvg(3, 'ageDisplay')!.getAttribute('aria-label')).toBe('10, 4, 8')
  })

  it('formula columns chart their computed values (getCellValue choke point)', () => {
    const c: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'double', title: 'Double', formula: '=age * 2', sparkline: true },
    ]
    render(<IrisTable columns={c} data={rows} rowKey="id" />)
    expect(sparkSvg(3, 'double')!.getAttribute('aria-label')).toBe('20, 8, 16')
  })

  it('sort reorders the series (follows filteredData)', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        defaultSort={{ key: 'age', direction: 'asc' }}
      />,
    )
    // Sorted ages [4, 8, 10]: Bob(4) → Carol(8) → Alice(10).
    expect(sparkSvg(2)!.getAttribute('aria-label')).toBe('4')
    expect(sparkSvg(3)!.getAttribute('aria-label')).toBe('4, 8')
    expect(sparkSvg(1)!.getAttribute('aria-label')).toBe('4, 8, 10')
  })

  it('filters trim the series (follows filteredData)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" filterValues={{ age: ['10'] }} />)
    // Only Alice (10) survives → one row, one single-point dot.
    expect(document.querySelectorAll('[data-iris-sparkline="age"]')).toHaveLength(1)
    expect(sparkSvg(1)!.getAttribute('aria-label')).toBe('10')
  })

  it('inline editing takes over the cell — the SVG returns after commit', () => {
    const c: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age', sparkline: true, editable: true, editor: 'number' },
    ]
    render(<IrisTable columns={c} data={rows} rowKey="id" />)
    fireEvent.doubleClick(cell(1, 'age'))
    const input = cell(1, 'age').querySelector('input') as HTMLInputElement
    expect(input).toBeTruthy()
    // The editor replaces the sparkline while the session is open.
    expect(sparkSvg(1)).toBeNull()
    fireEvent.change(input, { target: { value: '12' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(sparkSvg(1)).not.toBeNull()
  })

  it('stroke uses the primary token; mask is inert (raw series shows)', () => {
    const c: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      {
        key: 'age',
        title: 'Age',
        sparkline: true,
        mask: () => 'MASKED',
        exportRaw: false,
      },
    ]
    render(<IrisTable columns={c} data={rows} rowKey="id" />)
    const last = sparkSvg(3)!
    expect(last.querySelector('polyline')!.getAttribute('stroke')).toBe('var(--iris-primary)')
    expect(last.querySelector('polyline')!.getAttribute('stroke-width')).toBe('1.5')
    // Display (SVG + title) reads the RAW series — the mask never touches it.
    expect(last.getAttribute('aria-label')).toBe('10, 4, 8')
    expect(cell(3, 'age').getAttribute('title')).toBe('10, 4, 8')
    // pointerEvents off so the SVG never intercepts cell interactions.
    expect(last.style.pointerEvents).toBe('none')
  })
})
