import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { IrisTable } from '../Table'
import { IrisI18nProvider } from '../../../i18n'
import type { IrisTableColumn } from '../types'

afterEach(() => {
  cleanup()
  clipboardWrite.mockReset()
  // Restore the pristine jsdom navigator (no Clipboard API) between tests.
  Reflect.deleteProperty(navigator, 'clipboard')
})

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
function openMenu(rowId: number, key: string): void {
  fireEvent.contextMenu(cell(rowId, key), { clientX: 100, clientY: 80 })
}

const clipboardWrite = vi.fn<(text: string) => Promise<void>>()
function stubClipboard(): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: clipboardWrite },
  })
  clipboardWrite.mockResolvedValue(undefined)
}

describe('@iris-ui-kit/react IrisTable context quick actions (batch BW, iris 独有)', () => {
  it('copy + clear are unconditional quick actions appended after the user items', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        contextMenu={{
          items: () => [{ key: 'edit', label: 'Edit row' }],
          onSelect: vi.fn(),
        }}
      />,
    )
    openMenu(1, 'name')
    expect(menuItems().map((i) => i.textContent)).toEqual(['Edit row', 'Copy value', 'Clear cell'])
    expect(menuItem('__iris-copy-value')).not.toBeNull()
    expect(menuItem('__iris-clear-cell')).not.toBeNull()
  })

  it('format actions are opt-in and use the normal data-change funnel', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        contextMenu={{ items: () => [], onSelect: vi.fn(), formatActions: true }}
        onDataChange={onDataChange}
      />,
    )
    openMenu(1, 'age')
    expect(menuItems().map((i) => i.textContent)).toEqual([
      'Copy value',
      'Clear cell',
      'Format number (2 decimals)',
      'Uppercase text',
    ])
    fireEvent.click(menuItem('__iris-format-number')!)
    expect(onDataChange).toHaveBeenCalledTimes(1)
    expect((onDataChange.mock.calls[0]![0] as Row[])[0]!.age).toBe('25.00')
  })

  it('copy/clear sit after the distribution+summary built-ins and BEFORE annotate', () => {
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

  it('copy writes the masked + formatted display text to the clipboard', async () => {
    stubClipboard()
    render(
      <IrisTable
        columns={[
          {
            key: 'phone',
            title: 'Phone',
            mask: (v: unknown) => `masked:${String(v)}`,
            formatter: (v: unknown) => `fmt:${String(v)}`,
          },
        ]}
        data={[{ id: 1, phone: '555' }]}
        rowKey="id"
        contextMenu={{ items: () => [], onSelect: vi.fn() }}
      />,
    )
    openMenu(1, 'phone')
    fireEvent.click(menuItem('__iris-copy-value')!)
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('fmt:masked:555'))
  })

  it('copy writes the raw text and coerces null to empty string', async () => {
    stubClipboard()
    render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'note', title: 'Note' },
        ]}
        data={[{ id: 1, name: 'Alexandra', note: null }]}
        rowKey="id"
        contextMenu={{ items: () => [], onSelect: vi.fn() }}
      />,
    )
    openMenu(1, 'name')
    fireEvent.click(menuItem('__iris-copy-value')!)
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('Alexandra'))
    clipboardWrite.mockClear()
    openMenu(1, 'note')
    fireEvent.click(menuItem('__iris-copy-value')!)
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith(''))
  })

  it('copy/clear are intercepted: the user onSelect never sees the reserved keys', () => {
    const onSelect = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        contextMenu={{ items: () => [], onSelect }}
      />,
    )
    openMenu(1, 'name')
    fireEvent.click(menuItem('__iris-copy-value')!)
    openMenu(1, 'name')
    fireEvent.click(menuItem('__iris-clear-cell')!)
    expect(onSelect).not.toHaveBeenCalled()
    expect(menu()).toBeNull()
  })

  it('clear writes the cell to empty via one onDataChange (Delete-funnel parity)', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        contextMenu={{ items: () => [], onSelect: vi.fn() }}
        onDataChange={onDataChange}
      />,
    )
    openMenu(1, 'name')
    fireEvent.click(menuItem('__iris-clear-cell')!)
    expect(onDataChange).toHaveBeenCalledTimes(1)
    const next = onDataChange.mock.calls[0]![0] as Row[]
    expect(next[0]).toEqual({ id: 1, name: '', age: 25 })
    expect(next[1]).toBe(rows[1])
    // The live cell re-renders cleared; the sibling row is untouched.
    expect(cell(1, 'name').textContent).toBe('')
    expect(cell(2, 'name').textContent).toBe('Bob')
  })

  it('clear is a no-op on locked and permission-readonly cells', () => {
    const onDataChange = vi.fn()
    render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name', locked: true },
          { key: 'age', title: 'Age', cellPermission: () => 'readonly' },
        ]}
        data={rows}
        rowKey="id"
        contextMenu={{ items: () => [], onSelect: vi.fn() }}
        onDataChange={onDataChange}
      />,
    )
    // locked column → no-op.
    openMenu(1, 'name')
    fireEvent.click(menuItem('__iris-clear-cell')!)
    expect(onDataChange).not.toHaveBeenCalled()
    expect(cell(1, 'name').textContent).toBe('Alexandra')
    // permission-readonly column → no-op too.
    openMenu(1, 'age')
    fireEvent.click(menuItem('__iris-clear-cell')!)
    expect(onDataChange).not.toHaveBeenCalled()
    expect(cell(1, 'age').textContent).toBe('25')
  })

  it('clear is lazy-safe without onDataChange: live data still updates, no crash', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        contextMenu={{ items: () => [], onSelect: vi.fn() }}
      />,
    )
    openMenu(1, 'age')
    fireEvent.click(menuItem('__iris-clear-cell')!)
    // No onDataChange: the internal live copy still clears (documented).
    expect(cell(1, 'age').textContent).toBe('')
    expect(cell(2, 'age').textContent).toBe('32')
  })

  it('copy is lazy-safe without a clipboard: no crash, menu closes', async () => {
    // jsdom has no Clipboard API — the three-channel writer no-ops safely
    // (registered handler absent → navigator.clipboard absent → hidden
    // textarea execCommand fallback caught).
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        contextMenu={{ items: () => [], onSelect: vi.fn() }}
      />,
    )
    openMenu(1, 'name')
    expect(() => fireEvent.click(menuItem('__iris-copy-value')!)).not.toThrow()
    await waitFor(() => expect(menu()).toBeNull())
  })

  it('a user item already using a reserved key is not duplicated', () => {
    const onSelect = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        contextMenu={{
          items: () => [
            { key: '__iris-copy-value', label: 'Mine copy' },
            { key: '__iris-clear-cell', label: 'Mine clear' },
          ],
          onSelect,
        }}
      />,
    )
    openMenu(1, 'name')
    expect(menuItems().map((i) => i.textContent)).toEqual(['Mine copy', 'Mine clear'])
    // The user versions are still intercepted by the onSelect wiring.
    fireEvent.click(menuItem('__iris-copy-value')!)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('no contextMenu prop → no menu nodes at all', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    openMenu(1, 'name')
    expect(menu()).toBeNull()
  })

  it('labels come from i18n (zh overrides via provider)', () => {
    render(
      <IrisI18nProvider messages={{ 'table.copyValue': '复制值', 'table.clearCell': '清空' }}>
        <IrisTable
          columns={cols}
          data={rows}
          rowKey="id"
          contextMenu={{ items: () => [], onSelect: vi.fn() }}
        />
      </IrisI18nProvider>,
    )
    openMenu(1, 'name')
    expect(menuItems().map((i) => i.textContent)).toEqual(['复制值', '清空'])
  })
})
