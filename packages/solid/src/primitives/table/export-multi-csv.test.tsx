import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn, IrisTableHandle } from './types'

afterEach(cleanup)

type Row = Record<string, unknown>
const columns: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]
const rows: Row[] = [
  { id: 1, name: 'Alpha' },
  { id: 2, name: 'Beta' },
]

describe('IrisTable handle.exportMultiCsv', () => {
  it('falls back byte-for-byte when exportNames is absent or empty', () => {
    const baseRef: { current: IrisTableHandle<Row> | null } = { current: null }
    const emptyRef: { current: IrisTableHandle<Row> | null } = { current: null }
    render(() => <IrisTable columns={columns} data={rows} tableRef={baseRef} />)
    render(() => <IrisTable columns={columns} data={rows} exportNames={[]} tableRef={emptyRef} />)

    expect(baseRef.current!.exportMultiCsv()).toBe('Name\nAlpha\nBeta')
    expect(emptyRef.current!.exportMultiCsv()).toBe(emptyRef.current!.exportCurrentViewCsv())
  })

  it('joins ordered named refs, skips empty names, and keeps bare-row headers', () => {
    const tableRef: { current: IrisTableHandle<Row> | null } = { current: null }
    render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        tableRef={tableRef}
        exportNames={[
          { key: 'regions', ref: () => [{ code: 'R1', label: 'North' }] },
          { key: '', ref: () => [{ ignored: true }] },
          { key: 'empty', ref: () => [] },
        ]}
      />
    ))

    expect(tableRef.current!.exportMultiCsv()).toBe(
      '# current\nName\nAlpha\nBeta\n\n# regions\ncode,label\nR1,North\n\n# empty',
    )
  })

  it('reads the latest ref configuration and neutralizes formula-looking ref cells', () => {
    const tableRef: { current: IrisTableHandle<Row> | null } = { current: null }
    const [names, setNames] = createSignal<Array<{ key: string; ref: () => Row[] }>>([
      { key: 'old', ref: () => [{ id: 9, name: 'old' }] },
    ])
    render(() => (
      <IrisTable columns={columns} data={rows} tableRef={tableRef} exportNames={names()} />
    ))

    setNames([{ key: 'new', ref: () => [{ id: 9, name: '=HYPERLINK("x")' }] }])

    expect(tableRef.current!.exportMultiCsv()).toBe(
      '# current\nName\nAlpha\nBeta\n\n# new\nid,name\n9,"\'=HYPERLINK(""x"")"',
    )
  })
})
