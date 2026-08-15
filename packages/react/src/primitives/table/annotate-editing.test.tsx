import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn, IrisTableContextMenuParams } from './types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Alexandra', age: 25 },
  { id: 2, name: 'Bob', age: 32 },
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

function cell(rowId: string | number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}
function menu(): HTMLElement | null {
  return document.querySelector('[data-iris-table-context-menu]')
}
function menuItems(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-table-context-menu-item]'))
}
function menuItem(key: string): HTMLElement | null {
  return document.querySelector(`[data-iris-table-context-menu-item="${key}"]`)
}
function panel(): HTMLElement | null {
  return document.querySelector('[data-iris-annotate-panel]')
}
function input(): HTMLTextAreaElement | null {
  return document.querySelector('[data-iris-annotate-input]')
}
function openMenu(rowId: number, key: string): void {
  fireEvent.contextMenu(cell(rowId, key), { clientX: 100, clientY: 80 })
}

/** Stateful harness: the parent owns the annotations map (controlled). */
function AnnotateHarness({
  initial = {},
}: {
  initial?: Record<string, string>
}): React.ReactElement {
  const [notes, setNotes] = React.useState(initial)
  return (
    <IrisTable
      columns={cols}
      data={rows}
      rowKey="id"
      annotations={notes}
      annotationEditing
      onAnnotationsChange={(next) => setNotes(next)}
      contextMenu={{ items: () => [], onSelect: vi.fn() }}
    />
  )
}

describe('@iris-ui-kit/react IrisTable annotation editing (batch BB, iris 独有)', () => {
  it('menu items vary by the cell existing note: add when none, edit+remove when one', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        annotations={{ '1::name': 'VIP customer' }}
        annotationEditing
        onAnnotationsChange={vi.fn()}
        contextMenu={{
          items: () => [
            { key: 'edit', label: 'Edit row' },
            { key: 'delete', label: 'Delete row' },
          ],
          onSelect: vi.fn(),
        }}
      />,
    )
    // Noted cell → 编辑批注 + 删除批注 AFTER the user items and the
    // batch-BW quick actions.
    openMenu(1, 'name')
    expect(menuItems().map((i) => i.textContent)).toEqual([
      'Edit row',
      'Delete row',
      'Copy value',
      'Clear cell',
      'Edit annotation',
      'Remove annotation',
    ])
    expect(menuItem('__iris-annotate')).toBeNull()
    expect(menuItem('__iris-annotate-edit')).not.toBeNull()
    expect(menuItem('__iris-annotate-remove')).not.toBeNull()
    // Note-less cell → single 添加批注 item.
    openMenu(1, 'age')
    expect(menuItems().map((i) => i.textContent)).toEqual([
      'Edit row',
      'Delete row',
      'Copy value',
      'Clear cell',
      'Add annotation',
    ])
    expect(menuItem('__iris-annotate')).not.toBeNull()
    expect(menuItem('__iris-annotate-edit')).toBeNull()
    expect(menuItem('__iris-annotate-remove')).toBeNull()
  })

  it('the annotate items append AFTER the built-in 摘要 item', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        annotations={{ '1::name': 'VIP customer' }}
        annotationEditing
        onAnnotationsChange={vi.fn()}
        valueDistribution
        nlSummary
        contextMenu={{ items: () => [], onSelect: vi.fn() }}
      />,
    )
    openMenu(1, 'age')
    expect(menuItems().map((i) => i.textContent)).toEqual([
      'Value distribution',
      'Column summary',
      'Copy value',
      'Clear cell',
      'Add annotation',
    ])
    openMenu(1, 'name')
    expect(menuItems().map((i) => i.textContent)).toEqual([
      'Value distribution',
      'Column summary',
      'Copy value',
      'Clear cell',
      'Edit annotation',
      'Remove annotation',
    ])
  })

  it('save writes the key through onAnnotationsChange (end-to-end: badge appears)', () => {
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        annotationEditing
        onAnnotationsChange={onChange}
        contextMenu={{ items: () => [], onSelect: vi.fn() }}
      />,
    )
    openMenu(1, 'name')
    fireEvent.click(menuItem('__iris-annotate')!)
    expect(panel()).not.toBeNull()
    expect(input()!.value).toBe('')
    act(() => {
      fireEvent.change(input()!, { target: { value: 'needs review' } })
    })
    fireEvent.click(document.querySelector('[data-iris-annotate-save]')!)
    expect(onChange).toHaveBeenCalledWith({ '1::name': 'needs review' })
    expect(panel()).toBeNull()
    // The user callback never saw the reserved key.
    expect(menu()).toBeNull()
  })

  it('save with empty text removes the key (panel closes, badge disappears)', () => {
    render(<AnnotateHarness initial={{ '1::name': 'VIP customer' }} />)
    openMenu(1, 'name')
    // 编辑批注 seeds the textarea from the existing note.
    fireEvent.click(menuItem('__iris-annotate-edit')!)
    expect(input()!.value).toBe('VIP customer')
    act(() => {
      fireEvent.change(input()!, { target: { value: '   ' } })
    })
    fireEvent.click(document.querySelector('[data-iris-annotate-save]')!)
    expect(panel()).toBeNull()
    expect(cell(1, 'name').getAttribute('data-iris-cell-note')).toBeNull()
  })

  it('the panel 删除 button removes the key (note exists → button visible)', () => {
    render(<AnnotateHarness initial={{ '1::name': 'VIP customer' }} />)
    // Note-less cells get no 删除 button.
    openMenu(1, 'age')
    fireEvent.click(menuItem('__iris-annotate')!)
    expect(document.querySelector('[data-iris-annotate-remove]')).toBeNull()
    // Noted cells do.
    openMenu(1, 'name')
    fireEvent.click(menuItem('__iris-annotate-edit')!)
    fireEvent.click(document.querySelector('[data-iris-annotate-remove]')!)
    expect(panel()).toBeNull()
    expect(cell(1, 'name').getAttribute('data-iris-cell-note')).toBeNull()
    expect(cell(1, 'name').getAttribute('title')).toBeNull()
  })

  it('the menu 删除批注 item deletes the cell annotation directly (no panel)', () => {
    render(<AnnotateHarness initial={{ '1::name': 'VIP customer' }} />)
    openMenu(1, 'name')
    fireEvent.click(menuItem('__iris-annotate-remove')!)
    expect(panel()).toBeNull()
    expect(cell(1, 'name').getAttribute('data-iris-cell-note')).toBeNull()
    // Other annotations stay untouched.
    expect(cell(1, 'age').getAttribute('data-iris-cell-note')).toBeNull()
  })

  it('no onAnnotationsChange → the items still show but save/remove are inert', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        annotations={{ '1::name': 'VIP customer' }}
        annotationEditing
        contextMenu={{ items: () => [], onSelect: vi.fn() }}
      />,
    )
    // Items still appear (gate is annotationEditing alone — documented).
    openMenu(1, 'age')
    expect(menuItem('__iris-annotate')).not.toBeNull()
    fireEvent.click(menuItem('__iris-annotate')!)
    expect(panel()).not.toBeNull()
    // Save is inert: no crash, panel stays open, nothing written.
    act(() => {
      fireEvent.change(input()!, { target: { value: 'inert' } })
    })
    fireEvent.click(document.querySelector('[data-iris-annotate-save]')!)
    expect(panel()).not.toBeNull()
    // The panel's 删除 button is inert too: no crash, panel stays open,
    // nothing written (close is part of the callback path only).
    openMenu(1, 'name')
    fireEvent.click(menuItem('__iris-annotate-edit')!)
    fireEvent.click(document.querySelector('[data-iris-annotate-remove]')!)
    expect(panel()).not.toBeNull()
    expect(cell(1, 'name').getAttribute('data-iris-cell-note')).toBe('true')
    // The menu remove item is inert too.
    openMenu(1, 'name')
    fireEvent.click(menuItem('__iris-annotate-remove')!)
    expect(cell(1, 'name').getAttribute('data-iris-cell-note')).toBe('true')
  })

  it('without annotationEditing the built-in items are absent', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        annotations={{ '1::name': 'VIP customer' }}
        contextMenu={{ items: () => [{ key: 'edit', label: 'Edit row' }], onSelect: vi.fn() }}
      />,
    )
    openMenu(1, 'name')
    // The annotate items are absent; the batch-BW quick actions remain.
    expect(menuItems().map((i) => i.textContent)).toEqual(['Edit row', 'Copy value', 'Clear cell'])
    expect(menuItem('__iris-annotate')).toBeNull()
    fireEvent.click(menuItem('edit')!)
    expect(panel()).toBeNull()
  })

  it('Escape / outside pointer-down close the panel', () => {
    render(<AnnotateHarness />)
    openMenu(1, 'name')
    fireEvent.click(menuItem('__iris-annotate')!)
    expect(panel()).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(panel()).toBeNull()
    openMenu(1, 'name')
    fireEvent.click(menuItem('__iris-annotate')!)
    expect(panel()).not.toBeNull()
    fireEvent.pointerDown(document.body)
    expect(panel()).toBeNull()
  })

  it('the reserved keys never reach the user onSelect; user items still fire', () => {
    const onSelect = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        annotationEditing
        onAnnotationsChange={vi.fn()}
        contextMenu={{
          items: (params: IrisTableContextMenuParams<Row>) => [
            { key: 'edit', label: 'Edit row' },
            { key: 'delete', label: 'Delete row', disabled: params.rowIndex === 1 },
          ],
          onSelect,
        }}
      />,
    )
    openMenu(2, 'age')
    fireEvent.click(menuItem('__iris-annotate')!)
    expect(onSelect).not.toHaveBeenCalled()
    expect(panel()).not.toBeNull()
    openMenu(2, 'name')
    fireEvent.click(menuItem('edit')!)
    expect(onSelect).toHaveBeenCalledWith(
      'edit',
      expect.objectContaining({ row: rows[1], rowIndex: 1, columnIndex: 0 }),
    )
  })

  it('a user item already using a reserved key is not duplicated (still routes to the panel)', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        annotationEditing
        onAnnotationsChange={vi.fn()}
        contextMenu={{
          items: () => [{ key: '__iris-annotate', label: 'Mine' }],
          onSelect: vi.fn(),
        }}
      />,
    )
    openMenu(1, 'age')
    expect(menuItems().length).toBe(3)
    expect(menuItems()[0]!.textContent).toBe('Mine')
    expect(menuItems()[1]!.getAttribute('data-iris-table-context-menu-item')).toBe(
      '__iris-copy-value',
    )
    expect(menuItems()[2]!.getAttribute('data-iris-table-context-menu-item')).toBe(
      '__iris-clear-cell',
    )
    fireEvent.click(menuItems()[0]!)
    expect(panel()).not.toBeNull()
  })
})
