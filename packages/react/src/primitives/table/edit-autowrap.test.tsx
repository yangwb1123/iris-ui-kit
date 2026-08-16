import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable, autoHeightSize } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'ab', age: 25 },
  { id: 2, name: 'cd', age: 30 },
]

const textareaCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true, editor: 'textarea' },
  { key: 'age', title: 'Age', editable: true },
]

function cell(rowId: string | number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}

function textareaEditor(): HTMLTextAreaElement | null {
  return document.querySelector('[data-iris-table-editor-textarea]')
}

/** jsdom has no layout — stub the measured scrollHeight on the live editor. */
function stubScrollHeight(ta: HTMLTextAreaElement, px: number): void {
  Object.defineProperty(ta, 'scrollHeight', { configurable: true, value: px })
}

/** Open the name cell's textarea editor (cell mode, editAutoHeight on). */
function openAutoTextarea(): HTMLTextAreaElement {
  render(<IrisTable columns={textareaCols} data={rows} rowKey="id" editAutoHeight />)
  act(() => {
    fireEvent.doubleClick(cell(1, 'name'))
  })
  const ta = textareaEditor()
  expect(ta).not.toBeNull()
  return ta!
}

// ── autoHeightSize pure mapping (batch CC, iris 独有) ───────────────────────
// All math lives in the exported pure function (jsdom has zero layout, so
// scrollHeight is always 0 there). lineHeight 20 → maxHeight = 6 × 20 = 120.
describe('autoHeightSize (batch CC, iris 独有)', () => {
  it('grows with content: 2 lines of 20px scrollHeight → height 40px, no scrollbar', () => {
    expect(autoHeightSize(40, 20)).toEqual({
      height: 40,
      maxHeight: 120,
      overflowY: 'hidden',
    })
  })

  it('caps at 6 rows: 300px scrollHeight → height 120px + internal scrollbar', () => {
    expect(autoHeightSize(300, 20)).toEqual({
      height: 120,
      maxHeight: 120,
      overflowY: 'auto',
    })
  })

  it('exactly 6 rows (120px) has NO scrollbar — strict overflow only', () => {
    expect(autoHeightSize(120, 20)).toEqual({
      height: 120,
      maxHeight: 120,
      overflowY: 'hidden',
    })
  })

  it('shrinks back when content shrinks (stateless per measurement)', () => {
    // Was 120px at the cap, content deleted down to 3 lines → 60px again.
    expect(autoHeightSize(60, 20)).toEqual({
      height: 60,
      maxHeight: 120,
      overflowY: 'hidden',
    })
  })

  it('floors at one line — empty/zero scrollHeight never collapses the editor', () => {
    expect(autoHeightSize(0, 20)).toEqual({
      height: 20,
      maxHeight: 120,
      overflowY: 'hidden',
    })
  })
})

// ── editAutoHeight integration (iris 独有, batch CC) ────────────────────────
// jsdom reports lineHeight 'normal' → the session cache falls back to 16px,
// so maxHeight = 6 × 16 = 96px in the DOM wiring tests below.
describe('IrisTable editAutoHeight (batch CC, iris 独有)', () => {
  it('default OFF is byte-identical to batch I — rows=3 regression lock', () => {
    render(<IrisTable columns={textareaCols} data={rows} rowKey="id" />)
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    const ta = textareaEditor()
    expect(ta).not.toBeNull()
    expect(ta!.getAttribute('rows')).toBe('3')
    // No auto-height styles are applied without the prop.
    expect(ta!.style.height).toBe('')
    expect(ta!.style.maxHeight).toBe('')
  })

  it('ON starts at 1 row and onInput grows height with scrollHeight', () => {
    const ta = openAutoTextarea()
    expect(ta.getAttribute('rows')).toBe('1')
    stubScrollHeight(ta, 40)
    act(() => {
      fireEvent.input(ta)
    })
    expect(ta.style.height).toBe('40px')
    expect(ta.style.maxHeight).toBe('96px')
    expect(ta.style.overflowY).toBe('hidden')
  })

  it('ON caps at 6 rows — overflow beyond the cap scrolls inside the editor', () => {
    const ta = openAutoTextarea()
    stubScrollHeight(ta, 200)
    act(() => {
      fireEvent.input(ta)
    })
    expect(ta.style.height).toBe('96px')
    expect(ta.style.maxHeight).toBe('96px')
    expect(ta.style.overflowY).toBe('auto')
  })

  it('ON keeps the batch I interaction invariants — Enter/Shift+Enter/Escape/aria', () => {
    const onCellEdit = vi.fn()
    render(
      <IrisTable
        columns={textareaCols}
        data={rows}
        rowKey="id"
        editAutoHeight
        onCellEdit={onCellEdit}
      />,
    )
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    const ta = textareaEditor()!
    // Shift+Enter inserts a newline WITHOUT committing.
    act(() => {
      fireEvent.change(ta, { target: { value: 'line1' } })
      fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true })
    })
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(textareaEditor()).not.toBeNull()
    // Escape cancels without emitting.
    act(() => {
      fireEvent.change(ta, { target: { value: 'discard' } })
      fireEvent.keyDown(ta, { key: 'Escape' })
    })
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(textareaEditor()).toBeNull()
    expect(cell(1, 'name').textContent).toBe('ab')
    // Enter commits.
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    const ta2 = textareaEditor()!
    act(() => {
      fireEvent.change(ta2, { target: { value: 'committed' } })
      fireEvent.keyDown(ta2, { key: 'Enter' })
    })
    expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ newValue: 'committed' }))
    expect(textareaEditor()).toBeNull()
  })

  it('row edit mode shares the same auto-height surface', () => {
    render(
      <IrisTable
        columns={textareaCols}
        data={rows}
        rowKey="id"
        editConfig={{ mode: 'row' }}
        editAutoHeight
      />,
    )
    act(() => {
      fireEvent.click(cell(1, 'name'))
    })
    const ta = textareaEditor()
    expect(ta).not.toBeNull()
    expect(ta!.getAttribute('rows')).toBe('1')
    stubScrollHeight(ta!, 40)
    act(() => {
      fireEvent.input(ta!)
    })
    expect(ta!.style.height).toBe('40px')
    expect(ta!.style.maxHeight).toBe('96px')
    expect(ta!.style.overflowY).toBe('hidden')
  })
})
