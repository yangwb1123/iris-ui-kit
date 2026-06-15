import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { createProTableStore, type ProTableColumn } from '../core'
import { IrisProTable } from './index'

afterEach(cleanup)

// jsdom drops clientX/clientY/pointerType from synthetic PointerEvents, so we
// dispatch a MouseEvent (which carries clientX/Y in jsdom) typed as a pointer
// event with pointerType defined — the same shape the component reads.
function pointer(
  el: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  opts: { clientX: number; clientY: number; pointerType?: string; pointerId?: number },
) {
  const ev = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: opts.clientX,
    clientY: opts.clientY,
  })
  Object.defineProperty(ev, 'pointerType', { value: opts.pointerType ?? 'touch' })
  Object.defineProperty(ev, 'pointerId', { value: opts.pointerId ?? 1 })
  fireEvent(el, ev)
}

const stubRect = (el: Element, left: number) =>
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left,
    top: 0,
    width: 80,
    height: 32,
    right: left + 80,
    bottom: 32,
    x: left,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect)

interface User extends Record<string, unknown> {
  id: number
  name: string
  age: number
}
const columns: ProTableColumn<User>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true },
]
const data: User[] = [
  { id: 1, name: 'Charlie', age: 30 },
  { id: 2, name: 'Alice', age: 25 },
]

describe('IrisProTable (solid)', () => {
  it('renders headers and rows', () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    const { container, getByText } = render(() => <IrisProTable store={store} />)
    expect(container.querySelector('[data-iris-pro-table]')).toBeTruthy()
    expect(getByText('Charlie')).toBeTruthy()
  })

  it('sorts on header click', () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    const { getByText } = render(() => <IrisProTable store={store} />)
    fireEvent.click(getByText(/Age/))
    expect(store.getState().sort).toEqual({ key: 'age', direction: 'asc' })
  })

  it('reorderColumns moves column from position A to B', () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    // Initial order: name (0), age (1)
    expect(store.visibleColumns().map((c) => c.key)).toEqual(['name', 'age'])
    store.reorderColumns('age', 'name')
    // After: age (0), name (1)
    expect(store.visibleColumns().map((c) => c.key)).toEqual(['age', 'name'])
  })

  it('touch: pointer-drag a header onto another header calls reorderColumns', () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    const { container } = render(() => <IrisProTable store={store} columnReorder />)
    const nameTh = container.querySelector('[data-iris-col-key="name"]')!
    stubRect(container.querySelector('[data-iris-col-key="name"]')!, 0)
    stubRect(container.querySelector('[data-iris-col-key="age"]')!, 200)

    // Drag the 'name' header over the 'age' header → name moves after age.
    pointer(nameTh, 'pointerdown', { clientX: 20, clientY: 10 })
    pointer(nameTh, 'pointermove', { clientX: 220, clientY: 10 })
    pointer(nameTh, 'pointerup', { clientX: 220, clientY: 10 })

    expect(store.visibleColumns().map((c) => c.key)).toEqual(['age', 'name'])
  })

  it('touch: a bare header tap does NOT reorder (overId stays null)', () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    const { container } = render(() => <IrisProTable store={store} columnReorder />)
    const nameTh = container.querySelector('[data-iris-col-key="name"]')!
    stubRect(nameTh, 0)
    stubRect(container.querySelector('[data-iris-col-key="age"]')!, 200)

    // down → up with no move: no reorder.
    pointer(nameTh, 'pointerdown', { clientX: 20, clientY: 10 })
    pointer(nameTh, 'pointerup', { clientX: 20, clientY: 10 })

    expect(store.visibleColumns().map((c) => c.key)).toEqual(['name', 'age'])
  })

  it('touch: a tap (no movement past threshold) does NOT move/reorder', () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    const { container } = render(() => <IrisProTable store={store} columnReorder />)
    const nameTh = container.querySelector('[data-iris-col-key="name"]')!
    stubRect(nameTh, 0)
    stubRect(container.querySelector('[data-iris-col-key="age"]')!, 200)

    // down → sub-threshold move (+2px) → up: stays pending, never promotes → no reorder.
    pointer(nameTh, 'pointerdown', { clientX: 20, clientY: 10 })
    pointer(nameTh, 'pointermove', { clientX: 22, clientY: 10 })
    pointer(nameTh, 'pointerup', { clientX: 22, clientY: 10 })

    expect(store.visibleColumns().map((c) => c.key)).toEqual(['name', 'age'])
  })

  it('touch: mouse pointers do NOT trigger the pointer reorder path', () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    const { container } = render(() => <IrisProTable store={store} columnReorder />)
    const nameTh = container.querySelector('[data-iris-col-key="name"]')!
    stubRect(nameTh, 0)
    stubRect(container.querySelector('[data-iris-col-key="age"]')!, 200)

    pointer(nameTh, 'pointerdown', { clientX: 20, clientY: 10, pointerType: 'mouse' })
    pointer(nameTh, 'pointermove', { clientX: 220, clientY: 10, pointerType: 'mouse' })
    pointer(nameTh, 'pointerup', { clientX: 220, clientY: 10, pointerType: 'mouse' })

    expect(store.visibleColumns().map((c) => c.key)).toEqual(['name', 'age'])
  })

  it('shows a filter chip when a filter is active', () => {
    const store = createProTableStore<User>({
      columns: [{ key: 'name', title: 'Name', filterable: true }, columns[1]!],
      rowKey: 'id',
      data,
    })
    store.setFilter('name', 'Alice')
    const { container } = render(() => <IrisProTable store={store} />)
    const bar = container.querySelector('[data-iris-filter-chips]')
    expect(bar).toBeTruthy()
    expect(bar!.textContent).toContain('Name')
    expect(bar!.textContent).toContain('Alice')
  })

  it('clicking × on a chip clears that filter', () => {
    const store = createProTableStore<User>({
      columns: [{ key: 'name', title: 'Name', filterable: true }, columns[1]!],
      rowKey: 'id',
      data,
    })
    store.setFilter('name', 'Alice')
    const { container } = render(() => <IrisProTable store={store} />)
    const clearBtn = container.querySelector(
      '[aria-label="Clear filter Name"]',
    ) as HTMLButtonElement
    expect(clearBtn).toBeTruthy()
    fireEvent.click(clearBtn)
    expect(store.getState().filters['name'] ?? '').toBe('')
  })

  it('exposes aria-sort and keyboard-operates sortable headers', () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    const { getByText } = render(() => <IrisProTable store={store} />)
    const ageHeader = getByText(/Age/).closest('th') as HTMLTableCellElement
    expect(ageHeader.getAttribute('scope')).toBe('col')
    expect(ageHeader.getAttribute('aria-sort')).toBe('none')
    expect(ageHeader.tabIndex).toBe(0)
    fireEvent.keyDown(ageHeader, { key: 'Enter' })
    expect(store.getState().sort).toEqual({ key: 'age', direction: 'asc' })
    expect(ageHeader.getAttribute('aria-sort')).toBe('ascending')
  })

  it('virtualized: renders only a small window of rows for a huge dataset', () => {
    const bigData: User[] = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `User ${i}`,
      age: 20 + (i % 50),
    }))
    const store = createProTableStore<User>({
      columns,
      rowKey: 'id',
      data: bigData,
      pageSize: 1000, // whole dataset on one page so virtualization windows it
    })
    const { container } = render(() => (
      <IrisProTable store={store} virtualized maxHeight={400} rowHeight={40} />
    ))

    // Scroll container exists with the configured viewport height.
    const scroll = container.querySelector('[data-iris-pro-table-scroll]') as HTMLElement
    expect(scroll).toBeTruthy()

    // Data <tr> = body rows excluding header rows and the spacer rows (which use
    // colSpan and are aria-hidden). Only the visible window should be rendered.
    const dataRows = () =>
      Array.from(container.querySelectorAll('tbody tr')).filter(
        (tr) => tr.getAttribute('aria-hidden') !== 'true',
      )

    expect(dataRows().length).toBeLessThan(30)
    expect(dataRows().length).toBeGreaterThan(0)
    // First visible row is row 0.
    expect(dataRows()[0]!.textContent).toContain('User 0')
    // Window 'User 0' is rendered; a row far down the list is NOT.
    expect(container.textContent).toContain('User 0')
    expect(container.textContent).not.toContain('User 900')

    // Spacer rows preserve the scrollbar height: bottom spacer present, big.
    const spacers = Array.from(container.querySelectorAll('tbody tr[aria-hidden="true"]'))
    expect(spacers.length).toBeGreaterThan(0)

    // Scroll far down → the rendered window changes to later rows.
    // jsdom doesn't lay out / scroll, so set scrollTop explicitly before firing.
    Object.defineProperty(scroll, 'scrollTop', { configurable: true, value: 38_000 })
    fireEvent.scroll(scroll)
    const after = dataRows()
    expect(after[0]!.textContent).not.toContain('User 0')
    expect(after[0]!.textContent).toMatch(/User 9\d\d/)
    expect(container.textContent).not.toContain('User 0')
  })

  it('virtualized=false: still renders ALL rows (behavior unchanged)', () => {
    const bigData: User[] = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      name: `User ${i}`,
      age: 20 + i,
    }))
    const store = createProTableStore<User>({
      columns,
      rowKey: 'id',
      data: bigData,
      pageSize: 50,
    })
    const { container } = render(() => <IrisProTable store={store} />)
    // No scroll container, no spacer rows; every row present.
    expect(container.querySelector('[data-iris-pro-table-scroll]')).toBeNull()
    expect(container.querySelector('tbody tr[aria-hidden="true"]')).toBeNull()
    const dataRows = container.querySelectorAll('tbody tr')
    expect(dataRows.length).toBe(50)
    expect(container.textContent).toContain('User 0')
    expect(container.textContent).toContain('User 49')
  })

  it('localizes UI strings via the labels prop (defaults to English)', () => {
    const store = createProTableStore<User>({
      columns: [{ ...columns[0]!, filterable: true }, columns[1]!],
      rowKey: 'id',
      data,
    })
    const { container } = render(() => (
      <IrisProTable
        store={store}
        labels={{
          selectAll: 'Tout sélectionner',
          filterColumn: 'Filtrer {title}',
          selectRow: 'Ligne {key}',
          prev: 'Précédent',
          next: 'Suivant',
        }}
      />
    ))
    expect(container.querySelector('[aria-label="Tout sélectionner"]')).toBeTruthy()
    expect(container.querySelector('[aria-label="Filtrer Name"]')).toBeTruthy()
    expect(container.querySelector('[aria-label="Ligne 1"]')).toBeTruthy()
    expect(container.textContent).toContain('Précédent')
    expect(container.textContent).toContain('Suivant')
  })
})
