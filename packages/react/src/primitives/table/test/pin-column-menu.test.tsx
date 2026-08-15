import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from '../Table'
import { IrisI18nProvider } from '../../../i18n'
import type { IrisTableColumn } from '../types'

afterEach(() => {
  cleanup()
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

function header(key: string): HTMLElement {
  return document.querySelector(`[data-iris-table-header="${key}"]`) as HTMLElement
}
function cell(rowId: number, key: string): HTMLElement {
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
function openHeaderMenu(key: string): void {
  fireEvent.contextMenu(header(key), { clientX: 120, clientY: 40 })
}

describe('@iris-ui-kit/react IrisTable header pin menu (batch BX, iris 独有)', () => {
  it('pin-left end to end: right-click header → Pin left → column goes sticky left', () => {
    const onPinned = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        columnPinMenu
        onColumnPinnedChange={onPinned}
      />,
    )
    openHeaderMenu('name')
    expect(menuItems().map((i) => i.textContent)).toEqual(['Pin left'])
    fireEvent.click(menuItem('__iris-pin-left')!)
    // Uncontrolled: the internal map flips immediately + callback fires.
    expect(onPinned).toHaveBeenCalledWith('name', 'left')
    expect(header('name').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header('name').style.position).toBe('sticky')
    expect(header('name').style.left).toBe('0px')
    expect(cell(1, 'name').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header('age').getAttribute('data-iris-table-pinned')).toBeNull()
  })

  it('unpin: a statically-pinned column shows Unpin and right-click unpins it', () => {
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', pinned: 'left' },
      { key: 'age', title: 'Age' },
    ]
    const onPinned = vi.fn()
    render(
      <IrisTable
        columns={pinnedCols}
        data={rows}
        rowKey="id"
        columnPinMenu
        onColumnPinnedChange={onPinned}
      />,
    )
    expect(header('name').getAttribute('data-iris-table-pinned')).toBe('left')
    openHeaderMenu('name')
    expect(menuItems().map((i) => i.textContent)).toEqual(['Unpin'])
    fireEvent.click(menuItem('__iris-unpin')!)
    expect(onPinned).toHaveBeenCalledWith('name', null)
    expect(header('name').getAttribute('data-iris-table-pinned')).toBeNull()
    expect(header('name').style.position).toBe('relative')
    expect(cell(1, 'name').getAttribute('data-iris-table-pinned')).toBeNull()
  })

  it('the menu item flips with the current pin state (single, mutually exclusive)', () => {
    // Unpinned → Pin left.
    render(<IrisTable columns={cols} data={rows} rowKey="id" columnPinMenu pinnedColumns={{}} />)
    openHeaderMenu('name')
    expect(menuItems().map((i) => i.textContent)).toEqual(['Pin left'])
    expect(menuItem('__iris-unpin')).toBeNull()
  })

  it('right-pinned columns offer Unpin too (spec: no pin-right item)', () => {
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', pinned: 'right' },
      { key: 'age', title: 'Age' },
    ]
    render(<IrisTable columns={pinnedCols} data={rows} rowKey="id" columnPinMenu />)
    openHeaderMenu('name')
    expect(menuItems().map((i) => i.textContent)).toEqual(['Unpin'])
    fireEvent.click(menuItem('__iris-unpin')!)
    expect(header('name').getAttribute('data-iris-table-pinned')).toBeNull()
  })

  it('controlled mode: no optimistic flip — only the callback fires', () => {
    const onPinned = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        columnPinMenu
        pinnedColumns={{}}
        onColumnPinnedChange={onPinned}
      />,
    )
    openHeaderMenu('name')
    fireEvent.click(menuItem('__iris-pin-left')!)
    expect(onPinned).toHaveBeenCalledWith('name', 'left')
    // Parent never wrote the map back → the table still renders unpinned.
    expect(header('name').getAttribute('data-iris-table-pinned')).toBeNull()
  })

  it('controlled mode: a parent that applies the change pins the column', () => {
    const PinnedHarness = (): React.ReactElement => {
      const [pinned, setPinned] = React.useState<Record<string, 'left' | 'right' | null>>({})
      return (
        <IrisTable
          columns={cols}
          data={rows}
          rowKey="id"
          columnPinMenu
          pinnedColumns={pinned}
          onColumnPinnedChange={(key, side) => setPinned((p) => ({ ...p, [key]: side }))}
        />
      )
    }
    render(<PinnedHarness />)
    openHeaderMenu('name')
    fireEvent.click(menuItem('__iris-pin-left')!)
    expect(header('name').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header('name').style.position).toBe('sticky')
    // Unpin through the same controlled channel.
    openHeaderMenu('name')
    expect(menuItems().map((i) => i.textContent)).toEqual(['Unpin'])
    fireEvent.click(menuItem('__iris-unpin')!)
    expect(header('name').getAttribute('data-iris-table-pinned')).toBeNull()
  })

  it('uncontrolled: pin state persists inside the table (no callback needed)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" columnPinMenu />)
    openHeaderMenu('name')
    fireEvent.click(menuItem('__iris-pin-left')!)
    expect(header('name').getAttribute('data-iris-table-pinned')).toBe('left')
    // Reopening the menu now shows Unpin (internal state drives the item).
    openHeaderMenu('name')
    expect(menuItems().map((i) => i.textContent)).toEqual(['Unpin'])
  })

  it('static col.pinned seeds the internal state (zero props render pinned)', () => {
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', pinned: 'left', width: 100 },
      { key: 'age', title: 'Age' },
    ]
    render(<IrisTable columns={pinnedCols} data={rows} rowKey="id" />)
    expect(header('name').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header('name').style.position).toBe('sticky')
  })

  it('controlled null overrides the static pinned declaration', () => {
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', pinned: 'left' },
      { key: 'age', title: 'Age' },
    ]
    render(
      <IrisTable columns={pinnedCols} data={rows} rowKey="id" pinnedColumns={{ name: null }} />,
    )
    expect(header('name').getAttribute('data-iris-table-pinned')).toBeNull()
    expect(header('name').style.position).toBe('relative')
  })

  it('controlled `{}` falls back to static pins — absent keys never unpin (BX regression)', () => {
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', pinned: 'left', width: 100 },
      { key: 'age', title: 'Age' },
    ]
    const first = render(
      <IrisTable columns={pinnedCols} data={rows} rowKey="id" columnPinMenu pinnedColumns={{}} />,
    )
    // `{}` is an empty OVERRIDE map — every column falls back to its own
    // declaration, so the static left pin still renders sticky.
    expect(header('name').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header('name').style.position).toBe('sticky')
    // ...and the menu offers Unpin for the statically-pinned column.
    openHeaderMenu('name')
    expect(menuItems().map((i) => i.textContent)).toEqual(['Unpin'])
    first.unmount()
    // Explicit null in the SAME map still unpins (controlled-null-wins).
    render(
      <IrisTable columns={pinnedCols} data={rows} rowKey="id" pinnedColumns={{ name: null }} />,
    )
    expect(header('name').getAttribute('data-iris-table-pinned')).toBeNull()
  })

  it('static-pinned grouped leaf renders pinned (group cells stay unpinned)', () => {
    const groupedCols: IrisTableColumn<Row>[] = [
      {
        key: 'person',
        title: 'Person',
        children: [
          { key: 'name', title: 'Name', pinned: 'left', width: 100 },
          { key: 'age', title: 'Age' },
        ],
      },
      { key: 'extra', title: 'Extra' },
    ]
    render(<IrisTable columns={groupedCols} data={rows} rowKey="id" />)
    expect(header('name').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header('name').style.position).toBe('sticky')
    expect(header('person').getAttribute('data-iris-table-pinned')).toBeNull()
    expect(cell(1, 'name').getAttribute('data-iris-table-pinned')).toBe('left')
  })

  it('multiple pinned columns accumulate sticky offsets (left edge order)', () => {
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', pinned: 'left', width: 100 },
      { key: 'age', title: 'Age', pinned: 'left', width: 80 },
      { key: 'extra', title: 'Extra', width: 200 },
    ]
    render(<IrisTable columns={pinnedCols} data={rows} rowKey="id" />)
    expect(header('name').style.left).toBe('0px')
    expect(header('age').style.left).toBe('100px')
    expect(header('name').style.position).toBe('sticky')
    expect(header('age').style.position).toBe('sticky')
    expect(header('extra').getAttribute('data-iris-table-pinned')).toBeNull()
  })

  it('columnPinMenu off (default): right-clicking a header opens nothing', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    fireEvent.contextMenu(header('name'), { clientX: 120, clientY: 40 })
    expect(menu()).toBeNull()
    expect(menuItems()).toHaveLength(0)
  })

  it('is independent of contextMenu: works with NO contextMenu configured', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" columnPinMenu />)
    openHeaderMenu('name')
    expect(menu()).not.toBeNull()
    expect(menuItems().map((i) => i.textContent)).toEqual(['Pin left'])
  })

  it('is independent of contextMenu: contextMenu alone never opens the pin menu', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        contextMenu={{ items: () => [{ key: 'edit', label: 'Edit row' }], onSelect: vi.fn() }}
      />,
    )
    fireEvent.contextMenu(header('name'), { clientX: 120, clientY: 40 })
    expect(menu()).toBeNull()
    // The cell menu still works on body cells.
    fireEvent.contextMenu(cell(1, 'name'), { clientX: 100, clientY: 80 })
    expect(menuItems().map((i) => i.textContent)).toEqual(['Edit row', 'Copy value', 'Clear cell'])
  })

  it('the two menus are separate instances — opening one closes the other', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        columnPinMenu
        contextMenu={{ items: () => [{ key: 'edit', label: 'Edit row' }], onSelect: vi.fn() }}
      />,
    )
    fireEvent.contextMenu(cell(1, 'name'), { clientX: 100, clientY: 80 })
    expect(menuItems().map((i) => i.textContent)).toEqual(['Edit row', 'Copy value', 'Clear cell'])
    // Header right-click swaps to the pin menu — exactly one instance open.
    openHeaderMenu('name')
    expect(document.querySelectorAll('[data-iris-table-context-menu]')).toHaveLength(1)
    expect(menuItems().map((i) => i.textContent)).toEqual(['Pin left'])
    // And back: a body right-click swaps to the cell menu.
    fireEvent.contextMenu(cell(1, 'age'), { clientX: 100, clientY: 80 })
    expect(document.querySelectorAll('[data-iris-table-context-menu]')).toHaveLength(1)
    expect(menuItems().map((i) => i.textContent)).toEqual(['Edit row', 'Copy value', 'Clear cell'])
  })

  it('right-clicking a sortable header does not sort / fire onHeaderClick', () => {
    const sortableCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', sortable: true },
      { key: 'age', title: 'Age' },
    ]
    const onHeaderClick = vi.fn()
    render(
      <IrisTable
        columns={sortableCols}
        data={rows}
        rowKey="id"
        columnPinMenu
        onHeaderClick={onHeaderClick}
      />,
    )
    openHeaderMenu('name')
    expect(menu()).not.toBeNull()
    expect(onHeaderClick).not.toHaveBeenCalled()
    expect(header('name').getAttribute('aria-sort')).toBe('none')
  })

  it('grouped headers: leaf cells open the pin menu, group cells do not', () => {
    const groupedCols: IrisTableColumn<Row>[] = [
      {
        key: 'person',
        title: 'Person',
        children: [
          { key: 'name', title: 'Name' },
          { key: 'age', title: 'Age' },
        ],
      },
      { key: 'extra', title: 'Extra' },
    ]
    render(<IrisTable columns={groupedCols} data={rows} rowKey="id" columnPinMenu />)
    // Group header (non-leaf) right-click opens nothing.
    fireEvent.contextMenu(header('person'), { clientX: 120, clientY: 40 })
    expect(menu()).toBeNull()
    // Leaf header right-click opens the pin menu and pins the leaf.
    openHeaderMenu('name')
    expect(menuItems().map((i) => i.textContent)).toEqual(['Pin left'])
    fireEvent.click(menuItem('__iris-pin-left')!)
    expect(header('name').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header('name').style.position).toBe('sticky')
  })

  it('labels come from i18n (zh overrides via provider)', () => {
    const zh = { 'table.pinLeft': '固定左', 'table.unpin': '取消固定' }
    const first = render(
      <IrisI18nProvider messages={zh}>
        <IrisTable columns={cols} data={rows} rowKey="id" columnPinMenu />
      </IrisI18nProvider>,
    )
    openHeaderMenu('name')
    expect(menuItems().map((i) => i.textContent)).toEqual(['固定左'])
    first.unmount()
    const pinnedCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', pinned: 'left' },
      { key: 'age', title: 'Age' },
    ]
    render(
      <IrisI18nProvider messages={zh}>
        <IrisTable columns={pinnedCols} data={rows} rowKey="id" columnPinMenu />
      </IrisI18nProvider>,
    )
    openHeaderMenu('name')
    expect(menuItems().map((i) => i.textContent)).toEqual(['取消固定'])
  })

  it('a menu-pinned column stays sticky under column virtualization', () => {
    const wideCols: IrisTableColumn<Record<string, unknown>>[] = Array.from(
      { length: 10 },
      (_, i) => ({ key: `c${i}`, title: `C${i}`, width: 120 }),
    )
    const wideRows: Record<string, unknown>[] = [
      Object.fromEntries([['id', 1], ...wideCols.map((c) => [c.key, `${c.key}-v`])]),
    ]
    render(<IrisTable columns={wideCols} data={wideRows} columnVirtualization columnPinMenu />)
    const c0 = header('c0')
    expect(c0).not.toBeNull()
    fireEvent.contextMenu(c0, { clientX: 120, clientY: 40 })
    fireEvent.click(menuItem('__iris-pin-left')!)
    expect(c0.getAttribute('data-iris-table-pinned')).toBe('left')
    expect(c0.style.position).toBe('sticky')
    // The virtualized window is unaffected for the rest.
    expect(document.querySelectorAll('[data-iris-table-header]').length).toBeLessThan(10)
  })
})
