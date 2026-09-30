import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import IrisTable from './IrisTable.svelte'

afterEach(cleanup)

const columns = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age' },
]

const data = [
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 25 },
  { id: 3, name: 'Charlie', age: 35 },
]

describe('IrisTable controlled selection', () => {
  const bodyRows = (container: HTMLElement) =>
    container.querySelectorAll('[data-iris-table-body] [data-iris-table-row]')
  const rowCheckbox = (container: HTMLElement, i: number) =>
    bodyRows(container)[i].querySelector('input[type="checkbox"]') as HTMLInputElement

  // Controlled selection renders from the prop (reject → no flip; accept → flips).
  // The row's data-state="selected" is the reactive selection indicator (the
  // Svelte analogue of React's aria-selected) — the native checkbox .checked
  // DOM property is not a reliable post-click signal under jsdom, so the row
  // attribute is asserted for the flip / no-flip behavior.
  it('controlled selection renders from the prop, not optimistically', async () => {
    const onUpdateSelection = vi.fn()
    const { container, rerender } = render(IrisTable, {
      props: {
        columns,
        data,
        rowKey: 'id',
        selectable: 'multi',
        selection: [1],
        onUpdateSelection,
      },
    })
    expect(rowCheckbox(container, 0).checked).toBe(true)
    expect(rowCheckbox(container, 1).checked).toBe(false)
    expect(bodyRows(container)[0].getAttribute('data-state')).toBe('selected')
    expect(bodyRows(container)[1].getAttribute('data-state')).toBeNull()

    // Toggle row 2: onUpdateSelection fires, but a controlled parent that does
    // NOT write `selection` back means the row must NOT flip.
    await fireEvent.click(rowCheckbox(container, 1))
    flushSync()
    expect(onUpdateSelection).toHaveBeenCalledWith([1, 2])
    expect(bodyRows(container)[0].getAttribute('data-state')).toBe('selected')
    expect(bodyRows(container)[1].getAttribute('data-state')).toBeNull()

    // Parent accepts: write the new selection back → now it flips.
    await rerender({
      columns,
      data,
      rowKey: 'id',
      selectable: 'multi',
      selection: [1, 2],
      onUpdateSelection,
    })
    flushSync()
    expect(bodyRows(container)[1].getAttribute('data-state')).toBe('selected')
    expect(rowCheckbox(container, 1).checked).toBe(true)
  })

  it('restores the first controlled selection snapshot after a silent handoff detour', async () => {
    const onUpdateSelection = vi.fn()
    const { container, rerender } = render(IrisTable, {
      props: {
        columns,
        data,
        rowKey: 'id',
        selectable: 'multi',
        selection: [1],
        onUpdateSelection,
      },
    })
    expect(bodyRows(container)[0].getAttribute('data-state')).toBe('selected')
    expect(bodyRows(container)[1].getAttribute('data-state')).toBeNull()

    await rerender({
      columns,
      data,
      rowKey: 'id',
      selectable: 'multi',
      selection: undefined,
      onUpdateSelection,
    })
    flushSync()
    expect(bodyRows(container)[0].getAttribute('data-state')).toBe('selected')
    expect(bodyRows(container)[1].getAttribute('data-state')).toBeNull()
    expect(onUpdateSelection).not.toHaveBeenCalled()

    await rerender({
      columns,
      data,
      rowKey: 'id',
      selectable: 'multi',
      selection: [2],
      onUpdateSelection,
    })
    flushSync()
    expect(bodyRows(container)[0].getAttribute('data-state')).toBeNull()
    expect(bodyRows(container)[1].getAttribute('data-state')).toBe('selected')
    expect(onUpdateSelection).not.toHaveBeenCalled()

    await rerender({
      columns,
      data,
      rowKey: 'id',
      selectable: 'multi',
      selection: undefined,
      onUpdateSelection,
    })
    flushSync()
    expect(bodyRows(container)[0].getAttribute('data-state')).toBe('selected')
    expect(bodyRows(container)[1].getAttribute('data-state')).toBeNull()
    expect(onUpdateSelection).not.toHaveBeenCalled()

    await fireEvent.click(rowCheckbox(container, 1))
    flushSync()
    expect(onUpdateSelection).toHaveBeenLastCalledWith([1, 2])
  })

  // The emitted next value is computed against the prop, not a prior optimistic
  // value: a rejected toggle followed by another toggle still bases off the prop.
  it('re-bases the emitted value on the prop before each toggle', async () => {
    const onUpdateSelection = vi.fn()
    const { container } = render(IrisTable, {
      props: {
        columns,
        data,
        rowKey: 'id',
        selectable: 'multi',
        selection: [1],
        onUpdateSelection,
      },
    })
    // First toggle of row 2 emits [1, 2].
    await fireEvent.click(rowCheckbox(container, 1))
    flushSync()
    expect(onUpdateSelection).toHaveBeenLastCalledWith([1, 2])
    // Parent rejected (prop still [1]); toggling row 3 must emit [1, 3] — NOT
    // [1, 2, 3] — because the model is re-based on the prop before the toggle.
    await fireEvent.click(rowCheckbox(container, 2))
    flushSync()
    expect(onUpdateSelection).toHaveBeenLastCalledWith([1, 3])
  })
})
