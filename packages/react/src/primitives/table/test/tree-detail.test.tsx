import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
  { id: 3, name: 'Bob', age: 28 },
]

const baseColumns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true, align: 'right' },
]

describe('@iris-ui-kit/react IrisTable expandable detail rows', () => {
  function toggle(rowId: string | number): HTMLElement {
    return document.querySelector(
      `[data-iris-table-row="${rowId}"] [data-iris-table-expand-toggle]`,
    ) as HTMLElement
  }
  function detail(rowId: string | number): HTMLElement | null {
    return document.querySelector(`[data-iris-table-row-detail="${rowId}"]`)
  }

  it('renders an expand toggle per row and no detail panel by default', () => {
    render(<IrisTable columns={baseColumns} data={rows} renderDetail={(r) => <div>D{r.id}</div>} />)
    expect(document.querySelectorAll('[data-iris-table-expand-toggle]').length).toBe(3)
    expect(detail(1)).toBeNull()
    expect(toggle(1).getAttribute('aria-expanded')).toBe('false')
  })

  it('clicking the toggle reveals the detail panel, clicking again hides it', () => {
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        renderDetail={(r) => <div>detail-{r.id}</div>}
      />,
    )
    act(() => fireEvent.click(toggle(1)))
    expect(detail(1)).not.toBeNull()
    expect(detail(1)!.textContent).toBe('detail-1')
    expect(toggle(1).getAttribute('aria-expanded')).toBe('true')
    act(() => fireEvent.click(toggle(1)))
    expect(detail(1)).toBeNull()
  })

  it('rowExpandable gates which rows get a toggle', () => {
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        renderDetail={(r) => <div>{r.id}</div>}
        rowExpandable={(r) => r.id !== 2}
      />,
    )
    expect(toggle(1)).not.toBeNull()
    expect(toggle(2)).toBeNull() // row 2 not expandable
    expect(toggle(3)).not.toBeNull()
  })

  it('defaultExpandedRowKeys starts expanded and onExpandedRowsChange fires on toggle', () => {
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        renderDetail={(r) => <div>{r.id}</div>}
        defaultExpandedRowKeys={[1]}
        onExpandedRowsChange={onChange}
      />,
    )
    expect(detail(1)).not.toBeNull()
    act(() => fireEvent.click(toggle(2)))
    expect(onChange).toHaveBeenLastCalledWith(['1', '2'])
    expect(detail(2)).not.toBeNull()
  })

  it('no expand column when renderDetail is absent', () => {
    render(<IrisTable columns={baseColumns} data={rows} />)
    expect(document.querySelector('[data-iris-table-cell="__expand"]')).toBeNull()
    expect(document.querySelector('[data-iris-table-header="__expand"]')).toBeNull()
  })
})

describe('@iris-ui-kit/react IrisTable tree rows', () => {
  interface TreeRowData extends Record<string, unknown> {
    id: number
    name: string
    children?: TreeRowData[]
  }
  const treeData: TreeRowData[] = [
    {
      id: 1,
      name: 'Root A',
      children: [
        { id: 11, name: 'Child A1' },
        { id: 12, name: 'Child A2' },
      ],
    },
    { id: 2, name: 'Root B' },
  ]
  const treeCols: IrisTableColumn<TreeRowData>[] = [{ key: 'name', title: 'Name' }]
  function toggleOf(rowId: number): HTMLElement | null {
    return document.querySelector(`[data-iris-table-row="${rowId}"] [data-iris-table-tree-toggle]`)
  }
  function visibleNames(): string[] {
    // The tree toggle (▶) renders inside the first cell; strip it to read the name.
    return Array.from(document.querySelectorAll('[data-iris-table-cell="name"]')).map((c) =>
      (c.textContent ?? '').replace('▶', '').trim(),
    )
  }

  it('renders only roots collapsed, with a toggle on parents only', () => {
    render(<IrisTable columns={treeCols} data={treeData} getSubRows={(r) => r.children} />)
    expect(visibleNames()).toEqual(['Root A', 'Root B'])
    expect(toggleOf(1)).not.toBeNull() // has children
    expect(toggleOf(2)).toBeNull() // leaf
    expect(toggleOf(1)!.getAttribute('aria-expanded')).toBe('false')
  })

  it('expanding a parent reveals its children, collapsing hides them', () => {
    render(<IrisTable columns={treeCols} data={treeData} getSubRows={(r) => r.children} />)
    act(() => fireEvent.click(toggleOf(1)!))
    expect(visibleNames()).toEqual(['Root A', 'Child A1', 'Child A2', 'Root B'])
    expect(toggleOf(1)!.getAttribute('aria-expanded')).toBe('true')
    act(() => fireEvent.click(toggleOf(1)!))
    expect(visibleNames()).toEqual(['Root A', 'Root B'])
  })

  it('defaultExpandedRowKeys starts a branch open + onExpandedRowsChange fires', () => {
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={treeCols}
        data={treeData}
        getSubRows={(r) => r.children}
        defaultExpandedRowKeys={[1]}
        onExpandedRowsChange={onChange}
      />,
    )
    expect(visibleNames()).toEqual(['Root A', 'Child A1', 'Child A2', 'Root B'])
    act(() => fireEvent.click(toggleOf(1)!)) // collapse
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('child rows are indented deeper than their parent', () => {
    render(
      <IrisTable
        columns={treeCols}
        data={treeData}
        getSubRows={(r) => r.children}
        defaultExpandedRowKeys={[1]}
      />,
    )
    const indentOf = (rowId: number): number => {
      const el = document.querySelector(
        `[data-iris-table-row="${rowId}"] [data-iris-table-tree-indent]`,
      ) as HTMLElement
      return parseInt(el.style.paddingLeft || '0', 10)
    }
    expect(indentOf(11)).toBeGreaterThan(indentOf(1))
  })

  it('no tree indent/toggle when getSubRows is absent (flat mode unchanged)', () => {
    render(<IrisTable columns={treeCols} data={treeData} />)
    expect(document.querySelector('[data-iris-table-tree-toggle]')).toBeNull()
    expect(document.querySelector('[data-iris-table-tree-indent]')).toBeNull()
  })

  it('exposes aria-level/setsize/posinset on tree rows for screen readers', () => {
    render(
      <IrisTable
        columns={treeCols}
        data={treeData}
        getSubRows={(r) => r.children}
        defaultExpandedRowKeys={[1]}
      />,
    )
    const rowEl = (rowId: number) => document.querySelector(`[data-iris-table-row="${rowId}"]`)!
    const attrs = (rowId: number) => ({
      level: rowEl(rowId).getAttribute('aria-level'),
      setsize: rowEl(rowId).getAttribute('aria-setsize'),
      posinset: rowEl(rowId).getAttribute('aria-posinset'),
    })
    // Root A (id 1): level 1, 2 roots, position 1.
    expect(attrs(1)).toEqual({ level: '1', setsize: '2', posinset: '1' })
    // Child A1 (id 11): level 2, 2 children, position 1.
    expect(attrs(11)).toEqual({ level: '2', setsize: '2', posinset: '1' })
  })

  it('uses role=treegrid for a keyboard-navigable tree (else grid/table)', () => {
    const { container, rerender } = render(
      <IrisTable
        columns={treeCols}
        data={treeData}
        getSubRows={(r) => r.children}
        keyboardNavigation
      />,
    )
    expect(container.querySelector('[data-iris-table]')?.getAttribute('role')).toBe('treegrid')
    // Without tree mode it stays a grid; without keyboard nav, a table.
    rerender(<IrisTable columns={treeCols} data={treeData} keyboardNavigation />)
    expect(container.querySelector('[data-iris-table]')?.getAttribute('role')).toBe('grid')
    rerender(<IrisTable columns={treeCols} data={treeData} getSubRows={(r) => r.children} />)
    expect(container.querySelector('[data-iris-table]')?.getAttribute('role')).toBe('table')
  })

  it('column sort reorders tree siblings hierarchically (roots and children)', () => {
    const data: TreeRowData[] = [
      {
        id: 1,
        name: 'Root B',
        children: [
          { id: 12, name: 'Child B2' },
          { id: 11, name: 'Child B1' },
        ],
      },
      { id: 2, name: 'Root A' },
    ]
    const sortableCols: IrisTableColumn<TreeRowData>[] = [
      { key: 'name', title: 'Name', sortable: true },
    ]
    render(
      <IrisTable
        columns={sortableCols}
        data={data}
        getSubRows={(r) => r.children}
        defaultExpandedRowKeys={[1]}
      />,
    )
    // Unsorted: roots and children keep their source order.
    expect(visibleNames()).toEqual(['Root B', 'Child B2', 'Child B1', 'Root A'])
    // Sort asc by name: roots reorder (A before B) AND Root B's children reorder.
    const header = document.querySelector('[data-iris-table-header="name"]') as HTMLElement
    act(() => fireEvent.click(header))
    expect(visibleNames()).toEqual(['Root A', 'Root B', 'Child B1', 'Child B2'])
  })
})
