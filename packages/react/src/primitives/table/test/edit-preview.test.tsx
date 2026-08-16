import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import * as React from 'react'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'

afterEach(() => {
  cleanup()
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
  city: string
  note: string
  status: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25, city: 'Rome', note: 'alpha', status: 1 },
  { id: 2, name: 'Alice', age: 32, city: 'Oslo', note: 'beta', status: 2 },
  { id: 3, name: 'Bob', age: 28, city: 'Lyon', note: 'gamma', status: 1 },
]

/** name (text + formatter) · age (number + formatter) · city (no formatter —
 *  the "无 formatter 不显示" gate) · note (textarea + formatter). */
const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true, formatter: (v) => `Name: ${String(v)}` },
  {
    key: 'age',
    title: 'Age',
    editable: true,
    editor: 'number',
    formatter: (v) => `${Number(v).toFixed(1)}`,
  },
  { key: 'city', title: 'City', editable: true },
  {
    key: 'note',
    title: 'Note',
    editable: true,
    editor: 'textarea',
    formatter: (v) => `note=${String(v).replace(/\n/g, '\\n')}`,
  },
]

/** Select editor with NUMBER option values — the typed value stays a number. */
const selectCols: IrisTableColumn<Row>[] = [
  {
    key: 'status',
    title: 'Status',
    editable: true,
    editor: 'select',
    editOptions: [
      { value: 1, label: 'One' },
      { value: 2, label: 'Two' },
    ],
    formatter: (v) => (typeof v === 'number' ? `num:${v}` : `str:${v}`),
  },
]

function editCell(rowId: number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}

function editor(): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null {
  return document.querySelector('[data-iris-table-editor]')
}

function preview(): HTMLElement | null {
  return document.querySelector('[data-iris-edit-preview]')
}

function previews(): HTMLElement[] {
  return [...document.querySelectorAll('[data-iris-edit-preview]')]
}

function openEditor(rowId: number, key: string): void {
  fireEvent.doubleClick(editCell(rowId, key))
}

describe('IrisTable editPreview — 编辑实时预览 (live formatter preview)', () => {
  it('renders the formatter-applied draft below the editor and updates per keystroke', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" editPreview />)
    openEditor(1, 'name')
    expect(editor()).not.toBeNull()
    expect(preview()!.textContent).toBe('Name: Charlie') // seeded raw draft, formatted
    fireEvent.change(editor()!, { target: { value: 'Charlie Edited' } })
    expect(preview()!.textContent).toBe('Name: Charlie Edited')
  })

  it('recomputes live on shrink (deletion) down to the empty draft', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" editPreview />)
    openEditor(1, 'name')
    fireEvent.change(editor()!, { target: { value: 'Char' } })
    expect(preview()!.textContent).toBe('Name: Char')
    fireEvent.change(editor()!, { target: { value: '' } })
    expect(preview()!.textContent).toBe('Name: ')
  })

  it('no formatter → no preview (second gate: "无 formatter 不显示")', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" editPreview />)
    openEditor(1, 'city') // editable but has no formatter
    expect(editor()).not.toBeNull()
    expect(preview()).toBeNull()
  })

  it('fail-closed: no preview without the editPreview prop (even with a formatter)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    openEditor(1, 'name')
    expect(editor()).not.toBeNull()
    expect(preview()).toBeNull()
  })

  it('mask parity: the formatter receives the MASKED draft (mask → formatter)', () => {
    const maskedCols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        mask: () => 'MASKED',
        formatter: (v) => `[${String(v)}]`,
      },
    ]
    render(<IrisTable columns={maskedCols} data={rows} rowKey="id" editPreview />)
    openEditor(1, 'name')
    expect(preview()!.textContent).toBe('[MASKED]') // raw draft 'Charlie' masked first
    fireEvent.change(editor()!, { target: { value: 'new value' } })
    expect(preview()!.textContent).toBe('[MASKED]')
  })

  it('row-aware formatter receives the row being edited', () => {
    const rowAwareCols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        formatter: (v, row) => `${String(v)}@${String(row.id)}`,
      },
    ]
    render(<IrisTable columns={rowAwareCols} data={rows} rowKey="id" editPreview />)
    openEditor(1, 'name')
    expect(preview()!.textContent).toBe('Charlie@1')
    openEditor(2, 'name')
    expect(preview()!.textContent).toBe('Alice@2')
  })

  it('number editor: preview formats the COERCED number (same value the commit writes)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" editPreview />)
    openEditor(1, 'age')
    expect(preview()!.textContent).toBe('25.0') // raw 25 → Number('25').toFixed(1)
    fireEvent.change(editor()!, { target: { value: '25.55' } })
    expect(preview()!.textContent).toBe('25.6') // 25.55.toFixed(1) — never a string crash
  })

  it('select editor: preview formats the option TYPED value (number stays number)', () => {
    render(<IrisTable columns={selectCols} data={rows} rowKey="id" editPreview />)
    openEditor(1, 'status')
    expect(preview()!.textContent).toBe('num:1') // typed option value, not the string draft
    fireEvent.change(editor()!, { target: { value: '2' } })
    expect(preview()!.textContent).toBe('num:2')
  })

  it('textarea editor previews the draft (newlines preserved in the formatted output)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" editPreview />)
    openEditor(1, 'note')
    expect(preview()!.textContent).toBe('note=alpha')
    fireEvent.change(editor()!, { target: { value: 'a\nb' } })
    expect(preview()!.textContent).toBe('note=a\\nb')
  })

  it('row edit mode shows a preview under every open editor of a formatted column', () => {
    render(
      <IrisTable columns={cols} data={rows} rowKey="id" editPreview editConfig={{ mode: 'row' }} />,
    )
    openEditor(1, 'name')
    // name + age + note have formatters; city (no formatter) must NOT show one.
    expect(previews().length).toBe(3)
    expect(previews()[0]!.textContent).toBe('Name: Charlie')
    expect(previews()[1]!.textContent).toBe('25.0')
    expect(previews()[2]!.textContent).toBe('note=alpha')
  })

  it('commit (Enter) tears the editor AND the preview down', () => {
    const onCellEdit = vi.fn()
    render(<IrisTable columns={cols} data={rows} rowKey="id" editPreview onCellEdit={onCellEdit} />)
    openEditor(1, 'name')
    expect(preview()).not.toBeNull()
    fireEvent.keyDown(editor()!, { key: 'Enter' })
    expect(editor()).toBeNull()
    expect(preview()).toBeNull()
  })

  it('Escape cancels and tears the preview down (no commit)', () => {
    const onCellEdit = vi.fn()
    render(<IrisTable columns={cols} data={rows} rowKey="id" editPreview onCellEdit={onCellEdit} />)
    openEditor(1, 'name')
    fireEvent.change(editor()!, { target: { value: 'Edited' } })
    expect(preview()!.textContent).toBe('Name: Edited')
    fireEvent.keyDown(editor()!, { key: 'Escape' })
    expect(editor()).toBeNull()
    expect(preview()).toBeNull()
    expect(onCellEdit).not.toHaveBeenCalled()
  })

  it('muted-token style (font-size-xs / muted / space-xxs) and validation error coexistence', () => {
    const validatedCols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        formatter: (v) => `Name: ${String(v)}`,
        validate: (v) => (String(v).length < 5 ? 'Too short' : null),
      },
    ]
    render(<IrisTable columns={validatedCols} data={rows} rowKey="id" editPreview />)
    openEditor(1, 'name')
    fireEvent.change(editor()!, { target: { value: 'Al' } }) // fails validation
    const el = preview()!
    expect(el.style.fontSize).toBe('var(--iris-font-size-xs, 12px)')
    expect(el.style.color).toBe('var(--iris-muted)')
    expect(el.style.marginTop).toBe('var(--iris-space-xxs, 4px)')
    expect(el.style.pointerEvents).toBe('none') // pure display, never intercepts input
    const err = document.querySelector('[data-iris-table-editor-error]')
    expect(err).not.toBeNull()
    expect(err!.textContent).toBe('Too short')
    // Preview renders BEFORE the error in flow (error stays the last line).
    expect(el.compareDocumentPosition(err!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('layout contract: the editing cell wraps so preview/error stack UNDER the editor (below-line fix)', () => {
    const validatedCols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        formatter: (v) => `Name: ${String(v)}`,
        validate: (v) => (String(v).length < 5 ? 'Too short' : null),
      },
    ]
    render(<IrisTable columns={validatedCols} data={rows} rowKey="id" editPreview />)
    // Non-editing cells stay single-line (no wrap).
    expect(editCell(2, 'name').style.flexWrap).toBe('')
    openEditor(1, 'name')
    // The editing cell wraps its children — the browser lays each flex line
    // out separately, so a full-basis line always lands UNDER the previous
    // one (the spec's 下方/下面 contract, empirically verified in Chrome).
    const cell = editCell(1, 'name')
    expect(cell.style.flexWrap).toBe('wrap')
    const el = preview()!
    expect(el.style.flexBasis).toBe('100%') // full-width line: never beside the editor
    expect(el.style.minWidth).toBe('0') // ellipsis needs a shrinkable flex line
    // Validation error takes its own full-width line below the preview.
    fireEvent.change(editor()!, { target: { value: 'Al' } })
    const err = document.querySelector('[data-iris-table-editor-error]') as HTMLElement
    expect(err).not.toBeNull()
    expect(err.style.flexBasis).toBe('100%')
    // In-flow order editor → preview → error (each wraps under the previous).
    expect(editor()!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(el.compareDocumentPosition(err) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
