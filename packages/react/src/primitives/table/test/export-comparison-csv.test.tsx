import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisTable } from '../Table'
import { IrisI18nProvider } from '../../../i18n'
import type { IrisTableColumn } from '../types'
import type { IrisTableHandle } from '../types'

afterEach(cleanup)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
  phone?: string
  price?: number
  qty?: number
  city?: string
}

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

const current: Row[] = [
  { id: 1, name: 'Alice', age: 32 },
  { id: 2, name: 'Bob', age: 28 },
]

/** id=1 differs (age 99), id=3 is snapshot-only — the batch AU fixture. */
const snapshot: Row[] = [
  { id: 1, name: 'Alice', age: 99 },
  { id: 3, name: 'Carol', age: 44 },
]

function tableRef(): { current: IrisTableHandle<Row> | null } {
  return { current: null }
}

// ── exportComparisonCsv (iris 独有, batch BV) ────────────────────────────
// Exports the DIFF rows of the compare view: current-view rows marked
// removed/changed in VIEW order (the same filteredData source as
// exportCurrentViewCsv) + compareWith-only added rows at the tail in SNAPSHOT
// order, each prefixed with a marker column (`__iris_diff`, header = i18n
// `table.compare.diff`); changed cells export `maskedOld → maskedNew` (mask
// before composition, exportRaw keeps both sides bare, formula columns do not
// self-composite). No compareWith/rowKey → ''; identical snapshots → header
// only (two states).
describe('IrisTable exportComparisonCsv', () => {
  it('changed row carries the marker + a composite cell (old → new)', () => {
    const r = tableRef()
    render(
      <IrisTable columns={cols} data={current} rowKey="id" compareWith={snapshot} tableRef={r} />,
    )
    // id=1 in both, age 32 → 99: `changed` marker + composite; the age cell is
    // the ONLY changed one — name stays the live value.
    expect(r.current!.exportComparisonCsv()).toBe(
      'Diff,Name,Age\nchanged,Alice,32 → 99\nremoved,Bob,28\nadded,Carol,44',
    )
  })

  it('removed rows export the CURRENT view values (live data, not the snapshot)', () => {
    const r = tableRef()
    render(
      <IrisTable columns={cols} data={current} rowKey="id" compareWith={snapshot} tableRef={r} />,
    )
    // id=2 exists only in the live list — its exported row is the live row.
    const csv = r.current!.exportComparisonCsv()
    const line = csv.split('\n').find((l) => l.startsWith('removed,'))
    expect(line).toBe('removed,Bob,28')
  })

  it('added rows export the SNAPSHOT values (compareWith row, not a live slot)', () => {
    const r = tableRef()
    render(
      <IrisTable columns={cols} data={current} rowKey="id" compareWith={snapshot} tableRef={r} />,
    )
    // id=3 exists only in the snapshot (no render slot, batch AU documented) —
    // its exported row is the snapshot row.
    const csv = r.current!.exportComparisonCsv()
    const line = csv.split('\n').find((l) => l.startsWith('added,'))
    expect(line).toBe('added,Carol,44')
  })

  it('excludes rows identical in both lists (diff rows only)', () => {
    const r = tableRef()
    const withSame: Row[] = [
      { id: 1, name: 'Alice', age: 32 },
      { id: 2, name: 'Bob', age: 28 },
      { id: 4, name: 'Dave', age: 50 },
    ]
    const snapSame: Row[] = [
      { id: 1, name: 'Alice', age: 99 },
      { id: 4, name: 'Dave', age: 50 },
    ]
    render(
      <IrisTable columns={cols} data={withSame} rowKey="id" compareWith={snapSame} tableRef={r} />,
    )
    // id=4 is byte-identical in both lists — no added/removed/changed → absent.
    expect(r.current!.exportComparisonCsv()).toBe(
      'Diff,Name,Age\nchanged,Alice,32 → 99\nremoved,Bob,28',
    )
  })

  it('is inert (empty string) without compareWith', () => {
    const r = tableRef()
    render(<IrisTable columns={cols} data={current} rowKey="id" tableRef={r} />)
    expect(r.current!.exportComparisonCsv()).toBe('')
  })

  it('is inert (empty string) when rowKey is explicitly empty', () => {
    const r = tableRef()
    render(
      <IrisTable columns={cols} data={current} rowKey="" compareWith={snapshot} tableRef={r} />,
    )
    // The render memo gate (`compareWith && rowKey`) is off — same lazy path.
    expect(r.current!.exportComparisonCsv()).toBe('')
  })

  it('identical snapshots → header only (feature on, zero diff)', () => {
    const r = tableRef()
    const same: Row[] = [{ id: 1, name: 'Alice', age: 32 }]
    render(<IrisTable columns={cols} data={same} rowKey="id" compareWith={same} tableRef={r} />)
    // Distinguishable from the lazy '' — the caller sees a non-empty header.
    expect(r.current!.exportComparisonCsv()).toBe('Diff,Name,Age')
  })

  it('prepends the marker column and localizes its header via i18n', () => {
    const r = tableRef()
    render(
      <IrisI18nProvider messages={{ 'table.compare.diff': '差异' }}>
        <IrisTable columns={cols} data={current} rowKey="id" compareWith={snapshot} tableRef={r} />
      </IrisI18nProvider>,
    )
    // Header = 差异 + the view columns; the marker VALUES stay English literals.
    const lines = r.current!.exportComparisonCsv().split('\n')
    expect(lines[0]).toBe('差异,Name,Age')
    expect(lines[1]).toBe('changed,Alice,32 → 99')
  })

  it('excludes hidden changed columns (columnVisibility)', () => {
    const r = tableRef()
    const onlyAge: Row[] = [{ id: 1, name: 'Alice', age: 32 }]
    const onlyAgeSnap: Row[] = [{ id: 1, name: 'Alice', age: 99 }]
    render(
      <IrisTable
        columns={cols}
        data={onlyAge}
        rowKey="id"
        compareWith={onlyAgeSnap}
        columnVisibility={{ age: false }}
        tableRef={r}
      />,
    )
    // The age diff is the ONLY diff — with the column hidden there are no
    // changed cells left, but the row is still `changed` (the marker stands).
    expect(r.current!.exportComparisonCsv()).toBe('Diff,Name\nchanged,Alice')
  })

  it('masks BOTH composite sides (mask before composition) and keeps exportRaw bare', () => {
    const maskCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'phone', title: 'Phone', mask: 'sensitive' },
    ]
    const maskCurrent: Row[] = [
      { id: 1, name: 'Alice', age: 32, phone: '13812345678' },
      { id: 2, name: 'Bob', age: 28, phone: '13900001111' },
    ]
    const maskSnap: Row[] = [{ id: 1, name: 'Alice', age: 32, phone: '13900001111' }]
    const r = tableRef()
    render(
      <IrisTable
        columns={maskCols}
        data={maskCurrent}
        rowKey="id"
        compareWith={maskSnap}
        tableRef={r}
      />,
    )
    // id=1 phone 13812345678 → 13900001111: BOTH sides masked (the default mask
    // must not leak a bare value through the composite); id=2 removed keeps the
    // batch AY default mask on its unchanged cell.
    expect(r.current!.exportComparisonCsv()).toBe(
      'Diff,Name,Phone\nchanged,Alice,138****5678 → 139****1111\nremoved,Bob,139****1111',
    )
    // exportRaw opts the column out of masking on BOTH the composite and the
    // plain cells.
    const rawCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'phone', title: 'Phone', mask: 'sensitive', exportRaw: true },
    ]
    const r2 = tableRef()
    render(
      <IrisTable
        columns={rawCols}
        data={maskCurrent}
        rowKey="id"
        compareWith={maskSnap}
        tableRef={r2}
      />,
    )
    expect(r2.current!.exportComparisonCsv()).toBe(
      'Diff,Name,Phone\nchanged,Alice,13812345678 → 13900001111\nremoved,Bob,13900001111',
    )
  })

  it('materializes formula columns from PRISTINE data (composite never leaks in)', () => {
    const formulaCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'price', title: 'Price' },
      { key: 'total', title: 'Total', formula: 'price * qty' },
      { key: 'qty', title: 'Qty' },
    ]
    const formulaCurrent: Row[] = [{ id: 1, name: 'Alpha', age: 25, price: 10, qty: 3 }]
    const formulaSnap: Row[] = [{ id: 1, name: 'Alpha', age: 25, price: 20, qty: 3 }]
    const r = tableRef()
    render(
      <IrisTable
        columns={formulaCols}
        data={formulaCurrent}
        rowKey="id"
        compareWith={formulaSnap}
        tableRef={r}
      />,
    )
    // price composites (10 → 20); the total formula column does NOT
    // self-composite and computes from the pristine live price (10 × 3 = 30),
    // not from the composite string.
    expect(r.current!.exportComparisonCsv()).toBe(
      'Diff,Name,Price,Total,Qty\nchanged,Alpha,10 → 20,30,3',
    )
  })

  it('orders rows: removed/changed in VIEW order, added at the tail in SNAPSHOT order', () => {
    const orderCurrent: Row[] = [
      { id: 1, name: 'Alice', age: 32 },
      { id: 2, name: 'Bob', age: 28 },
      { id: 5, name: 'Eve', age: 20 },
    ]
    const orderSnap: Row[] = [
      { id: 1, name: 'Alice', age: 99 },
      { id: 3, name: 'Carol', age: 44 },
      { id: 4, name: 'Dan', age: 55 },
    ]
    const r = tableRef()
    render(
      <IrisTable
        columns={cols}
        data={orderCurrent}
        rowKey="id"
        compareWith={orderSnap}
        tableRef={r}
      />,
    )
    // View order 1/2/5 (changed then removed), then snapshot order 3/4.
    expect(r.current!.exportComparisonCsv()).toBe(
      'Diff,Name,Age\nchanged,Alice,32 → 99\nremoved,Bob,28\nremoved,Eve,20\nadded,Carol,44\nadded,Dan,55',
    )
  })

  it('composites every changed column; a null side renders as an empty string', () => {
    const cityCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age' },
      { key: 'city', title: 'City' },
    ]
    const multiCurrent: Row[] = [{ id: 1, name: 'Alice', age: 32, city: 'NYC' }]
    const multiSnap: Row[] = [{ id: 1, name: 'Alice', age: null, city: 'LA' }]
    const r = tableRef()
    render(
      <IrisTable
        columns={cityCols}
        data={multiCurrent}
        rowKey="id"
        compareWith={multiSnap}
        tableRef={r}
      />,
    )
    // age 32 → null: "32 → " (empty new side, same String(null ?? '') as the
    // batch AU tooltip); city NYC → LA composites too.
    expect(r.current!.exportComparisonCsv()).toBe(
      'Diff,Name,Age,City\nchanged,Alice,32 → ,NYC → LA',
    )
  })

  it('follows the CURRENT filtered view (a removed row filtered out is excluded)', () => {
    const r = tableRef()
    render(
      <IrisTable
        columns={cols}
        data={current}
        rowKey="id"
        compareWith={snapshot}
        filters={{ name: 'ali' }}
        tableRef={r}
      />,
    )
    // The view filter keeps only Alice — Bob (removed) is filtered out of the
    // current view, so his diff row is NOT exported (same source as
    // exportCurrentViewCsv); the added row still comes from the UNFILTERED
    // compareWith snapshot (spec: added = snapshot-only, no view slot).
    expect(r.current!.exportComparisonCsv()).toBe(
      'Diff,Name,Age\nchanged,Alice,32 → 99\nadded,Carol,44',
    )
  })
})
