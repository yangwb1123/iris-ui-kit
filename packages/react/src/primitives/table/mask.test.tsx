import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { exportCsv } from './exportCsv'
import { IrisTable } from './Table'
import type { IrisTableColumn, IrisTableHandle } from './types'

afterEach(() => {
  cleanup()
  clipboardWrite.mockReset()
  // Restore the pristine jsdom navigator (no Clipboard API) between tests.
  Reflect.deleteProperty(navigator, 'clipboard')
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  phone: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Alexandra', phone: '13812345678', age: 25 },
  { id: 2, name: 'Bob', phone: '13900001111', age: 32 },
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'phone', title: 'Phone', mask: 'sensitive' },
  { key: 'age', title: 'Age' },
]

function cell(rowId: number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}

function tableRef(): { current: IrisTableHandle<Row> | null } {
  return { current: null }
}

function rowCheckboxes(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[type=checkbox]')).slice(1)
}

function selectRow(i: number): void {
  act(() => {
    fireEvent.click(rowCheckboxes()[i]!)
  })
}

// ── clipConfig copy (TSV) support ──────────────────────────────────────────
const clipboardWrite = vi.fn<(text: string) => Promise<void>>()

function stubClipboard(): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: clipboardWrite, readText: async () => '' },
  })
  clipboardWrite.mockResolvedValue(undefined)
}

function cellAt(row: number, col: number): HTMLElement {
  return document.querySelector(
    `[data-iris-cell-row="${row}"][data-iris-cell-col="${col}"]`,
  ) as HTMLElement
}

describe('@iris-ui-kit/react IrisTable mask (batch AY, iris 独有)', () => {
  it('masks a sensitive column in display, leaves other columns untouched', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    expect(cell(1, 'phone').textContent).toBe('138****5678')
    expect(cell(2, 'phone').textContent).toBe('139****1111')
    expect(cell(1, 'name').textContent).toBe('Alexandra')
    expect(cell(2, 'age').textContent).toBe('32')
  })

  it('a custom mask function receives the RAW value and its result renders', () => {
    const mask = vi.fn((value: unknown) => `M:${String(value).slice(0, 2)}`)
    render(<IrisTable columns={[{ key: 'name', title: 'Name', mask }]} data={rows} rowKey="id" />)
    expect(mask).toHaveBeenCalledWith('Alexandra')
    expect(cell(1, 'name').textContent).toBe('M:Al')
  })

  it('a formatter receives the MASKED string (mask first, formatter second)', () => {
    const seen: unknown[] = []
    render(
      <IrisTable
        columns={[
          {
            key: 'phone',
            title: 'Phone',
            mask: 'sensitive',
            formatter: (value) => (seen.push(value), `F(${String(value)})`),
          },
        ]}
        data={rows}
        rowKey="id"
      />,
    )
    // The formatter may run more than once per cell (re-renders) — the
    // contract is that it receives the MASKED string, never the raw one.
    expect(seen).toContain('138****5678')
    expect(seen).toContain('139****1111')
    expect(seen).not.toContain('13812345678')
    expect(cell(1, 'phone').textContent).toBe('F(138****5678)')
  })

  it('the tooltip shows the masked value', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" tooltipConfig={{}} />)
    expect(cell(1, 'phone').getAttribute('title')).toBe('138****5678')
    expect(cell(1, 'name').getAttribute('title')).toBe('Alexandra')
  })

  it('editing shows the RAW value — the mask is display-only', () => {
    const editCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'phone', title: 'Phone', mask: 'sensitive', editable: true },
    ]
    render(<IrisTable columns={editCols} data={rows} rowKey="id" />)
    act(() => {
      fireEvent.doubleClick(cell(1, 'phone'))
    })
    const editor = document.querySelector('[data-iris-table-editor]') as HTMLInputElement
    expect(editor.value).toBe('13812345678')
  })

  it('exportCsv masks by default per column', () => {
    expect(exportCsv(rows, cols)).toBe(
      'Name,Phone,Age\nAlexandra,138****5678,25\nBob,139****1111,32',
    )
  })

  it('exportRaw exports the RAW value (display keeps masking)', () => {
    const rawCols: IrisTableColumn<Row>[] = cols.map((c) =>
      c.key === 'phone' ? { ...c, exportRaw: true } : c,
    )
    expect(exportCsv(rows, rawCols)).toBe(
      'Name,Phone,Age\nAlexandra,13812345678,25\nBob,13900001111,32',
    )
  })

  it('the handle exportCurrentViewCsv applies the mask', () => {
    const ref = tableRef()
    render(<IrisTable columns={cols} data={rows} rowKey="id" tableRef={ref} />)
    expect(ref.current!.exportCurrentViewCsv()).toBe(
      'Name,Phone,Age\nAlexandra,138****5678,25\nBob,139****1111,32',
    )
  })

  it('the handle exportSelectionCsv applies the mask; exportRaw column stays raw', () => {
    const ref = tableRef()
    render(
      <IrisTable
        columns={cols.map((c) => (c.key === 'age' ? { ...c, exportRaw: true } : c))}
        data={rows}
        rowKey="id"
        selectable="multi"
        tableRef={ref}
      />,
    )
    selectRow(0)
    expect(ref.current!.exportSelectionCsv()).toBe('Name,Phone,Age\nAlexandra,138****5678,25')
  })

  it('masking resolves through dataIndex, and non-string raw values are coerced', () => {
    render(
      <IrisTable
        columns={[{ key: 'phone', title: 'Phone', mask: 'sensitive', dataIndex: 'mobile' }]}
        data={rows.map((r) => ({ id: r.id, mobile: Number(r.phone) }))}
        rowKey="id"
      />,
    )
    // 11-digit number → phone mask (string-coerced first).
    expect(cell(1, 'phone').textContent).toBe('138****5678')
  })

  it('the clipConfig copy TSV masks sensitive columns unless exportRaw', async () => {
    stubClipboard()
    const rawCols: IrisTableColumn<Row>[] = cols.map((c) =>
      c.key === 'age' ? { ...c, exportRaw: true } : c,
    )
    render(<IrisTable columns={rawCols} data={rows} rowKey="id" cellRange clipConfig={{}} />)
    fireEvent.click(cellAt(0, 0))
    fireEvent.click(cellAt(1, 2), { shiftKey: true })
    fireEvent.keyDown(document.querySelector('[data-iris-table]')!, { key: 'c', ctrlKey: true })
    await waitFor(() =>
      expect(clipboardWrite).toHaveBeenCalledWith(
        'Alexandra\t138****5678\t25\nBob\t139****1111\t32',
      ),
    )
  })
})
