import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IrisTable } from '../index'
import type { IrisTableColumn } from '../types'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  note: string
}

const rows: Row[] = [{ id: 1, name: '', note: '' }]

/** Two editRules columns — name (required) and note (uppercase pattern). */
const cols: IrisTableColumn<Row>[] = [
  {
    key: 'name',
    title: 'Name',
    editable: true,
    editRules: [{ required: true, message: 'required' }],
  },
  {
    key: 'note',
    title: 'Note',
    editable: true,
    editRules: [{ pattern: /^[A-Z]+$/, message: 'upper' }],
  },
]

function summary(): HTMLElement | null {
  return document.querySelector('[data-iris-validation-summary]')
}

function summaryText(): string {
  return summary()?.textContent ?? ''
}

function toolbar(): HTMLElement | null {
  return document.querySelector('[data-iris-table-toolbar]')
}

function cellEl(colKey: string): HTMLElement {
  return document.querySelector(`[data-iris-table-cell="${colKey}"]`) as HTMLElement
}

function editor(): HTMLInputElement {
  return document.querySelector('[data-iris-table-editor]') as HTMLInputElement
}

function rowEditor(colKey: string): HTMLInputElement | null {
  return document.querySelector(`[data-iris-table-cell="${colKey}"] [data-iris-table-editor]`)
}

function editorError(): HTMLElement | null {
  return document.querySelector('[data-iris-table-editor-error]')
}

/** Open the cell editor, type a draft, press Enter (async editRules commit). */
function commitCell(colKey: string, draft: string): void {
  fireEvent.doubleClick(cellEl(colKey))
  fireEvent.change(editor(), { target: { value: draft } })
  fireEvent.keyDown(editor(), { key: 'Enter' })
}

// ── Batch BR validation summary (iris 独有 — vxe shows no editRules counts) ─
describe('IrisTable validationSummary (batch BR, iris 独有)', () => {
  it('spec: an editRules commit rejected by validation shows the fail count', async () => {
    const onCellEdit = vi.fn()
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        validationSummary
        onCellEdit={onCellEdit}
      />,
    )
    commitCell('name', '')
    // The commit is blocked (editor stays with the rule message)…
    await waitFor(() => expect(editorError()?.textContent).toContain('required'))
    expect(onCellEdit).not.toHaveBeenCalled()
    // …and the toolbar stamp shows the ledger: Passed 0 · Failed 1.
    await waitFor(() => expect(summaryText()).toBe('Passed 0 · Failed 1'))
    expect(container.querySelector('[data-iris-table-toolbar]')).not.toBeNull()
  })

  it('spec: an editRules commit that passes and lands counts a success', async () => {
    const onCellEdit = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        validationSummary
        onCellEdit={onCellEdit}
      />,
    )
    commitCell('name', 'Alice')
    await waitFor(() => expect(summaryText()).toBe('Passed 1 · Failed 0'))
    expect(onCellEdit).toHaveBeenCalledTimes(1)
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        column: expect.objectContaining({ key: 'name' }),
        newValue: 'Alice',
      }),
    )
    expect(cellEl('name').textContent).toContain('Alice')
  })

  it('keeps independent per-column counts for mixed outcomes', async () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" validationSummary />)
    // name: '' → rejected → 1 fail.
    commitCell('name', '')
    await waitFor(() => expect(summaryText()).toBe('Passed 0 · Failed 1'))
    // name: 'Alice' → passes → 1 ok.
    fireEvent.keyDown(editor(), { key: 'Escape' })
    commitCell('name', 'Alice')
    await waitFor(() => expect(summaryText()).toBe('Passed 1 · Failed 1'))
    // note: 'abc' fails the uppercase pattern → 2 fails, ok untouched.
    // (the successful commit above already closed the name editor)
    commitCell('note', 'abc')
    await waitFor(() => expect(summaryText()).toBe('Passed 1 · Failed 2'))
  })

  it('feature switch off → commits never count and no stamp renders', async () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" toolbar={{}} />)
    commitCell('name', '')
    // Validation still runs (the commit is blocked with the rule message)…
    await waitFor(() => expect(editorError()?.textContent).toContain('required'))
    // …but there is no ledger and no stamp.
    expect(summary()).toBeNull()
  })

  it('typing-time validation never counts — only real commit attempts do', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" validationSummary />)
    // fireEvent wraps each event in its own act, so the editor mounts after
    // the doubleClick before the change fires.
    fireEvent.doubleClick(cellEl('name'))
    fireEvent.change(editor(), { target: { value: '' } })
    // setDraft re-validates live (no commit intent) — zero counted.
    expect(summary()).toBeNull()
    fireEvent.keyDown(editor(), { key: 'Escape' })
    expect(summary()).toBeNull()
  })

  it('legacy validate columns are out of scope — sync rejection never counts', async () => {
    const legacyCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, validate: () => 'nope' },
    ]
    render(<IrisTable columns={legacyCols} data={rows} rowKey="id" validationSummary />)
    commitCell('name', 'x')
    await waitFor(() => expect(editorError()?.textContent).toContain('nope'))
    expect(summary()).toBeNull()
  })

  it('columns without editRules never count — a landed commit is not an ok', () => {
    const plainCols: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name', editable: true }]
    render(<IrisTable columns={plainCols} data={rows} rowKey="id" validationSummary />)
    commitCell('name', 'Alice')
    expect(cellEl('name').textContent).toContain('Alice')
    expect(summary()).toBeNull()
  })

  it('row mode counts per column — each session is its own ledger line', async () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        validationSummary
        editConfig={{ mode: 'row' }}
      />,
    )
    // A click on any cell opens every editable column's editor.
    fireEvent.click(cellEl('name'))
    expect(rowEditor('name')).not.toBeNull()
    expect(rowEditor('note')).not.toBeNull()
    // name: '' → rejected → 1 fail.
    fireEvent.change(rowEditor('name')!, { target: { value: '' } })
    fireEvent.keyDown(rowEditor('name')!, { key: 'Enter' })
    await waitFor(() => expect(summaryText()).toBe('Passed 0 · Failed 1'))
    // note: 'abc' → rejected → 2 fails (the name session stays open).
    fireEvent.change(rowEditor('note')!, { target: { value: 'abc' } })
    fireEvent.keyDown(rowEditor('note')!, { key: 'Enter' })
    await waitFor(() => expect(summaryText()).toBe('Passed 0 · Failed 2'))
    // name: 'Bob' → passes → 1 ok (row mode commits per cell).
    fireEvent.change(rowEditor('name')!, { target: { value: 'Bob' } })
    fireEvent.keyDown(rowEditor('name')!, { key: 'Enter' })
    await waitFor(() => expect(summaryText()).toBe('Passed 1 · Failed 2'))
  })

  it('async validator counts exactly once per commit — typing never double-counts', async () => {
    const asyncCols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        editRules: [
          { validator: (v: unknown) => Promise.resolve(v === 'ok' ? null : 'must be ok') },
        ],
      },
    ]
    render(<IrisTable columns={asyncCols} data={rows} rowKey="id" validationSummary />)
    // Rejected commit → exactly one fail.
    commitCell('name', 'no')
    await waitFor(() => expect(summaryText()).toBe('Passed 0 · Failed 1'))
    // The editor stays open with the error — typing re-validates without intent.
    fireEvent.change(editor(), { target: { value: 'no2' } })
    await new Promise((r) => setTimeout(r, 20))
    expect(summaryText()).toBe('Passed 0 · Failed 1')
    // Accepted commit → exactly one ok on top.
    fireEvent.change(editor(), { target: { value: 'ok' } })
    fireEvent.keyDown(editor(), { key: 'Enter' })
    await waitFor(() => expect(summaryText()).toBe('Passed 1 · Failed 1'))
  })

  it('Escape cancels and paste bypasses never count', async () => {
    const clipboardRead = vi.fn<() => Promise<string>>()
    Reflect.deleteProperty(navigator, 'clipboard')
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(), readText: clipboardRead },
    })
    clipboardRead.mockResolvedValue('X\tY')
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        validationSummary
        cellRange
        clipConfig={{}}
        onDataChange={onDataChange}
      />,
    )
    // Escape cancels the open edit — no commit attempt, no count.
    fireEvent.doubleClick(cellEl('name'))
    fireEvent.change(editor(), { target: { value: '' } })
    fireEvent.keyDown(editor(), { key: 'Escape' })
    expect(summary()).toBeNull()
    // Paste bypasses the edit session entirely (commitRowList) — even though
    // the target column has editRules, a pasted value is never validated or
    // counted (documented bypass, same as fill/FNR/batch).
    fireEvent.click(cellEl('name'))
    fireEvent.keyDown(document.querySelector('[data-iris-table]')!, {
      key: 'v',
      ctrlKey: true,
    })
    await waitFor(() => expect(onDataChange).toHaveBeenCalledTimes(1))
    expect(summary()).toBeNull()
  })

  it('display contract — muted stamp after the perf trigger, before custom buttons', async () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        validationSummary
        perfStats
        toolbar={{ buttons: [{ key: 'custom', label: 'C', onClick: () => {} }] }}
      />,
    )
    commitCell('name', '')
    await waitFor(() => expect(summary()).not.toBeNull())
    const bar = toolbar()!
    const stamp = summary()!
    const perf = bar.querySelector('[data-iris-perf-trigger]')!
    const custom = bar.querySelector('[data-iris-table-toolbar-button="custom"]')!
    const children = Array.from(bar.children)
    expect(children.indexOf(stamp)).toBeGreaterThan(children.indexOf(perf))
    expect(children.indexOf(stamp)).toBeLessThan(children.indexOf(custom))
    // Freshness-style muted token stamp.
    expect(stamp.getAttribute('data-iris-validation-summary')).toBe('')
    expect(stamp.style.fontSize).toBe('var(--iris-font-size-xs, 12px)')
    expect(stamp.style.color).toBe('var(--iris-muted)')
    expect(stamp.textContent).toBe('Passed 0 · Failed 1')
  })

  it('re-enabling the switch resets the ledger; commits while off are no-ops', async () => {
    const { rerender } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" validationSummary />,
    )
    // One fail while on.
    commitCell('name', '')
    await waitFor(() => expect(summaryText()).toBe('Passed 0 · Failed 1'))
    fireEvent.keyDown(editor(), { key: 'Escape' })
    // Switch off → stamp gone, and commits while off count nothing.
    rerender(<IrisTable columns={cols} data={rows} rowKey="id" toolbar={{}} />)
    expect(summary()).toBeNull()
    commitCell('name', '')
    await waitFor(() => expect(editorError()?.textContent).toContain('required'))
    expect(summary()).toBeNull()
    fireEvent.keyDown(editor(), { key: 'Escape' })
    // Switch back on → ledger reset to zero (stamp hidden), then counts fresh.
    rerender(<IrisTable columns={cols} data={rows} rowKey="id" validationSummary />)
    expect(summary()).toBeNull()
    commitCell('name', 'Alice')
    await waitFor(() => expect(summaryText()).toBe('Passed 1 · Failed 0'))
  })
})
