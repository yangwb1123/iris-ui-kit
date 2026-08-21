import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IrisTable, type IrisTableHandle, type IrisTableTooltipConfig } from '../index'
import type { IrisTableColumn } from '../types'

afterEach(cleanup)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

const rows: Row[] = [
  { id: 1, name: 'Alice', age: 25 },
  { id: 2, name: 'Bob', age: 32 },
  { id: 3, name: 'Charlie', age: 28 },
  { id: 4, name: 'Diana', age: 40 },
]

// ── Batch G LOW fix: selectAll unions with the existing selection ─────────
describe('IrisTable selectAll union (batch G fix F1)', () => {
  it('unions page keys with the existing selection and respects checkMethod', () => {
    const ref: { current: IrisTableHandle<Row> | null } = { current: null }
    const onSelection = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        selectable="multi"
        tableRef={ref}
        onSelectionChange={onSelection}
        // Only age < 30 rows are selectable: ids 1 + 3.
        checkMethod={(r) => (r.age as number) < 30}
        // A key that is NOT on the current page (e.g. selected on an earlier
        // proxy page) — the union must keep it, the old replace would drop it.
        defaultSelection={[9]}
      />,
    )
    act(() => ref.current!.selectAll())
    expect(onSelection).toHaveBeenLastCalledWith([9, 1, 3])
    // Idempotent: a second selectAll does not duplicate.
    act(() => ref.current!.selectAll())
    expect(onSelection).toHaveBeenLastCalledWith([9, 1, 3])
  })
})

// ── Batch G LOW fix: expandAll seeds only when parents exist ──────────────
describe('IrisTable expandAll seeding (batch G fix F2)', () => {
  const getSubRows = (row: Row): Row[] | undefined =>
    row.id === 1 ? [{ id: 11, name: 'A1', age: 1 }] : undefined

  it('a proxy page without parents does not burn the one-shot — a later page with parents still seeds', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 9, name: 'L1', age: 1 }], total: 2 })
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'A', age: 1 }], total: 2 })
    const ref: { current: IrisTableHandle<Row> | null } = { current: null }
    const { container } = render(
      <IrisTable
        columns={cols}
        rowKey="id"
        getSubRows={getSubRows}
        expandAll
        tableRef={ref}
        proxyConfig={{ query }}
      />,
    )
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    // First page has no parent rows → nothing to seed, ref NOT burned.
    expect(container.querySelector('[data-iris-table-tree-toggle]')).toBeNull()
    // Second page contains a parent → the seed still fires and expands it.
    act(() => ref.current!.refetch())
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
    await waitFor(() => {
      expect(container.querySelector('[data-iris-table-row="11"]')).not.toBeNull()
    })
    expect(
      container.querySelector('[data-iris-table-tree-toggle]')?.getAttribute('aria-expanded'),
    ).toBe('true')
  })
})

// ── Batch G LOW fix: tree children use the multi comparator ───────────────
describe('IrisTable tree multiSort (batch G fix F3)', () => {
  const tree: Row[] = [
    {
      id: 1,
      name: 'Root',
      age: 0,
      children: [
        { id: 2, name: 'Alice', age: 30 },
        { id: 3, name: 'Bob', age: 35 },
        { id: 4, name: 'Alice', age: 25 },
      ],
    },
  ]
  const sortableCols: IrisTableColumn<Row>[] = [
    { key: 'name', title: 'Name', sortable: true },
    { key: 'age', title: 'Age', sortable: true },
  ]

  it('sorts tree children by the chained multi comparator (name, then age)', () => {
    const { container } = render(
      <IrisTable
        columns={sortableCols}
        data={tree}
        rowKey="id"
        getSubRows={(r) => r.children as Row[] | undefined}
        multiSort
        defaultMultiSort={[
          { key: 'name', direction: 'asc' },
          { key: 'age', direction: 'asc' },
        ]}
        defaultExpandedRowKeys={[1]}
      />,
    )
    // Children resolve the Alice tie by age: Alice(25), Alice(30), Bob.
    expect(
      Array.from(container.querySelectorAll('[data-iris-table-cell="name"]')).map(
        (c) => c.textContent?.replace('▶', '') ?? '',
      ),
    ).toEqual(['Root', 'Alice', 'Alice', 'Bob'])
    expect(
      Array.from(container.querySelectorAll('[data-iris-table-cell="age"]')).map((c) =>
        c.textContent?.trim(),
      ),
    ).toEqual(['0', '25', '30', '35'])
  })
})

// ── Batch G: tooltipConfig (vxe tooltipConfig parity, title mode) ─────────
describe('IrisTable tooltipConfig (batch G)', () => {
  // The named interface is exported from the barrel (manifest hygiene).
  const cfg: IrisTableTooltipConfig<Row> = {}

  it('content callback renders the title; empty content drops it (vxe empty-content parity)', () => {
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        tooltipConfig={{
          content: (row, col) => (col.key === 'name' ? `Name:${row.name}` : ''),
        }}
      />,
    )
    const nameCells = container.querySelectorAll('[data-iris-table-cell="name"]')
    const ageCells = container.querySelectorAll('[data-iris-table-cell="age"]')
    expect(nameCells[0]?.getAttribute('title')).toBe('Name:Alice')
    expect(nameCells[3]?.getAttribute('title')).toBe('Name:Diana')
    expect(ageCells[0]?.getAttribute('title')).toBeNull()
    void cfg
  })

  it('raw value fallback: title = String(cell value)', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" tooltipConfig={{ showAll: true }} />,
    )
    expect(container.querySelector('[data-iris-table-cell="name"]')?.getAttribute('title')).toBe(
      'Alice',
    )
    expect(container.querySelector('[data-iris-table-cell="age"]')?.getAttribute('title')).toBe(
      '25',
    )
  })

  it('showAll=false keeps titles in jsdom when layout dimensions are unavailable', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" tooltipConfig={{ showAll: false }} />,
    )
    // jsdom reports clientWidth=0, so the implementation fails open rather
    // than hiding useful titles in a layout it cannot measure.
    expect(container.querySelector('[data-iris-table-cell="name"]')?.getAttribute('title')).toBe(
      'Alice',
    )
    expect(container.querySelector('[data-iris-table-cell="age"]')?.getAttribute('title')).toBe(
      '25',
    )
  })

  it('showAll=false gates titles to measured overflow and rechecks after resize', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" tooltipConfig={{ showAll: false }} />,
    )
    const name = container.querySelector('[data-iris-table-cell="name"]') as HTMLElement
    const age = container.querySelector('[data-iris-table-cell="age"]') as HTMLElement
    Object.defineProperties(name, {
      clientWidth: { configurable: true, value: 40 },
      scrollWidth: { configurable: true, value: 120 },
    })
    Object.defineProperties(age, {
      clientWidth: { configurable: true, value: 40 },
      scrollWidth: { configurable: true, value: 40 },
    })
    act(() => window.dispatchEvent(new Event('resize')))
    expect(name.getAttribute('title')).toBe('Alice')
    expect(name.getAttribute('data-iris-tooltip-truncated')).toBe('true')
    expect(age.getAttribute('title')).toBeNull()

    Object.defineProperties(name, {
      clientWidth: { configurable: true, value: 200 },
      scrollWidth: { configurable: true, value: 120 },
    })
    Object.defineProperties(age, {
      clientWidth: { configurable: true, value: 20 },
      scrollWidth: { configurable: true, value: 80 },
    })
    act(() => window.dispatchEvent(new Event('resize')))
    expect(name.getAttribute('title')).toBeNull()
    expect(age.getAttribute('title')).toBe('25')
    expect(age.getAttribute('data-iris-tooltip-truncated')).toBe('true')
  })

  it('editing cells are exempt from the title', () => {
    const editCols: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name', editable: true }]
    const { container } = render(
      <IrisTable columns={editCols} data={rows} rowKey="id" tooltipConfig={{}} />,
    )
    const cell = container.querySelector('[data-iris-table-cell="name"]')!
    fireEvent.doubleClick(cell)
    expect(container.querySelector('[data-iris-table-editor]')).not.toBeNull()
    expect(
      container.querySelector('[data-iris-table-cell="name"]')?.getAttribute('title'),
    ).toBeNull()
  })
})

// ── Batch G: checkboxRange (vxe checkboxConfig isShiftKey parity) ─────────
describe('IrisTable checkboxRange (batch G)', () => {
  const rangeRows: Row[] = [
    { id: 1, name: 'a', age: 1 },
    { id: 2, name: 'b', age: 2 },
    { id: 3, name: 'c', age: 3 },
    { id: 4, name: 'd', age: 4 },
  ]
  const rowBox = (container: HTMLElement, id: number): Element => {
    const el = container.querySelector(`[data-iris-table-row="${id}"] [data-iris-checkbox]`)
    expect(el).not.toBeNull()
    return el!
  }

  it('shift-click toggles every row between the anchor and the target; checkMethod rows skipped', () => {
    const onSelection = vi.fn()
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rangeRows}
        rowKey="id"
        selectable="multi"
        checkboxRange
        // id 3 is not selectable — skipped inside the range.
        checkMethod={(r) => (r.age as number) !== 3}
        onSelectionChange={onSelection}
      />,
    )
    // Plain click sets the anchor and selects row 1.
    fireEvent.click(rowBox(container, 1))
    expect(onSelection).toHaveBeenLastCalledWith([1])
    // Shift-click row 4: rows 1..4 each toggle via the model (1 → off,
    // 2/4 → on, 3 skipped by checkMethod) — the last emit carries the state.
    fireEvent.click(rowBox(container, 4), { shiftKey: true })
    expect(onSelection).toHaveBeenLastCalledWith([2, 4])
    expect(container.querySelectorAll('[data-iris-table-row-selected="true"]')).toHaveLength(2)
    expect((rowBox(container, 3).querySelector('input') as HTMLInputElement).disabled).toBe(true)
  })

  it('plain click moves the anchor; the next shift-click ranges from the NEW anchor', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rangeRows} rowKey="id" selectable="multi" checkboxRange />,
    )
    fireEvent.click(rowBox(container, 1)) // anchor 1, selected [1]
    fireEvent.click(rowBox(container, 2)) // anchor 2, selected [1, 2]
    // Range 2..4 toggles: 2 → off, 3/4 → on → [1, 3, 4].
    fireEvent.click(rowBox(container, 4), { shiftKey: true })
    expect(container.querySelectorAll('[data-iris-table-row-selected="true"]')).toHaveLength(3)
    const keys = Array.from(
      container.querySelectorAll('[data-iris-table-row-selected="true"]'),
    ).map((el) => el.getAttribute('data-iris-table-row'))
    expect(keys).toEqual(['1', '3', '4'])
  })

  it('uncheck direction: shift-click over a checked range unchecks it (per-key toggle)', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rangeRows} rowKey="id" selectable="multi" checkboxRange />,
    )
    fireEvent.click(rowBox(container, 1)) // anchor 1, selected [1]
    // Range 1..4 toggles: the checked anchor flips off too → [2, 3, 4].
    fireEvent.click(rowBox(container, 4), { shiftKey: true })
    expect(
      Array.from(container.querySelectorAll('[data-iris-table-row-selected="true"]')).map((el) =>
        el.getAttribute('data-iris-table-row'),
      ),
    ).toEqual(['2', '3', '4'])
    // Same shift-click from the new anchor (4) down to row 2 toggles 2..4
    // back off (each was checked) → the whole range unchecks.
    fireEvent.click(rowBox(container, 2), { shiftKey: true })
    expect(container.querySelectorAll('[data-iris-table-row-selected="true"]')).toHaveLength(0)
  })

  it('header select-all resets the anchor — the next shift-click is a plain toggle', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rangeRows} rowKey="id" selectable="multi" checkboxRange />,
    )
    fireEvent.click(rowBox(container, 1)) // anchor 1
    // Header select-all: everything checked AND the anchor reset.
    fireEvent.click(container.querySelector('[data-iris-table-row="header"] [data-iris-checkbox]')!)
    expect(container.querySelectorAll('[data-iris-table-row-selected="true"]')).toHaveLength(4)
    // With no anchor, shift-click degenerates to a single toggle of row 3.
    fireEvent.click(rowBox(container, 3), { shiftKey: true })
    expect(container.querySelectorAll('[data-iris-table-row-selected="true"]')).toHaveLength(3)
    expect(
      container
        .querySelector('[data-iris-table-row="3"]')
        ?.getAttribute('data-iris-table-row-selected'),
    ).toBeNull()
  })
})
