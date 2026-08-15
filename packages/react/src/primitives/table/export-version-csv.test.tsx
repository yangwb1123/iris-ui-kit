import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'
import type { IrisTableHandle } from './types'

afterEach(cleanup)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
  phone?: string
  price?: number
  qty?: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
  { id: 3, name: 'Bob', age: 28 },
]

const baseCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

function tableRef(): { current: IrisTableHandle<Row> | null } {
  return { current: null }
}

/** A row-list commit (the commitRowList funnel) — pushes a version. */
function commit(
  ref: { current: IrisTableHandle<Row> | null },
  id: number,
  patch: Partial<Row>,
): void {
  act(() => {
    ref.current?.updateRow(id, patch)
  })
}

// ── exportVersionCsv (iris 独有, batch BF) ───────────────────────────────
// Exports the PRE-change snapshot of commit `index` through the exact same
// exportCsv pipeline as exportCurrentViewCsv (formula columns materialized
// on shadow rows, masks applied, hidden columns excluded). Unknown index
// (trimmed/cleared) or no versionHistory → ''. The spec's 对比 with
// exportCurrentViewCsv: same serializer/column set; different row source
// (ring PRE-change snapshot vs filtered live view) and empty semantics.
describe('IrisTable exportVersionCsv', () => {
  it('exports the pre-change rows of the first commit (version 0 = initial data)', () => {
    const r = tableRef()
    render(<IrisTable columns={baseCols} data={rows} rowKey="id" versionHistory tableRef={r} />)
    commit(r, 1, { name: 'Renamed' })
    expect(r.current!.exportVersionCsv(0)).toBe('Name,Age\nCharlie,25\nAlice,32\nBob,28')
  })

  it('each version holds the state BEFORE its commit (per-commit pre-change semantics)', () => {
    const r = tableRef()
    render(<IrisTable columns={baseCols} data={rows} rowKey="id" versionHistory tableRef={r} />)
    commit(r, 1, { name: 'Renamed' }) // version 0 = initial rows
    commit(r, 2, { age: 33 }) // version 1 = rows after the first commit
    expect(r.current!.exportVersionCsv(1)).toBe('Name,Age\nRenamed,25\nAlice,32\nBob,28')
    expect(r.current!.exportVersionCsv(0)).toBe('Name,Age\nCharlie,25\nAlice,32\nBob,28')
    // The live view is the NEWEST state — the historical exports differ from it.
    expect(r.current!.exportVersionCsv(1)).not.toBe(r.current!.exportCurrentViewCsv())
  })

  it('an out-of-range index returns an empty string (never throws)', () => {
    const r = tableRef()
    render(<IrisTable columns={baseCols} data={rows} rowKey="id" versionHistory tableRef={r} />)
    commit(r, 1, { name: 'Renamed' })
    expect(r.current!.exportVersionCsv(99)).toBe('')
    expect(r.current!.exportVersionCsv(-1)).toBe('')
  })

  it('an index trimmed off the bounded ring returns an empty string (max: 1)', () => {
    const r = tableRef()
    render(
      <IrisTable
        columns={baseCols}
        data={rows}
        rowKey="id"
        versionHistory={{ max: 1 }}
        tableRef={r}
      />,
    )
    commit(r, 1, { name: 'Renamed' })
    commit(r, 2, { age: 33 })
    // Only version 1 survives the trim — version 0 was popped off the ring.
    expect(r.current!.getVersions()).toHaveLength(1)
    expect(r.current!.exportVersionCsv(0)).toBe('')
    expect(r.current!.exportVersionCsv(1)).toBe('Name,Age\nRenamed,25\nAlice,32\nBob,28')
  })

  it('is inert without the versionHistory prop (empty string)', () => {
    const r = tableRef()
    render(<IrisTable columns={baseCols} data={rows} rowKey="id" tableRef={r} />)
    commit(r, 1, { name: 'Renamed' })
    expect(r.current!.getVersions()).toHaveLength(0)
    expect(r.current!.exportVersionCsv(0)).toBe('')
  })

  it('对比 exportCurrentViewCsv: after restoreVersion(i), both are byte-identical', () => {
    const r = tableRef()
    render(<IrisTable columns={baseCols} data={rows} rowKey="id" versionHistory tableRef={r} />)
    commit(r, 1, { name: 'Renamed' })
    commit(r, 2, { age: 33 })
    act(() => {
      r.current!.restoreVersion(0)
    })
    // restoreVersion replays the version-0 rows into the live view (type
    // 'undo', no new version) — the export of the historical snapshot and the
    // current view must then serialize to the identical string.
    expect(r.current!.exportVersionCsv(0)).toBe(r.current!.exportCurrentViewCsv())
    // Same serializer/column set: exact byte equality, not a loose match.
    expect(r.current!.exportVersionCsv(0)).toBe('Name,Age\nCharlie,25\nAlice,32\nBob,28')
  })

  it('applies column masks (batch AY parity) on the historical snapshot', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'phone', title: 'Phone', mask: 'sensitive' },
    ]
    const data: Row[] = [
      { id: 1, name: 'Alexandra', age: 25, phone: '13812345678' },
      { id: 2, name: 'Bob', age: 32, phone: '13900001111' },
    ]
    const r = tableRef()
    render(<IrisTable columns={cols} data={data} rowKey="id" versionHistory tableRef={r} />)
    commit(r, 1, { name: 'Renamed' })
    expect(r.current!.exportVersionCsv(0)).toBe(
      'Name,Phone\nAlexandra,138****5678\nBob,139****1111',
    )
  })

  it('materializes formula columns on shadow rows and excludes hidden columns', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'total', title: 'Total', formula: 'price * qty' },
      { key: 'qty', title: 'Qty' },
    ]
    const data: Row[] = [
      { id: 1, name: 'Alpha', age: 25, price: 10, qty: 3 },
      { id: 2, name: 'Beta', age: 32, price: 20, qty: 2 },
    ]
    const r = tableRef()
    render(
      <IrisTable
        columns={cols}
        data={data}
        rowKey="id"
        versionHistory
        columnVisibility={{ qty: false }}
        tableRef={r}
      />,
    )
    commit(r, 1, { name: 'Renamed' })
    // Formula materialized (30 / 40), hidden Qty column absent from the header.
    expect(r.current!.exportVersionCsv(0)).toBe('Name,Total\nAlpha,30\nBeta,40')
  })
})
