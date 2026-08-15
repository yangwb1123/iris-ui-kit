import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => {
  cleanup()
  clipboardWrite.mockReset()
  clipboardRead.mockReset()
  // Restore the pristine jsdom navigator (no Clipboard API) between tests.
  Reflect.deleteProperty(navigator, 'clipboard')
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
  { id: 3, name: 'Bob', age: 28 },
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

const clipboardWrite = vi.fn<(text: string) => Promise<void>>()
const clipboardRead = vi.fn<() => Promise<string>>()

function stubClipboard(): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: clipboardWrite, readText: clipboardRead },
  })
  clipboardWrite.mockResolvedValue(undefined)
  clipboardRead.mockResolvedValue('')
}

function root(): HTMLElement {
  return document.querySelector('[data-iris-table]') as HTMLElement
}

function cell(row: number, col: number): HTMLElement {
  return document.querySelector(
    `[data-iris-cell-row="${row}"][data-iris-cell-col="${col}"]`,
  ) as HTMLElement
}

function selectRange(r0: number, c0: number, r1: number, c1: number): void {
  fireEvent.click(cell(r0, c0))
  if (r1 !== r0 || c1 !== c0) fireEvent.click(cell(r1, c1), { shiftKey: true })
}

function copyViaKey(): void {
  fireEvent.keyDown(root(), { key: 'c', ctrlKey: true })
}

/** The three-format spec (batch BP): `copyFormat` selects the copy OUTPUT
 *  format on `clipConfig`. Default (unset) = batch-O TSV byte-identical. */
describe('IrisTable clipConfig.copyFormat (batch BP, iris 独有)', () => {
  it('unset copyFormat copies the range as TSV — byte-identical to batch O', async () => {
    stubClipboard()
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange clipConfig={{}} />)
    selectRange(0, 0, 1, 1)
    copyViaKey()
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('Charlie\t25\nAlice\t32'))
  })

  it("explicit copyFormat: 'tsv' produces the same byte pin", async () => {
    stubClipboard()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{ copyFormat: 'tsv' }}
      />,
    )
    selectRange(0, 0, 1, 1)
    copyViaKey()
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('Charlie\t25\nAlice\t32'))
  })

  it("copyFormat: 'csv' copies the range headerless per RFC-4180", async () => {
    stubClipboard()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{ copyFormat: 'csv' }}
      />,
    )
    selectRange(0, 0, 1, 1)
    copyViaKey()
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('Charlie,25\nAlice,32'))
  })

  it("copyFormat: 'csv' RFC-4180-quotes cells with comma/quote and neutralizes formulas", async () => {
    stubClipboard()
    const tricky: Row[] = [
      { id: 1, name: 'He said "hi", ok', age: 25 },
      { id: 2, name: '=SUM(A1)', age: 32 },
    ]
    render(
      <IrisTable
        columns={cols}
        data={tricky}
        rowKey="id"
        cellRange
        clipConfig={{ copyFormat: 'csv' }}
      />,
    )
    selectRange(0, 0, 1, 1)
    copyViaKey()
    await waitFor(() =>
      expect(clipboardWrite).toHaveBeenCalledWith('"He said ""hi"", ok",25\n\'=SUM(A1),32'),
    )
  })

  it("copyFormat: 'html' copies a <table> fragment with a header row (toHtml contract)", async () => {
    stubClipboard()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{ copyFormat: 'html' }}
      />,
    )
    selectRange(0, 0, 1, 1)
    copyViaKey()
    await waitFor(() =>
      expect(clipboardWrite).toHaveBeenCalledWith(
        '<table><thead><tr><th>Name</th><th>Age</th></tr></thead><tbody>' +
          '<tr><td>Charlie</td><td style="text-align:right">25</td></tr>' +
          '<tr><td>Alice</td><td style="text-align:right">32</td></tr>' +
          '</tbody></table>',
      ),
    )
  })

  it("copyFormat: 'html' restricts the fragment to the RANGE's column subset", async () => {
    stubClipboard()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{ copyFormat: 'html' }}
      />,
    )
    // Only the Age column (col 1) across two rows.
    selectRange(0, 1, 1, 1)
    copyViaKey()
    await waitFor(() =>
      expect(clipboardWrite).toHaveBeenCalledWith(
        '<table><thead><tr><th>Age</th></tr></thead><tbody>' +
          '<tr><td style="text-align:right">25</td></tr>' +
          '<tr><td style="text-align:right">32</td></tr>' +
          '</tbody></table>',
      ),
    )
  })

  it("copyFormat: 'html' XML-escapes cell content", async () => {
    stubClipboard()
    const markup: Row[] = [{ id: 1, name: '<b>hi</b> & "bye"', age: 25 }]
    render(
      <IrisTable
        columns={cols}
        data={markup}
        rowKey="id"
        cellRange
        clipConfig={{ copyFormat: 'html' }}
      />,
    )
    selectRange(0, 0, 0, 1)
    copyViaKey()
    await waitFor(() =>
      expect(clipboardWrite).toHaveBeenCalledWith(
        '<table><thead><tr><th>Name</th><th>Age</th></tr></thead><tbody>' +
          '<tr><td>&lt;b&gt;hi&lt;/b&gt; &amp; &quot;bye&quot;</td>' +
          '<td style="text-align:right">25</td></tr>' +
          '</tbody></table>',
      ),
    )
  })

  it('the column mask applies identically across tsv / csv / html (batch AY invariant)', async () => {
    stubClipboard()
    interface MaskedRow extends Record<string, unknown> {
      id: number
      name: string
      phone: string
    }
    const maskedCols: IrisTableColumn<MaskedRow>[] = [
      { key: 'name', title: 'Name' },
      { key: 'phone', title: 'Phone', mask: 'sensitive' },
    ]
    const maskedRows: MaskedRow[] = [
      { id: 1, name: 'Charlie', phone: '13800138000' },
      { id: 2, name: 'Alice', phone: '13900139000' },
    ]
    for (const format of ['tsv', 'csv', 'html'] as const) {
      render(
        <IrisTable
          columns={maskedCols}
          data={maskedRows}
          rowKey="id"
          cellRange
          clipConfig={{ copyFormat: format }}
        />,
      )
      selectRange(0, 0, 1, 1)
      copyViaKey()
      if (format === 'tsv') {
        await waitFor(() =>
          expect(clipboardWrite).toHaveBeenCalledWith('Charlie\t138****8000\nAlice\t139****9000'),
        )
      } else if (format === 'csv') {
        await waitFor(() =>
          expect(clipboardWrite).toHaveBeenCalledWith('Charlie,138****8000\nAlice,139****9000'),
        )
      } else {
        await waitFor(() =>
          expect(clipboardWrite).toHaveBeenCalledWith(
            '<table><thead><tr><th>Name</th><th>Phone</th></tr></thead><tbody>' +
              '<tr><td>Charlie</td><td>138****8000</td></tr>' +
              '<tr><td>Alice</td><td>139****9000</td></tr>' +
              '</tbody></table>',
          ),
        )
      }
      cleanup()
    }
  })

  it('a number masked into a string loses the html numeric right-alignment (fiat)', async () => {
    stubClipboard()
    const mask = vi.fn((value: unknown) => `M:${String(value)}`)
    const maskedCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age', mask },
    ]
    render(
      <IrisTable
        columns={maskedCols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{ copyFormat: 'html' }}
      />,
    )
    selectRange(0, 0, 0, 1)
    copyViaKey()
    await waitFor(() =>
      expect(clipboardWrite).toHaveBeenCalledWith(
        '<table><thead><tr><th>Name</th><th>Age</th></tr></thead><tbody>' +
          '<tr><td>Charlie</td><td>M:25</td></tr>' +
          '</tbody></table>',
      ),
    )
  })

  it('the range toolbar 复制 button writes the SAME format-aware dispatcher output', async () => {
    stubClipboard()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{ copyFormat: 'html' }}
      />,
    )
    selectRange(0, 0, 1, 1)
    fireEvent.click(document.querySelector('[data-iris-table-range-copy]')!)
    await waitFor(() =>
      expect(clipboardWrite).toHaveBeenCalledWith(
        '<table><thead><tr><th>Name</th><th>Age</th></tr></thead><tbody>' +
          '<tr><td>Charlie</td><td style="text-align:right">25</td></tr>' +
          '<tr><td>Alice</td><td style="text-align:right">32</td></tr>' +
          '</tbody></table>',
      ),
    )
  })

  it('an invalid runtime copyFormat value fails closed to TSV', async () => {
    stubClipboard()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{ copyFormat: 'xlsx' as never }}
      />,
    )
    selectRange(0, 0, 1, 1)
    copyViaKey()
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('Charlie\t25\nAlice\t32'))
  })

  it('paste stays tab-delimited regardless of copyFormat (asymmetry fiat)', async () => {
    stubClipboard()
    clipboardRead.mockResolvedValue('X\tY\nZ\tW')
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{ copyFormat: 'csv' }}
        onDataChange={onDataChange}
      />,
    )
    fireEvent.click(cell(0, 0))
    fireEvent.keyDown(root(), { key: 'v', ctrlKey: true })
    await waitFor(() => expect(onDataChange).toHaveBeenCalledTimes(1))
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toMatchObject({ id: 1, name: 'X', age: 'Y' })
    expect(next[1]).toMatchObject({ id: 2, name: 'Z', age: 'W' })
  })

  it('no live range → no-op even with a copyFormat set', async () => {
    stubClipboard()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{ copyFormat: 'html' }}
      />,
    )
    copyViaKey()
    // Give the async write a chance to run — it must never fire.
    await new Promise((r) => setTimeout(r, 20))
    expect(clipboardWrite).not.toHaveBeenCalled()
  })
})
