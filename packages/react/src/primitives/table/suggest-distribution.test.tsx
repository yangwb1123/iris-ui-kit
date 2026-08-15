import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn, IrisTableContextMenuParams } from './types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  status: string
  city: string | null
  level: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', status: 'active', city: 'Berlin', level: 1 },
  { id: 2, name: 'Alice', status: 'paused', city: 'Paris', level: 2 },
  { id: 3, name: 'Bob', status: 'active', city: 'Berlin', level: 3 },
  { id: 4, name: 'Dana', status: 'active', city: 'Rome', level: 4 },
  { id: 5, name: 'Erin', status: 'offline', city: null, level: 2 },
]

const suggestCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'status', title: 'Status', editable: true, editor: 'text', suggest: true },
  { key: 'city', title: 'City', editable: true, suggest: ['Berlin', 'Paris', 'Rome'] },
  { key: 'level', title: 'Level', editable: true, editor: 'number', suggest: true },
  { key: 'none', title: 'None', editable: true },
]

function cell(rowId: string | number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}
function editor(): HTMLInputElement | null {
  return document.querySelector('[data-iris-table-editor]')
}
function datalist(): HTMLDataListElement | null {
  return document.querySelector('[data-iris-edit-suggest]')
}
function contextMenu(): HTMLElement | null {
  return document.querySelector('[data-iris-table-context-menu]')
}
function distributionPanel(): HTMLElement | null {
  return document.querySelector('[data-iris-distribution-panel]')
}

describe('@iris-ui-kit/react IrisTable suggest (batch AM, iris 独有)', () => {
  function renderSuggestTable(): void {
    render(
      <IrisTable columns={suggestCols} data={rows} rowKey="id" editConfig={{ trigger: 'click' }} />,
    )
  }

  it('suggest=true: editing a text cell shows a datalist of the DISTINCT values (sorted)', () => {
    renderSuggestTable()
    act(() => {
      fireEvent.click(cell(1, 'status'))
    })
    const list = datalist()
    expect(list).not.toBeNull()
    // Distinct String values, sorted: active, offline, paused.
    expect(Array.from(list!.querySelectorAll('option')).map((o) => o.value)).toEqual([
      'active',
      'offline',
      'paused',
    ])
    // The input is linked via `list` (text editor only).
    const input = editor()!
    expect(input.type).toBe('text')
    expect(input.getAttribute('list')).toBe(list!.id)
    expect(datalist()!.getAttribute('data-iris-edit-suggest')).toBe('')
  })

  it('array form uses the array verbatim (no body scan)', () => {
    renderSuggestTable()
    act(() => {
      fireEvent.click(cell(1, 'city'))
    })
    expect(Array.from(datalist()!.querySelectorAll('option')).map((o) => o.value)).toEqual([
      'Berlin',
      'Paris',
      'Rome',
    ])
  })

  it('the number editor ignores suggest (no datalist, input stays type=number)', () => {
    renderSuggestTable()
    act(() => {
      fireEvent.click(cell(1, 'level'))
    })
    expect(datalist()).toBeNull()
    expect(editor()!.type).toBe('number')
    expect(editor()!.getAttribute('list')).toBeNull()
  })

  it('a text editor without suggest renders no datalist', () => {
    renderSuggestTable()
    act(() => {
      fireEvent.click(cell(1, 'none'))
    })
    expect(datalist()).toBeNull()
  })

  it('suggest=true caps the distinct list at 50 and stays sorted', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      id: i + 1,
      name: `n${i}`,
      status: `v${String(60 - i).padStart(2, '0')}`,
      city: 'x',
      level: 1,
    }))
    render(
      <IrisTable columns={suggestCols} data={many} rowKey="id" editConfig={{ trigger: 'click' }} />,
    )
    act(() => {
      fireEvent.click(cell(1, 'status'))
    })
    const opts = Array.from(datalist()!.querySelectorAll('option')).map((o) => o.value)
    expect(opts.length).toBe(50)
    // Lexicographically smallest 50 of 60 → 'v01'..'v50'; and they are sorted.
    expect(opts[0]).toBe('v01')
    expect(opts[49]).toBe('v50')
    expect(opts).toEqual([...opts].sort())
  })

  it('the datalist disappears once the edit commits', () => {
    renderSuggestTable()
    act(() => {
      fireEvent.click(cell(1, 'status'))
    })
    expect(datalist()).not.toBeNull()
    act(() => {
      fireEvent.keyDown(editor()!, { key: 'Escape' })
    })
    expect(datalist()).toBeNull()
  })
})

describe('@iris-ui-kit/react IrisTable valueDistribution (batch AM, iris 独有)', () => {
  function renderDistTable(onSelect: ReturnType<typeof vi.fn>): void {
    render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'status', title: 'Status' },
        ]}
        data={rows}
        rowKey="id"
        valueDistribution
        contextMenu={{
          items: (params: IrisTableContextMenuParams<Row>) => [
            { key: 'edit', label: 'Edit row' },
            { key: 'delete', label: 'Delete row', disabled: params.rowIndex === 1 },
          ],
          onSelect,
        }}
      />,
    )
  }

  it('the context menu appends the built-in item AFTER the user items', () => {
    renderDistTable(vi.fn())
    fireEvent.contextMenu(cell(1, 'name'), { clientX: 120, clientY: 80 })
    const items = contextMenu()!.querySelectorAll('[data-iris-table-context-menu-item]')
    expect(items.length).toBe(5)
    expect(items[2]!.textContent).toBe('Value distribution')
    expect(items[2]!.getAttribute('data-iris-table-context-menu-item')).toBe('__iris_distribution')
    // Batch BW: the unconditional 复制值 / 清空 quick actions follow.
    expect(items[3]!.getAttribute('data-iris-table-context-menu-item')).toBe('__iris-copy-value')
    expect(items[4]!.getAttribute('data-iris-table-context-menu-item')).toBe('__iris-clear-cell')
  })

  it('without valueDistribution the built-in item is absent', () => {
    const onSelect = vi.fn()
    render(
      <IrisTable
        columns={[{ key: 'name', title: 'Name' }]}
        data={rows}
        rowKey="id"
        contextMenu={{ items: () => [{ key: 'edit', label: 'Edit row' }], onSelect }}
      />,
    )
    fireEvent.contextMenu(cell(1, 'name'), { clientX: 10, clientY: 10 })
    const items = contextMenu()!.querySelectorAll('[data-iris-table-context-menu-item]')
    expect(items.length).toBe(3)
    expect(items[0]!.textContent).toBe('Edit row')
    // Batch BW: 复制值 + 清空 are unconditional quick actions.
    expect(items[1]!.getAttribute('data-iris-table-context-menu-item')).toBe('__iris-copy-value')
    expect(items[2]!.getAttribute('data-iris-table-context-menu-item')).toBe('__iris-clear-cell')
  })

  it('selecting the built-in item opens the panel with count-desc distribution', () => {
    const onSelect = vi.fn()
    renderDistTable(onSelect)
    fireEvent.contextMenu(cell(1, 'status'), { clientX: 80, clientY: 60 })
    fireEvent.click(
      document.querySelector('[data-iris-table-context-menu-item="__iris_distribution"]')!,
    )
    const panel = distributionPanel()
    expect(panel).not.toBeNull()
    // The menu closed (item click closes it) and the user callback never saw
    // the reserved key.
    expect(contextMenu()).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
    // active ×3 first, then paused/offline singles in first-appearance order.
    const rowsInPanel = panel!.querySelectorAll('[data-iris-distribution-row]')
    expect(rowsInPanel.length).toBe(3)
    expect(rowsInPanel[0]!.textContent).toContain('active')
    expect(rowsInPanel[0]!.querySelector('[data-iris-distribution-count]')!.textContent).toBe('3')
    expect(rowsInPanel[1]!.textContent).toContain('paused')
    expect(rowsInPanel[2]!.textContent).toContain('offline')
  })

  it('a user item still fires onSelect (the built-in key never reaches it)', () => {
    const onSelect = vi.fn()
    renderDistTable(onSelect)
    fireEvent.contextMenu(cell(2, 'name'), { clientX: 10, clientY: 10 })
    fireEvent.click(document.querySelector('[data-iris-table-context-menu-item="edit"]')!)
    expect(onSelect).toHaveBeenCalledWith(
      'edit',
      expect.objectContaining({ row: rows[1], rowIndex: 1, columnIndex: 0 }),
    )
    expect(distributionPanel()).toBeNull()
  })

  it('a user item already using the reserved key is not duplicated', () => {
    const onSelect = vi.fn()
    render(
      <IrisTable
        columns={[{ key: 'name', title: 'Name' }]}
        data={rows}
        rowKey="id"
        valueDistribution
        contextMenu={{
          items: () => [{ key: '__iris_distribution', label: 'Mine' }],
          onSelect,
        }}
      />,
    )
    fireEvent.contextMenu(cell(1, 'name'), { clientX: 10, clientY: 10 })
    const items = contextMenu()!.querySelectorAll('[data-iris-table-context-menu-item]')
    expect(items.length).toBe(3)
    expect(items[0]!.textContent).toBe('Mine')
    expect(items[1]!.getAttribute('data-iris-table-context-menu-item')).toBe('__iris-copy-value')
    expect(items[2]!.getAttribute('data-iris-table-context-menu-item')).toBe('__iris-clear-cell')
    // The user's own item label wins; the table still routes it to the panel.
    fireEvent.click(items[0]!)
    expect(distributionPanel()).not.toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('the panel shows the top 20 plus a muted "其余 N 个" fold', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      name: `n${i}`,
      status: `v${String(i).padStart(2, '0')}`,
      city: 'x',
      level: 1,
    }))
    render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'status', title: 'Status' },
        ]}
        data={many}
        rowKey="id"
        valueDistribution
        contextMenu={{ items: () => [], onSelect: vi.fn() }}
      />,
    )
    fireEvent.contextMenu(cell(1, 'status'), { clientX: 10, clientY: 10 })
    fireEvent.click(
      document.querySelector('[data-iris-table-context-menu-item="__iris_distribution"]')!,
    )
    const panel = distributionPanel()!
    expect(panel.querySelectorAll('[data-iris-distribution-row]').length).toBe(20)
    const others = panel.querySelector('[data-iris-distribution-others]')!
    expect(others.textContent).toBe('5 more')
    expect(others.getAttribute('data-iris-distribution-others')).toBe('')
  })

  it('Escape closes the panel', () => {
    renderDistTable(vi.fn())
    fireEvent.contextMenu(cell(1, 'status'), { clientX: 10, clientY: 10 })
    fireEvent.click(
      document.querySelector('[data-iris-table-context-menu-item="__iris_distribution"]')!,
    )
    expect(distributionPanel()).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(distributionPanel()).toBeNull()
  })

  it('dataIndex indirection: distribution reads the column dataIndex field', () => {
    render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'status', title: 'Status', dataIndex: 'state' },
        ]}
        data={rows.map((r) => ({ id: r.id, name: r.name, state: r.status }))}
        rowKey="id"
        valueDistribution
        contextMenu={{ items: () => [], onSelect: vi.fn() }}
      />,
    )
    fireEvent.contextMenu(cell(1, 'status'), { clientX: 10, clientY: 10 })
    fireEvent.click(
      document.querySelector('[data-iris-table-context-menu-item="__iris_distribution"]')!,
    )
    const panel = distributionPanel()!
    const first = panel.querySelector('[data-iris-distribution-row]')!
    expect(first.textContent).toContain('active')
    expect(first.querySelector('[data-iris-distribution-count]')!.textContent).toBe('3')
  })
})
