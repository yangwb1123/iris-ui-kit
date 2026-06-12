import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createProTableStore, type ProTableColumn } from '../core'
import { IrisProTable } from './index'

// jsdom drops clientX/clientY/pointerType from synthetic PointerEvents, so we
// dispatch a MouseEvent (which carries clientX/Y in jsdom) typed as a pointer
// event with pointerType defined — the same shape the component reads.
// (@testing-library/vue is not a dep here, so we dispatch on the DOM node.)
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
  el.dispatchEvent(ev)
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

describe('IrisProTable (vue)', () => {
  it('renders headers and rows', () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    const wrapper = mount(IrisProTable, { props: { store } })
    expect(wrapper.element.querySelector('[data-iris-pro-table]') ?? wrapper.element).toBeTruthy()
    expect(wrapper.text()).toContain('Name')
    expect(wrapper.text()).toContain('Charlie')
    wrapper.unmount()
  })

  it('sorts on header click', async () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    const wrapper = mount(IrisProTable, { props: { store } })
    const ageHeader = wrapper.findAll('th').find((th) => th.text().includes('Age'))
    await ageHeader?.trigger('click')
    expect(store.getState().sort).toEqual({ key: 'age', direction: 'asc' })
    wrapper.unmount()
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
    const wrapper = mount(IrisProTable, { props: { store, columnReorder: true } })
    const el = wrapper.element as HTMLElement
    const nameTh = el.querySelector('[data-iris-col-key="name"]')!
    stubRect(el.querySelector('[data-iris-col-key="name"]')!, 0)
    stubRect(el.querySelector('[data-iris-col-key="age"]')!, 200)

    // Drag the 'name' header over the 'age' header → name moves after age.
    pointer(nameTh, 'pointerdown', { clientX: 20, clientY: 10 })
    pointer(nameTh, 'pointermove', { clientX: 220, clientY: 10 })
    pointer(nameTh, 'pointerup', { clientX: 220, clientY: 10 })

    expect(store.visibleColumns().map((c) => c.key)).toEqual(['age', 'name'])
    wrapper.unmount()
  })

  it('touch: a bare header tap does NOT reorder (overId stays null)', () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    const wrapper = mount(IrisProTable, { props: { store, columnReorder: true } })
    const el = wrapper.element as HTMLElement
    const nameTh = el.querySelector('[data-iris-col-key="name"]')!
    stubRect(nameTh, 0)
    stubRect(el.querySelector('[data-iris-col-key="age"]')!, 200)

    // down → up with no move: no reorder.
    pointer(nameTh, 'pointerdown', { clientX: 20, clientY: 10 })
    pointer(nameTh, 'pointerup', { clientX: 20, clientY: 10 })

    expect(store.visibleColumns().map((c) => c.key)).toEqual(['name', 'age'])
    wrapper.unmount()
  })

  it('touch: mouse pointers do NOT trigger the pointer reorder path', () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    const wrapper = mount(IrisProTable, { props: { store, columnReorder: true } })
    const el = wrapper.element as HTMLElement
    const nameTh = el.querySelector('[data-iris-col-key="name"]')!
    stubRect(nameTh, 0)
    stubRect(el.querySelector('[data-iris-col-key="age"]')!, 200)

    pointer(nameTh, 'pointerdown', { clientX: 20, clientY: 10, pointerType: 'mouse' })
    pointer(nameTh, 'pointermove', { clientX: 220, clientY: 10, pointerType: 'mouse' })
    pointer(nameTh, 'pointerup', { clientX: 220, clientY: 10, pointerType: 'mouse' })

    expect(store.visibleColumns().map((c) => c.key)).toEqual(['name', 'age'])
    wrapper.unmount()
  })

  it('shows a filter chip when a filter is active', async () => {
    const store = createProTableStore<User>({
      columns: [{ key: 'name', title: 'Name', filterable: true }, columns[1]!],
      rowKey: 'id',
      data,
    })
    store.setFilter('name', 'Alice')
    const wrapper = mount(IrisProTable, { props: { store } })
    await wrapper.vm.$nextTick()
    const bar = wrapper.element.querySelector('[data-iris-filter-chips]')
    expect(bar).toBeTruthy()
    expect(bar!.textContent).toContain('Name')
    expect(bar!.textContent).toContain('Alice')
    wrapper.unmount()
  })

  it('clicking × on a chip clears that filter', async () => {
    const store = createProTableStore<User>({
      columns: [{ key: 'name', title: 'Name', filterable: true }, columns[1]!],
      rowKey: 'id',
      data,
    })
    store.setFilter('name', 'Alice')
    const wrapper = mount(IrisProTable, { props: { store } })
    await wrapper.vm.$nextTick()
    const clearBtn = wrapper.element.querySelector(
      '[aria-label="Clear filter Name"]',
    ) as HTMLButtonElement
    expect(clearBtn).toBeTruthy()
    clearBtn.click()
    expect(store.getState().filters['name'] ?? '').toBe('')
    wrapper.unmount()
  })

  it('exposes aria-sort and keyboard sorting on sortable headers', async () => {
    const store = createProTableStore<User>({ columns, rowKey: 'id', data })
    const wrapper = mount(IrisProTable, { props: { store } })
    const ageHeader = wrapper.findAll('th').find((th) => th.text().includes('Age'))!
    // sortable but unsorted → 'none', scope=col, keyboard-focusable
    expect(ageHeader.attributes('aria-sort')).toBe('none')
    expect(ageHeader.attributes('scope')).toBe('col')
    expect(ageHeader.attributes('tabindex')).toBe('0')
    // Enter activates the sort
    await ageHeader.trigger('keydown', { key: 'Enter' })
    expect(store.getState().sort).toEqual({ key: 'age', direction: 'asc' })
    expect(
      wrapper
        .findAll('th')
        .find((th) => th.text().includes('Age'))!
        .attributes('aria-sort'),
    ).toBe('ascending')
    wrapper.unmount()
  })

  it('localizes UI strings via the labels prop (defaults to English)', () => {
    const store = createProTableStore<User>({
      columns: [{ ...columns[0]!, filterable: true }, columns[1]!],
      rowKey: 'id',
      data,
    })
    const wrapper = mount(IrisProTable, {
      props: {
        store,
        labels: {
          selectAll: 'Tout sélectionner',
          filterColumn: 'Filtrer {title}',
          selectRow: 'Ligne {key}',
          prev: 'Précédent',
          next: 'Suivant',
        },
      },
    })
    expect(wrapper.element.querySelector('[aria-label="Tout sélectionner"]')).toBeTruthy()
    expect(wrapper.element.querySelector('[aria-label="Filtrer Name"]')).toBeTruthy()
    expect(wrapper.element.querySelector('[aria-label="Ligne 1"]')).toBeTruthy()
    expect(wrapper.text()).toContain('Précédent')
    expect(wrapper.text()).toContain('Suivant')
    wrapper.unmount()
  })
})
