import * as React from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

/**
 * Batch DW (iris 独有 — vxe has no single event bus): `onTableEvent` merges
 * the cell/row/sort/filter/edit/expand event families into ONE subscription,
 * firing AFTER the matching dedicated callback (a bridge, not a behavior —
 * gate parity holds by construction).
 */

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
  status: string
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25, status: 'active' },
  { id: 2, name: 'Alice', age: 32, status: 'inactive' },
  { id: 3, name: 'Bob', age: 28, status: 'active' },
]

interface EventCapture {
  type: string
  detail: unknown
}

function bus(events: EventCapture[]): (event: { type: string; detail: unknown }) => void {
  return (event) => events.push(event)
}

function cell(rowId: string | number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}

function header(key: string): HTMLElement {
  return document.querySelector(`[data-iris-table-header="${key}"]`) as HTMLElement
}

function expandToggle(rowId: string | number): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-expand-toggle]`,
  ) as HTMLElement
}

function treeToggle(rowId: string | number): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-tree-toggle]`,
  ) as HTMLElement
}

function editor(): HTMLInputElement | null {
  return document.querySelector('[data-iris-table-editor]')
}

/** Filter panel: open the column's trigger, toggle an option, confirm. */
function applyFilter(colKey: string, optionVal: string): void {
  act(() => {
    fireEvent.click(document.querySelector(`[data-iris-filter-trigger="${colKey}"]`)!)
  })
  act(() => {
    fireEvent.click(document.querySelector(`[data-iris-filter-option="${optionVal}"] input`)!)
  })
  act(() => {
    fireEvent.click(document.querySelector('[data-iris-filter-confirm]') as HTMLElement)
  })
}

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true, align: 'right' },
  {
    key: 'status',
    title: 'Status',
    filterable: true,
    filterOptions: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
  },
]

describe('@iris-ui-kit/react IrisTable onTableEvent (batch DW, iris 独有)', () => {
  it('cell-click: fires after the dedicated callback with reference-identical row/column', () => {
    const events: EventCapture[] = []
    const onCellClick = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        onCellClick={onCellClick}
        onTableEvent={bus(events)}
      />,
    )
    // The cell-click handler is gated on onCellClick — a no-op dedicated
    // callback keeps the click path alive ("parity by construction").
    act(() => {
      fireEvent.click(cell(1, 'name'))
    })
    expect(onCellClick).toHaveBeenCalledTimes(1)
    // The click bubbles to the row handler (pre-existing) → cell-click first.
    expect(events.map((e) => e.type)).toEqual(['cell-click', 'row-click'])
    const detail = events[0]!.detail as { row: Row; column: IrisTableColumn<Row> }
    expect(detail.row).toBe(rows[0])
    expect(detail.column.key).toBe('name')
    expect(onCellClick.mock.calls[0]![0]).toBe(events[0]!.detail)
  })

  it('cell-dblclick: fires with the same detail (no-op dedicated callback wired)', () => {
    const events: EventCapture[] = []
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        onCellDblClick={() => {}}
        onTableEvent={bus(events)}
      />,
    )
    act(() => {
      fireEvent.doubleClick(cell(1, 'age'))
    })
    // cell-dblclick first, then the bubbled row-dblclick.
    expect(events.map((e) => e.type)).toEqual(['cell-dblclick', 'row-dblclick'])
  })

  it('row-click and row-dblclick fire with { row, rowIndex }', () => {
    const events: EventCapture[] = []
    render(<IrisTable columns={cols} data={rows} rowKey="id" onTableEvent={bus(events)} />)
    act(() => {
      fireEvent.click(document.querySelector('[data-iris-table-row="2"]')!)
    })
    act(() => {
      fireEvent.doubleClick(document.querySelector('[data-iris-table-row="2"]')!)
    })
    expect(events.map((e) => e.type)).toEqual(['row-click', 'row-dblclick'])
    expect((events[0]!.detail as { row: Row }).row).toBe(rows[1])
    expect(events[1]!.detail).toEqual({ row: rows[1], rowIndex: 1 })
    expect((events[1]!.detail as { row: Row }).row).toBe(rows[1])
  })

  it('sort-change: header click cycles asc → desc → none, one bus event each', () => {
    const events: EventCapture[] = []
    const onSort = vi.fn()
    render(
      <IrisTable columns={cols} data={rows} onSortChange={onSort} onTableEvent={bus(events)} />,
    )
    const nameHeader = header('name')
    for (let i = 0; i < 3; i += 1) {
      act(() => {
        fireEvent.click(nameHeader)
      })
    }
    expect(onSort).toHaveBeenCalledTimes(3)
    expect(events).toHaveLength(3)
    expect(events.map((e) => e.type)).toEqual(['sort-change', 'sort-change', 'sort-change'])
    expect(events.map((e) => (e.detail as { sort: unknown }).sort)).toEqual([
      { key: 'name', direction: 'asc' },
      { key: 'name', direction: 'desc' },
      null,
    ])
    // The bus fires AFTER the dedicated callback (same render, same event).
    expect((events[0]!.detail as { sort: { direction: string } }).sort).toEqual(
      onSort.mock.calls[0]![0],
    )
  })

  it('multi-sort-change: two sortable headers append to the sort list', () => {
    const events: EventCapture[] = []
    render(<IrisTable columns={cols} data={rows} multiSort onTableEvent={bus(events)} />)
    act(() => {
      fireEvent.click(header('name'))
    })
    act(() => {
      fireEvent.click(header('age'))
    })
    expect(events.map((e) => e.type)).toEqual(['multi-sort-change', 'multi-sort-change'])
    expect(events.map((e) => (e.detail as { sorts: unknown }).sorts)).toEqual([
      [{ key: 'name', direction: 'asc' }],
      [
        { key: 'name', direction: 'asc' },
        { key: 'age', direction: 'asc' },
      ],
    ])
  })

  it('filter-value-change: panel confirm applies the checked set once', () => {
    const events: EventCapture[] = []
    const controller = { filterValues: {} }
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        filterValues={controller.filterValues}
        onFilterValuesChange={(next) => {
          controller.filterValues = next
        }}
        onTableEvent={bus(events)}
      />,
    )
    applyFilter('status', 'active')
    expect(events).toHaveLength(1)
    expect(events[0]!.type).toBe('filter-value-change')
    expect(events[0]!.detail).toEqual({ filterValues: { status: ['active'] } })
  })

  it('clearFilter: both filter channels reset, two bus events, zero duplicates', () => {
    const ref = React.createRef<{ clearFilter: () => void }>()
    const events: EventCapture[] = []
    const onFilters = vi.fn()
    const onValues = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        filters={{ name: 'x' }}
        onFiltersChange={onFilters}
        filterValues={{ status: ['active'] }}
        onFilterValuesChange={onValues}
        tableRef={ref}
        onTableEvent={bus(events)}
      />,
    )
    act(() => ref.current?.clearFilter())
    expect(onFilters).toHaveBeenCalledWith({})
    expect(onValues).toHaveBeenCalledWith({})
    expect(events.map((e) => e.type)).toEqual(['filter-change', 'filter-value-change'])
    expect(events[0]!.detail).toEqual({ filters: {} })
    expect(events[1]!.detail).toEqual({ filterValues: {} })
  })

  it('edit lifecycle: dblclick edit-start → Enter edit-commit (with the value)', () => {
    const events: EventCapture[] = []
    const editableCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true },
      { key: 'age', title: 'Age', editable: true, editor: 'number' },
    ]
    render(
      <IrisTable
        columns={editableCols}
        data={rows}
        rowKey="id"
        onCellDblClick={() => {}}
        onTableEvent={bus(events)}
      />,
    )
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    // Internal behavior first (edit-start), then the informational event,
    // then the bubbled row-dblclick.
    expect(events.map((e) => e.type)).toEqual(['edit-start', 'cell-dblclick', 'row-dblclick'])
    fireEvent.change(editor()!, { target: { value: 'Renamed' } })
    act(() => {
      fireEvent.keyDown(editor()!, { key: 'Enter' })
    })
    expect(events.map((e) => e.type)).toEqual([
      'edit-start',
      'cell-dblclick',
      'row-dblclick',
      'edit-commit',
    ])
    expect(events.at(-1)!.detail as { value: string; cancelled: boolean }).toMatchObject({
      value: 'Renamed',
      cancelled: false,
    })
  })

  it('edit-cancel: Escape discards the session, one bus event', () => {
    const events: EventCapture[] = []
    const editableCols: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name', editable: true }]
    render(
      <IrisTable
        columns={editableCols}
        data={rows}
        rowKey="id"
        onCellDblClick={() => {}}
        onTableEvent={bus(events)}
      />,
    )
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    fireEvent.change(editor()!, { target: { value: 'discard me' } })
    act(() => {
      fireEvent.keyDown(editor()!, { key: 'Escape' })
    })
    expect(events.map((e) => e.type)).toEqual([
      'edit-start',
      'cell-dblclick',
      'row-dblclick',
      'edit-cancel',
    ])
    expect(events.at(-1)!.detail as { value?: unknown; cancelled: boolean }).toMatchObject({
      cancelled: true,
    })
  })

  it('expand-change: detail toggle reports the NEW expanded state', () => {
    const events: EventCapture[] = []
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        renderDetail={(r) => <div>D{r.id}</div>}
        onTableEvent={bus(events)}
      />,
    )
    act(() => {
      fireEvent.click(expandToggle(1))
    })
    act(() => {
      fireEvent.click(expandToggle(1))
    })
    // Each toggle: the shared model fires first (expanded-rows-change), then
    // the specific channel (expand-change).
    expect(events.map((e) => e.type)).toEqual([
      'expanded-rows-change',
      'expand-change',
      'expanded-rows-change',
      'expand-change',
    ])
    const expands = events.filter((e) => e.type === 'expand-change')
    expect(expands.map((e) => (e.detail as { expanded: boolean }).expanded)).toEqual([true, false])
    expect((expands[0]!.detail as { row: Row }).row).toBe(rows[0])
  })

  it('tree-expand-change: caret toggle reports the NEW state', () => {
    const events: EventCapture[] = []
    const treeRows = [
      { id: 1, name: 'Root A', children: [{ id: 11, name: 'Child A1' }] },
      { id: 2, name: 'Root B' },
    ]
    render(
      <IrisTable
        columns={[{ key: 'name', title: 'Name' }]}
        data={treeRows}
        rowKey="id"
        getSubRows={(r) => (r as { children?: unknown[] }).children}
        onTableEvent={bus(events)}
      />,
    )
    act(() => {
      fireEvent.click(treeToggle(1)!)
    })
    // The shared expansion model fires first (expanded-rows-change), then the
    // tree-specific channel.
    expect(events.map((e) => e.type)).toEqual(['expanded-rows-change', 'tree-expand-change'])
    expect(events.at(-1)!.detail).toEqual({
      row: treeRows[0],
      expanded: true,
    })
  })

  it('expanded-rows-change: the shared expansion model reports every key-list change', () => {
    const events: EventCapture[] = []
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        renderDetail={(r) => <div>D{r.id}</div>}
        onExpandedRowsChange={() => {}}
        onTableEvent={bus(events)}
      />,
    )
    act(() => {
      fireEvent.click(expandToggle(2))
    })
    const keysEvent = events.find((e) => e.type === 'expanded-rows-change')
    expect(keysEvent).toBeDefined()
    expect((keysEvent!.detail as { expandedKeys: string[] }).expandedKeys).toEqual(['2'])
  })

  it('expandAll seeding fires expanded-rows-change (the shared model channel, even without onExpandedRowsChange)', () => {
    const events: EventCapture[] = []
    const treeRows = [
      { id: 1, name: 'Root A', children: [{ id: 11, name: 'Child A1' }] },
      { id: 2, name: 'Root B', children: [{ id: 21, name: 'Child B1' }] },
    ]
    render(
      <IrisTable
        columns={[{ key: 'name', title: 'Name' }]}
        data={treeRows}
        rowKey="id"
        getSubRows={(r) => (r as { children?: unknown[] }).children}
        expandAll
        onTableEvent={bus(events)}
      />,
    )
    // The one-shot seed merges every parent key through the expansion model's
    // commit → the shared channel fires exactly one event on mount.
    expect(events.map((e) => e.type)).toEqual(['expanded-rows-change'])
    expect((events[0]!.detail as { expandedKeys: string[] }).expandedKeys).toEqual(['1', '2'])
  })

  it('persistState expandedKeys restore replays through the model → one expanded-rows-change', () => {
    const events: EventCapture[] = []
    const saved = JSON.stringify({ expandedKeys: ['2'] })
    const storage = {
      value: saved,
      getItem(): string | null {
        return this.value
      },
      setItem(_k: string, v: string): void {
        this.value = v
      },
    }
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        renderDetail={(r) => <div>D{r.id}</div>}
        persistState={{ storage, key: 'iris-table-batch-dw' }}
        onExpandedRowsChange={() => {}}
        onTableEvent={bus(events)}
      />,
    )
    // The mount restore gates on onExpandedRowsChange + an expandable table,
    // then calls expansion.set → the SAME model channel as a user toggle.
    expect(events.map((e) => e.type)).toEqual(['expanded-rows-change'])
    expect((events[0]!.detail as { expandedKeys: string[] }).expandedKeys).toEqual(['2'])
  })

  it('gate parity: a cell click emits no cell-click without onCellClick/rowMode', () => {
    const events: EventCapture[] = []
    render(<IrisTable columns={cols} data={rows} rowKey="id" onTableEvent={bus(events)} />)
    act(() => {
      fireEvent.click(cell(1, 'name'))
    })
    // The cell handler is NOT attached (gate) — only the bubbled row-click.
    expect(events.map((e) => e.type)).toEqual(['row-click'])
  })

  it('zero-noise regression: a dedicated action emits exactly its own event(s)', () => {
    const events: EventCapture[] = []
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        onCellClick={() => {}}
        onTableEvent={bus(events)}
      />,
    )
    act(() => {
      fireEvent.click(cell(1, 'age'))
    })
    // Exactly one cell-click (plus the pre-existing row-click bubble), and no
    // filter/sort/edit/expand events leak into the stream.
    expect(events.map((e) => e.type)).toEqual(['cell-click', 'row-click'])
  })

  it('regression: prop omitted = zero cost, dedicated callbacks unaffected', () => {
    const onSort = vi.fn()
    render(<IrisTable columns={cols} data={rows} onSortChange={onSort} />)
    act(() => {
      fireEvent.click(header('age'))
    })
    expect(onSort).toHaveBeenCalledTimes(1)
    expect(onSort).toHaveBeenLastCalledWith({ key: 'age', direction: 'asc' })
  })
})
