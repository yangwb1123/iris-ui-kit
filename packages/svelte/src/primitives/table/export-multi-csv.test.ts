import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'
import type { IrisTableHandle } from './types'

afterEach(cleanup)

const columns = [{ key: 'name', title: 'Name' }]
const rows = [
  { id: 1, name: 'Alpha' },
  { id: 2, name: 'Beta' },
]

describe('IrisTable tableRef.exportMultiCsv', () => {
  async function renderTable(props: Record<string, unknown> = {}) {
    const tableRef: { current: IrisTableHandle | null } = { current: null }
    render(IrisTable, { props: { columns, data: rows, tableRef, ...props } })
    await waitFor(() => expect(tableRef.current).not.toBeNull())
    return tableRef
  }

  it('falls back byte-for-byte when exportNames is absent or empty', async () => {
    const baseRef = await renderTable()
    const emptyRef = await renderTable({ exportNames: [] })

    expect(baseRef.current!.exportMultiCsv()).toBe('Name\nAlpha\nBeta')
    expect(emptyRef.current!.exportMultiCsv()).toBe(emptyRef.current!.exportCurrentViewCsv())
  })

  it('joins ordered named refs, skips empty names, and keeps bare-row headers', async () => {
    const tableRef = await renderTable({
      exportNames: [
        { key: 'regions', ref: () => [{ code: 'R1', label: 'North' }] },
        { key: '', ref: () => [{ ignored: true }] },
        { key: 'empty', ref: () => [] },
      ],
    })

    expect(tableRef.current!.exportMultiCsv()).toBe(
      '# current\nName\nAlpha\nBeta\n\n# regions\ncode,label\nR1,North\n\n# empty',
    )
  })

  it('reads the latest ref configuration and neutralizes formula-looking ref cells', async () => {
    const tableRef = await renderTable({
      exportNames: [{ key: 'old', ref: () => [{ value: 'old' }] }],
    })
    // Svelte's tableRef facade is stable; changing the prop updates the closure.
    const { rerender } = render(IrisTable, {
      props: {
        columns,
        data: rows,
        tableRef,
        exportNames: [{ key: 'old', ref: () => [{ value: 'old' }] }],
      },
    })
    await rerender({
      columns,
      data: rows,
      tableRef,
      exportNames: [{ key: 'new', ref: () => [{ value: '=HYPERLINK("x")' }] }],
    })

    expect(tableRef.current!.exportMultiCsv()).toBe(
      '# current\nName\nAlpha\nBeta\n\n# new\nvalue\n"\'=HYPERLINK(""x"")"',
    )
  })
})
