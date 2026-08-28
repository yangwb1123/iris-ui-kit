import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { IrisI18nProvider } from '../../i18n'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn } from './types'

afterEach(cleanup)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Alexandra', age: 25 },
  { id: 2, name: 'Bob', age: 32 },
]
const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

function header(key: string): HTMLElement {
  return document.querySelector(`[data-iris-table-header="${key}"]`) as HTMLElement
}
function bodyCell(rowIndex: number, key: string): HTMLElement {
  const rows = document.querySelectorAll<HTMLElement>('[data-iris-table-row=""]')
  return rows[rowIndex]!.querySelector(`[data-iris-table-cell="${key}"]`) as HTMLElement
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

const pinKey = '__iris-pin-left'
const unpinKey = '__iris-unpin'

describe('Solid IrisTable columnPinMenu', () => {
  it('pins an unpinned leaf through the Core channel and updates the uncontrolled view', () => {
    const onPinned = vi.fn()
    render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnPinMenu
        onColumnPinnedChange={onPinned}
      />
    ))

    openHeaderMenu('name')
    expect(menuItems().map((item) => item.textContent)).toEqual(['Pin left'])
    fireEvent.click(menuItem(pinKey)!)

    expect(onPinned).toHaveBeenCalledWith('name', 'left')
    expect(header('name').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header('name').style.position).toBe('sticky')
    expect(bodyCell(0, 'name').getAttribute('data-iris-table-pinned')).toBe('left')
  })

  it('uses Unpin for left and right declarations and updates the internal fallback', () => {
    const pinned: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', pinned: 'left' },
      { key: 'age', title: 'Age', pinned: 'right' },
    ]
    const onPinned = vi.fn()
    render(() => (
      <IrisTable
        columns={pinned}
        data={rows}
        rowKey="id"
        columnPinMenu
        onColumnPinnedChange={onPinned}
      />
    ))

    openHeaderMenu('name')
    expect(menuItems().map((item) => item.textContent)).toEqual(['Unpin'])
    fireEvent.click(menuItem(unpinKey)!)
    expect(onPinned).toHaveBeenCalledWith('name', null)
    expect(header('name').getAttribute('data-iris-table-pinned')).toBeNull()

    openHeaderMenu('age')
    expect(menuItems().map((item) => item.textContent)).toEqual(['Unpin'])
    fireEvent.click(menuItem(unpinKey)!)
    expect(onPinned).toHaveBeenCalledWith('age', null)
    expect(header('age').getAttribute('data-iris-table-pinned')).toBeNull()
  })

  it('keeps controlled rendering non-optimistic and follows a parent that accepts the proposal', async () => {
    const onPinned = vi.fn()
    render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnPinMenu
        pinnedColumns={{}}
        onColumnPinnedChange={onPinned}
      />
    ))
    openHeaderMenu('name')
    fireEvent.click(menuItem(pinKey)!)
    expect(onPinned).toHaveBeenCalledWith('name', 'left')
    expect(header('name').getAttribute('data-iris-table-pinned')).toBeNull()

    cleanup()
    const [pins, setPins] = createSignal<Record<string, 'left' | 'right' | null>>({})
    render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnPinMenu
        pinnedColumns={pins()}
        onColumnPinnedChange={(key, side) => setPins((current) => ({ ...current, [key]: side }))}
      />
    ))
    openHeaderMenu('name')
    fireEvent.click(menuItem(pinKey)!)
    await waitFor(() => expect(header('name').getAttribute('data-iris-table-pinned')).toBe('left'))
    openHeaderMenu('name')
    fireEvent.click(menuItem(unpinKey)!)
    await waitFor(() => expect(header('name').getAttribute('data-iris-table-pinned')).toBeNull())
  })

  it('retains static declarations for absent controlled keys and honors explicit null', async () => {
    const pinned: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', pinned: 'left' },
      { key: 'age', title: 'Age' },
    ]
    const [pins, setPins] = createSignal<Record<string, 'left' | 'right' | null>>({})
    const { container } = render(() => (
      <IrisTable columns={pinned} data={rows} rowKey="id" pinnedColumns={pins()} columnPinMenu />
    ))
    expect(header('name').getAttribute('data-iris-table-pinned')).toBe('left')
    openHeaderMenu('name')
    expect(menuItems().map((item) => item.textContent)).toEqual(['Unpin'])

    setPins({ name: null })
    await waitFor(() =>
      expect(
        container
          .querySelector('[data-iris-table-header="name"]')
          ?.getAttribute('data-iris-table-pinned'),
      ).toBeNull(),
    )
  })

  it('follows a replaced static pin declaration when the menu is off', async () => {
    const [currentColumns, setColumns] = createSignal<IrisTableColumn<Row>[]>([
      { key: 'name', title: 'Name', pinned: 'left' },
      { key: 'age', title: 'Age' },
    ])
    render(() => <IrisTable columns={currentColumns()} data={rows} rowKey="id" />)
    expect(header('name').getAttribute('data-iris-table-pinned')).toBe('left')

    setColumns([
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age' },
    ])
    await waitFor(() => expect(header('name').getAttribute('data-iris-table-pinned')).toBeNull())
  })

  it('does not mutate frozen caller columns and has no menu when the prop is off', () => {
    const frozen = Object.freeze([
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age' },
    ]) as unknown as IrisTableColumn<Row>[]
    render(() => <IrisTable columns={frozen} data={rows} rowKey="id" />)
    fireEvent.contextMenu(header('name'), { clientX: 20, clientY: 20 })
    expect(menu()).toBeNull()
    expect(frozen[0]!.pinned).toBeUndefined()
  })

  it('uses the existing floating menu dismissal and cursor positioning behavior', async () => {
    render(() => <IrisTable columns={columns} data={rows} rowKey="id" columnPinMenu />)
    openHeaderMenu('name')
    const surface = menu()!
    expect(surface.getAttribute('role')).toBe('menu')
    expect(menuItem(pinKey)?.getAttribute('role')).toBe('menuitem')
    expect((menuItem(pinKey) as HTMLButtonElement).type).toBe('button')
    await waitFor(() => expect(surface.style.transform).toContain('translate3d(120px, 40px'))

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(menu()).toBeNull()
    openHeaderMenu('name')
    fireEvent.pointerDown(document.body)
    expect(menu()).toBeNull()
    openHeaderMenu('name')
    document.dispatchEvent(new Event('scroll'))
    expect(menu()).toBeNull()
  })

  it('is independent from contextMenu and swaps to keep one floating instance', () => {
    render(() => <IrisTable columns={columns} data={rows} rowKey="id" columnPinMenu />)
    openHeaderMenu('name')
    expect(menuItems().map((item) => item.textContent)).toEqual(['Pin left'])

    cleanup()
    const onSelect = vi.fn()
    render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        contextMenu={{
          items: () => [{ key: 'edit', label: 'Edit' }],
          onSelect,
        }}
      />
    ))
    fireEvent.contextMenu(header('name'), { clientX: 20, clientY: 20 })
    expect(menu()).toBeNull()
    fireEvent.contextMenu(bodyCell(0, 'name'), { clientX: 20, clientY: 20 })
    expect(menuItems().map((item) => item.textContent)).toEqual(['Edit'])

    cleanup()
    render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnPinMenu
        contextMenu={{ items: () => [{ key: 'edit', label: 'Edit' }], onSelect: vi.fn() }}
      />
    ))
    fireEvent.contextMenu(bodyCell(0, 'name'), { clientX: 20, clientY: 20 })
    openHeaderMenu('name')
    expect(document.querySelectorAll('[data-iris-table-context-menu]')).toHaveLength(1)
    expect(menuItems().map((item) => item.textContent)).toEqual(['Pin left'])
    fireEvent.contextMenu(bodyCell(0, 'age'), { clientX: 20, clientY: 20 })
    expect(document.querySelectorAll('[data-iris-table-context-menu]')).toHaveLength(1)
    expect(menuItems().map((item) => item.textContent)).toEqual(['Edit'])
  })

  it('opens only for grouped leaf headers and pins the grouped leaf', () => {
    const grouped: IrisTableColumn<Row>[] = [
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
    render(() => <IrisTable columns={grouped} data={rows} rowKey="id" columnPinMenu />)
    fireEvent.contextMenu(header('person'), { clientX: 20, clientY: 20 })
    expect(menu()).toBeNull()
    openHeaderMenu('name')
    fireEvent.click(menuItem(pinKey)!)
    expect(header('name').getAttribute('data-iris-table-pinned')).toBe('left')
    expect(header('person').getAttribute('data-iris-table-pinned')).toBeNull()
    expect(bodyCell(0, 'name').getAttribute('data-iris-table-pinned')).toBe('left')
  })

  it('uses core i18n labels for both menu states', () => {
    const messages = { 'table.pinLeft': '固定左', 'table.unpin': '取消固定' }
    render(() => (
      <IrisI18nProvider messages={messages}>
        <IrisTable columns={columns} data={rows} rowKey="id" columnPinMenu />
      </IrisI18nProvider>
    ))
    openHeaderMenu('name')
    expect(menuItems().map((item) => item.textContent)).toEqual(['固定左'])
    fireEvent.click(menuItem(pinKey)!)
    openHeaderMenu('name')
    expect(menuItems().map((item) => item.textContent)).toEqual(['取消固定'])
  })

  it('guards a stale menu action as a no-op after a controlled parent change', async () => {
    const [pins, setPins] = createSignal<Record<string, 'left' | 'right' | null>>({})
    const onPinned = vi.fn()
    render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnPinMenu
        pinnedColumns={pins()}
        onColumnPinnedChange={onPinned}
      />
    ))
    openHeaderMenu('name')
    const stalePinItem = menuItem(pinKey)!
    setPins({ name: 'right' })
    await waitFor(() => expect(menuItem(unpinKey)).not.toBeNull())
    fireEvent.click(stalePinItem)
    expect(onPinned).not.toHaveBeenCalled()
  })

  it('keeps menu coordinates and pin projection compatible with column virtualization', () => {
    const wideColumns = Array.from({ length: 10 }, (_, index) => ({
      key: `c${index}`,
      title: `C${index}`,
      width: 120,
    })) as IrisTableColumn<Record<string, unknown>>[]
    const wideRows = [
      Object.fromEntries([['id', 1], ...wideColumns.map((column) => [column.key, column.key])]),
    ]
    render(() => (
      <IrisTable columns={wideColumns} data={wideRows} columnVirtualization columnPinMenu />
    ))
    const first = header('c0')
    fireEvent.contextMenu(first, { clientX: 120, clientY: 40 })
    fireEvent.click(menuItem(pinKey)!)
    expect(first.getAttribute('data-iris-table-pinned')).toBe('left')
    expect(first.style.position).toBe('sticky')
    expect(document.querySelectorAll('[data-iris-table-header]').length).toBeLessThan(10)
  })
})
