import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'
import type { IrisTableHandle } from './types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  price: number
  qty: number
}

const rows: Row[] = [
  { id: 1, name: 'Alpha', price: 10, qty: 2 },
  { id: 2, name: 'Beta', price: 4, qty: 5 },
  { id: 3, name: 'Gamma', price: 100, qty: 1 },
]

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'price', title: 'Price' },
  { key: 'qty', title: 'Qty' },
]

function tableRef(): { current: IrisTableHandle<Row> | null } {
  return { current: null }
}

/** Bare referenced row sets (no column configs — the exportNames contract). */
interface RefRow extends Record<string, unknown> {
  code: string
  label: string
}
const deptRef = (): RefRow[] => [
  { code: 'D1', label: 'Engineering' },
  { code: 'D2', label: 'Design' },
]
const regionRef = (): RefRow[] => [
  { code: 'R1', label: 'North' },
  { code: 'R2', label: 'South' },
]

describe('@iris-ui-kit/react IrisTable exportMultiCsv (batch DI, iris 独有)', () => {
  it('gating: absent exportNames → bare current-table CSV, byte-identical', () => {
    const ref = tableRef()
    render(<IrisTable columns={columns} data={rows} rowKey="id" tableRef={ref} />)
    expect(ref.current!.exportMultiCsv()).toBe(ref.current!.exportCurrentViewCsv())
    // Sanity on the exact bare shape (byte-identical + no trailing newline).
    expect(ref.current!.exportMultiCsv()).toBe('Name,Price,Qty\nAlpha,10,2\nBeta,4,5\nGamma,100,1')
  })

  it('gating: empty exportNames array → byte-identical fallback', () => {
    const ref = tableRef()
    render(<IrisTable columns={columns} data={rows} rowKey="id" tableRef={ref} exportNames={[]} />)
    expect(ref.current!.exportMultiCsv()).toBe(ref.current!.exportCurrentViewCsv())
  })

  it('multi-segment happy path: # current + one ref block, blank-line-joined', () => {
    const ref = tableRef()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        tableRef={ref}
        exportNames={[{ key: 'depts', ref: deptRef }]}
      />,
    )
    expect(ref.current!.exportMultiCsv()).toBe(
      '# current\nName,Price,Qty\nAlpha,10,2\nBeta,4,5\nGamma,100,1\n\n# depts\ncode,label\nD1,Engineering\nD2,Design',
    )
  })

  it('multiple refs preserve exportNames order', () => {
    const ref = tableRef()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        tableRef={ref}
        exportNames={[
          { key: 'regions', ref: regionRef },
          { key: 'depts', ref: deptRef },
        ]}
      />,
    )
    expect(ref.current!.exportMultiCsv()).toBe(
      '# current\nName,Price,Qty\nAlpha,10,2\nBeta,4,5\nGamma,100,1\n\n# regions\ncode,label\nR1,North\nR2,South\n\n# depts\ncode,label\nD1,Engineering\nD2,Design',
    )
  })

  it('current segment inherits the formula-materialization contract', () => {
    const ref = tableRef()
    render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'total', title: 'Total', formula: 'price * qty' },
        ]}
        data={rows}
        rowKey="id"
        tableRef={ref}
        exportNames={[{ key: 'depts', ref: deptRef }]}
      />,
    )
    const out = ref.current!.exportMultiCsv()
    // The # current block materializes the computed formula like exportCurrentViewCsv.
    expect(out).toBe(
      '# current\nName,Total\nAlpha,20\nBeta,20\nGamma,100\n\n# depts\ncode,label\nD1,Engineering\nD2,Design',
    )
  })

  it('current segment inherits the mask contract', () => {
    const ref = tableRef()
    render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'phone', title: 'Phone', mask: 'sensitive' },
        ]}
        data={[
          { name: 'Alex', phone: '13812345678' },
          { name: 'Bob', phone: '13900001111' },
        ]}
        rowKey="name"
        tableRef={ref}
        exportNames={[{ key: 'depts', ref: deptRef }]}
      />,
    )
    expect(ref.current!.exportMultiCsv()).toBe(
      '# current\nName,Phone\nAlex,138****5678\nBob,139****1111\n\n# depts\ncode,label\nD1,Engineering\nD2,Design',
    )
  })

  it('current segment excludes hidden columns (exportCurrentViewCsv parity)', () => {
    const ref = tableRef()
    render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'secret', title: 'Secret' },
          { key: 'qty', title: 'Qty' },
        ]}
        data={rows}
        rowKey="id"
        columnVisibility={{ secret: false }}
        tableRef={ref}
        exportNames={[{ key: 'depts', ref: deptRef }]}
      />,
    )
    const out = ref.current!.exportMultiCsv()
    expect(out).toContain('# current\nName,Qty\nAlpha,2\nBeta,5\nGamma,1')
    expect(out).not.toContain('Secret')
  })

  it('ref block serializes by its OWN keys, not the current table columns', () => {
    const ref = tableRef()
    render(
      <IrisTable
        columns={columns} // name/price/qty — the ref has code/label instead
        data={rows}
        rowKey="id"
        tableRef={ref}
        exportNames={[{ key: 'depts', ref: deptRef }]}
      />,
    )
    const out = ref.current!.exportMultiCsv()
    const deptBlock = out.split('\n\n').pop()!
    expect(deptBlock).toBe('# depts\ncode,label\nD1,Engineering\nD2,Design')
  })

  it('ref block field order = first row key order', () => {
    const ref = tableRef()
    const mixed: RefRow[] = [
      { label: 'X', code: 'C9', extra: 'e' },
      { label: 'Y', code: 'C8' },
    ]
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        tableRef={ref}
        exportNames={[{ key: 'm', ref: () => mixed }]}
      />,
    )
    expect(ref.current!.exportMultiCsv()).toBe(
      '# current\nName,Price,Qty\nAlpha,10,2\nBeta,4,5\nGamma,100,1\n\n# m\nlabel,code,extra\nX,C9,e\nY,C8,',
    )
  })

  it('empty ref rows → only the segment header', () => {
    const ref = tableRef()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        tableRef={ref}
        exportNames={[
          { key: 'empty', ref: () => [] },
          { key: 'depts', ref: deptRef },
        ]}
      />,
    )
    expect(ref.current!.exportMultiCsv()).toBe(
      '# current\nName,Price,Qty\nAlpha,10,2\nBeta,4,5\nGamma,100,1\n\n# empty\n\n# depts\ncode,label\nD1,Engineering\nD2,Design',
    )
  })

  it('a "" segment key is skipped entirely (no header emitted)', () => {
    const ref = tableRef()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        tableRef={ref}
        exportNames={[
          { key: '', ref: deptRef },
          { key: 'depts', ref: deptRef },
        ]}
      />,
    )
    expect(ref.current!.exportMultiCsv()).toBe(
      '# current\nName,Price,Qty\nAlpha,10,2\nBeta,4,5\nGamma,100,1\n\n# depts\ncode,label\nD1,Engineering\nD2,Design',
    )
  })

  it('ref rows get the same OWASP formula neutralization (leading =)', () => {
    const ref = tableRef()
    const evil = [{ code: '=SUM(A1)', label: '+cmd' }]
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        tableRef={ref}
        exportNames={[{ key: 'evil', ref: () => evil }]}
      />,
    )
    expect(ref.current!.exportMultiCsv()).toContain("# evil\ncode,label\n'=SUM(A1),'+cmd")
  })

  it('handle reads the LATEST exportNames after a rerender (stale-closure guard)', () => {
    const ref = tableRef()
    const { rerender } = render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        tableRef={ref}
        exportNames={[{ key: 'depts', ref: deptRef }]}
      />,
    )
    expect(ref.current!.exportMultiCsv()).toContain('# depts')
    rerender(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        tableRef={ref}
        exportNames={[{ key: 'regions', ref: regionRef }]}
      />,
    )
    // Mount-time handle sees the NEW names via the ref mirror.
    expect(ref.current!.exportMultiCsv()).toContain('# regions')
    expect(ref.current!.exportMultiCsv()).not.toContain('# depts')
  })

  it('multisegment CSV can be handed to downloadCsv (download smoke)', async () => {
    const { downloadCsv } = await import('./exportCsv')
    const ref = tableRef()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        tableRef={ref}
        exportNames={[{ key: 'depts', ref: deptRef }]}
      />,
    )
    const csv = ref.current!.exportMultiCsv()
    expect(csv).toContain('# current')
    expect(csv).toContain('# depts')
    // It's a plain RFC-4180 string — downloadCsv just wraps it with a BOM.
    expect(typeof csv).toBe('string')
    await expect(downloadCsv('multi.csv', csv)).resolves.toBeUndefined()
  })
})
