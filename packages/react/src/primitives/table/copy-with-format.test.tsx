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
  amount: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', amount: 25 },
  { id: 2, name: 'Alice', amount: 32 },
  { id: 3, name: 'Bob', amount: 28 },
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'amount', title: 'Amount' },
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

/**
 * Batch CU (iris 独有 — vxe clipboard-config always copies raw values, no
 * format-preserving copy): `clipConfig.copyWithFormat` copies the FORMATTED
 * text of formatter columns (the `contextCellText` display chain — mask →
 * formatter → String, the same chain as the context-menu 复制值) instead of the
 * raw/masked value, across all three `copyFormat` serializers. Only
 * `col.formatter` columns switch chains — non-formatter columns stay
 * byte-identical — and the formatted string still flows through the same
 * tsv/csv/html serializers (RFC-4180 quoting + OWASP neutralization apply to
 * formatted text too). `exportRaw`'s copy-path skip is superseded on formatter
 * columns; exports are untouched. Paste is unaffected (asymmetry fiat).
 */
describe('IrisTable clipConfig.copyWithFormat (batch CU, iris 独有)', () => {
  const fmtCols: IrisTableColumn<Row>[] = [
    { key: 'name', title: 'Name' },
    { key: 'amount', title: 'Amount', formatter: (v) => `${String(v)}.00` },
  ]

  it('① copies the FORMATTED text in TSV — `25.00` not the raw `25` (spec)', async () => {
    stubClipboard()
    render(
      <IrisTable
        columns={fmtCols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{ copyWithFormat: true }}
      />,
    )
    selectRange(0, 0, 1, 1)
    copyViaKey()
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('Charlie\t25.00\nAlice\t32.00'))
  })

  it('② copies the formatter result, not the raw value — `$25` (spec)', async () => {
    stubClipboard()
    const moneyCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'amount', title: 'Amount', formatter: (v) => `$${String(v)}` },
    ]
    render(
      <IrisTable
        columns={moneyCols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{ copyWithFormat: true }}
      />,
    )
    selectRange(0, 0, 1, 1)
    copyViaKey()
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('Charlie\t$25\nAlice\t$32'))
  })

  it('the range toolbar 复制 button is the same throat — formatted output', async () => {
    stubClipboard()
    render(
      <IrisTable
        columns={fmtCols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{ copyWithFormat: true }}
      />,
    )
    selectRange(0, 0, 1, 1)
    fireEvent.click(document.querySelector('[data-iris-table-range-copy]')!)
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('Charlie\t25.00\nAlice\t32.00'))
  })

  it('non-formatter columns stay byte-identical with copyWithFormat on', async () => {
    stubClipboard()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{ copyWithFormat: true }}
      />,
    )
    selectRange(0, 0, 1, 1)
    copyViaKey()
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('Charlie\t25\nAlice\t32'))
  })

  it('mask runs BEFORE the formatter — the formatter receives the masked value', async () => {
    stubClipboard()
    interface MaskedRow extends Record<string, unknown> {
      id: number
      name: string
      phone: string
    }
    const maskedCols: IrisTableColumn<MaskedRow>[] = [
      { key: 'name', title: 'Name' },
      {
        key: 'phone',
        title: 'Phone',
        mask: 'sensitive',
        formatter: (v) => `M:${String(v)}`,
      },
    ]
    const maskedRows: MaskedRow[] = [
      { id: 1, name: 'Charlie', phone: '13800138000' },
      { id: 2, name: 'Alice', phone: '13900139000' },
    ]
    render(
      <IrisTable
        columns={maskedCols}
        data={maskedRows}
        rowKey="id"
        cellRange
        clipConfig={{ copyWithFormat: true }}
      />,
    )
    selectRange(0, 0, 1, 1)
    copyViaKey()
    await waitFor(() =>
      expect(clipboardWrite).toHaveBeenCalledWith('Charlie\tM:138****8000\nAlice\tM:139****9000'),
    )
  })

  it("copyWithFormat supersedes exportRaw's copy-path skip on formatter columns (exports untouched)", async () => {
    stubClipboard()
    interface MaskedRow extends Record<string, unknown> {
      id: number
      name: string
      phone: string
    }
    const maskedCols: IrisTableColumn<MaskedRow>[] = [
      { key: 'name', title: 'Name' },
      {
        key: 'phone',
        title: 'Phone',
        mask: 'sensitive',
        exportRaw: true,
        formatter: (v) => `F:${String(v)}`,
      },
    ]
    const maskedRows: MaskedRow[] = [{ id: 1, name: 'Charlie', phone: '13800138000' }]
    // With copyWithFormat: mask → formatter always (exportRaw does not skip the mask).
    render(
      <IrisTable
        columns={maskedCols}
        data={maskedRows}
        rowKey="id"
        cellRange
        clipConfig={{ copyWithFormat: true }}
      />,
    )
    selectRange(0, 0, 0, 1)
    copyViaKey()
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('Charlie\tF:138****8000'))
    cleanup()
    // Regression: without copyWithFormat the exportRaw copy path is unchanged
    // (raw value, no mask, no formatter).
    render(
      <IrisTable columns={maskedCols} data={maskedRows} rowKey="id" cellRange clipConfig={{}} />,
    )
    selectRange(0, 0, 0, 1)
    copyViaKey()
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('Charlie\t13800138000'))
  })

  it('a NON-string formatter result falls back to the masked String — like the context-menu 复制值', async () => {
    stubClipboard()
    const numCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'amount', title: 'Amount', formatter: (v) => Number(v) + 0.5 },
    ]
    render(
      <IrisTable
        columns={numCols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{ copyWithFormat: true }}
      />,
    )
    selectRange(0, 0, 0, 1)
    copyViaKey()
    // The formatter returned a number (25.5) — contextCellText falls back to
    // String(masked) = '25', exactly like the 复制值 quick action.
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('Charlie\t25'))
  })

  it('formatted text still flows through csv RFC-4180 quoting + OWASP neutralization', async () => {
    stubClipboard()
    interface TrickyRow extends Record<string, unknown> {
      id: number
      name: string
      note: string
    }
    const trickyCols: IrisTableColumn<TrickyRow>[] = [
      { key: 'name', title: 'Name' },
      { key: 'note', title: 'Note', formatter: (v) => String(v) },
    ]
    const trickyRows: TrickyRow[] = [
      { id: 1, name: 'A', note: 'He said "hi", ok' },
      { id: 2, name: 'B', note: '=SUM(A1)' },
    ]
    render(
      <IrisTable
        columns={trickyCols}
        data={trickyRows}
        rowKey="id"
        cellRange
        clipConfig={{ copyWithFormat: true, copyFormat: 'csv' }}
      />,
    )
    selectRange(0, 0, 1, 1)
    copyViaKey()
    await waitFor(() =>
      expect(clipboardWrite).toHaveBeenCalledWith('A,"He said ""hi"", ok"\nB,\'=SUM(A1)'),
    )
  })

  it('formatted text in html goes through toHtml escaping and loses numeric right-align (fiat)', async () => {
    stubClipboard()
    interface MarkupRow extends Record<string, unknown> {
      id: number
      name: string
      amount: number
    }
    const markupCols: IrisTableColumn<MarkupRow>[] = [
      { key: 'name', title: 'Name' },
      { key: 'amount', title: 'Amount', formatter: () => '<b>hi</b> & "bye"' },
    ]
    const markupRows: MarkupRow[] = [{ id: 1, name: 'Charlie', amount: 25 }]
    render(
      <IrisTable
        columns={markupCols}
        data={markupRows}
        rowKey="id"
        cellRange
        clipConfig={{ copyWithFormat: true, copyFormat: 'html' }}
      />,
    )
    selectRange(0, 0, 0, 1)
    copyViaKey()
    await waitFor(() =>
      expect(clipboardWrite).toHaveBeenCalledWith(
        '<table><thead><tr><th>Name</th><th>Amount</th></tr></thead><tbody>' +
          '<tr><td>Charlie</td><td>&lt;b&gt;hi&lt;/b&gt; &amp; &quot;bye&quot;</td></tr>' +
          '</tbody></table>',
      ),
    )
  })

  it('copyWithFormat is orthogonal to copyFormat — tsv / csv / html all carry the formatted text', async () => {
    stubClipboard()
    const moneyCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'amount', title: 'Amount', formatter: (v) => `$${String(v)}` },
    ]
    for (const format of ['tsv', 'csv', 'html'] as const) {
      render(
        <IrisTable
          columns={moneyCols}
          data={rows}
          rowKey="id"
          cellRange
          clipConfig={{ copyWithFormat: true, copyFormat: format }}
        />,
      )
      selectRange(0, 0, 1, 1)
      copyViaKey()
      if (format === 'tsv') {
        await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('Charlie\t$25\nAlice\t$32'))
      } else if (format === 'csv') {
        await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('Charlie,$25\nAlice,$32'))
      } else {
        await waitFor(() =>
          expect(clipboardWrite).toHaveBeenCalledWith(
            '<table><thead><tr><th>Name</th><th>Amount</th></tr></thead><tbody>' +
              '<tr><td>Charlie</td><td>$25</td></tr>' +
              '<tr><td>Alice</td><td>$32</td></tr>' +
              '</tbody></table>',
          ),
        )
      }
      cleanup()
    }
  })

  it('a row-aware formatter copies its row-dependent formatted text', async () => {
    stubClipboard()
    const rowCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'amount', title: 'Amount', formatter: (v, row) => `${row.name}:${String(v)}` },
    ]
    render(
      <IrisTable
        columns={rowCols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{ copyWithFormat: true }}
      />,
    )
    selectRange(0, 0, 1, 1)
    copyViaKey()
    await waitFor(() =>
      expect(clipboardWrite).toHaveBeenCalledWith('Charlie\tCharlie:25\nAlice\tAlice:32'),
    )
  })

  it('paste stays raw TSV regardless of copyWithFormat (asymmetry fiat)', async () => {
    stubClipboard()
    clipboardRead.mockResolvedValue('X\tY\nZ\tW')
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={fmtCols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{ copyWithFormat: true }}
        onDataChange={onDataChange}
      />,
    )
    fireEvent.click(cell(0, 0))
    fireEvent.keyDown(root(), { key: 'v', ctrlKey: true })
    await waitFor(() => expect(onDataChange).toHaveBeenCalledTimes(1))
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toMatchObject({ id: 1, name: 'X', amount: 'Y' })
    expect(next[1]).toMatchObject({ id: 2, name: 'Z', amount: 'W' })
  })

  it('no live range → no-op even with copyWithFormat set', async () => {
    stubClipboard()
    render(
      <IrisTable
        columns={fmtCols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{ copyWithFormat: true }}
      />,
    )
    copyViaKey()
    // Give the async write a chance to run — it must never fire.
    await new Promise((r) => setTimeout(r, 20))
    expect(clipboardWrite).not.toHaveBeenCalled()
  })

  it('a formula column (batch-AO choke point) copies its formatter output of the COMPUTED value', async () => {
    stubClipboard()
    const formulaCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      {
        key: 'doubled',
        title: 'Doubled',
        formula: 'amount * 2',
        formatter: (v) => `$${String(v)}`,
      },
    ]
    render(
      <IrisTable
        columns={formulaCols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{ copyWithFormat: true }}
      />,
    )
    selectRange(0, 0, 1, 1)
    copyViaKey()
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('Charlie\t$50\nAlice\t$64'))
  })
})
