import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { IrisTable } from '../IrisTable'
import type { IrisTableColumn } from '../types'

afterEach(cleanup)

describe('IrisTable tree rows', () => {
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

  // The Solid row element carries data-iris-table-row="" (no id), so locate a
  // row's toggle via the first-column cell whose text matches the given name.
  function nameCellFor(name: string): HTMLElement | null {
    const cells = Array.from(
      document.querySelectorAll('[data-iris-table-cell="name"]'),
    ) as HTMLElement[]
    return cells.find((c) => (c.textContent ?? '').replace('▶', '').trim() === name) ?? null
  }
  function toggleFor(name: string): HTMLButtonElement | null {
    return (
      (nameCellFor(name)?.querySelector(
        '[data-iris-table-tree-toggle]',
      ) as HTMLButtonElement | null) ?? null
    )
  }
  function indentPaddingFor(name: string): number {
    const indent = nameCellFor(name)?.querySelector(
      '[data-iris-table-tree-indent]',
    ) as HTMLElement | null
    return parseInt((indent?.style.paddingLeft || '0').replace('px', ''), 10)
  }
  function visibleNames(): string[] {
    // The tree toggle (▶) renders inside the first cell; strip it to read the name.
    return Array.from(document.querySelectorAll('[data-iris-table-cell="name"]')).map((c) =>
      (c.textContent ?? '').replace('▶', '').trim(),
    )
  }

  it('renders only roots collapsed, with a toggle on parents only, aria-expanded=false', () => {
    render(() => <IrisTable columns={treeCols} data={treeData} getSubRows={(r) => r.children} />)
    expect(visibleNames()).toEqual(['Root A', 'Root B'])
    expect(toggleFor('Root A')).not.toBeNull() // has children
    expect(toggleFor('Root B')).toBeNull() // leaf
    expect(toggleFor('Root A')!.getAttribute('aria-expanded')).toBe('false')
  })

  it('clicking the toggle reveals children then hides them', () => {
    render(() => <IrisTable columns={treeCols} data={treeData} getSubRows={(r) => r.children} />)
    fireEvent.click(toggleFor('Root A')!)
    expect(visibleNames()).toEqual(['Root A', 'Child A1', 'Child A2', 'Root B'])
    expect(toggleFor('Root A')!.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(toggleFor('Root A')!)
    expect(visibleNames()).toEqual(['Root A', 'Root B'])
  })

  it('defaultExpandedRowKeys starts a branch open + onExpandedRowsChange fires on toggle', () => {
    const onExpandedRowsChange = vi.fn()
    render(() => (
      <IrisTable
        columns={treeCols}
        data={treeData}
        getSubRows={(r) => r.children}
        defaultExpandedRowKeys={[1]}
        onExpandedRowsChange={onExpandedRowsChange}
      />
    ))
    expect(visibleNames()).toEqual(['Root A', 'Child A1', 'Child A2', 'Root B'])
    fireEvent.click(toggleFor('Root A')!) // collapse
    expect(onExpandedRowsChange).toHaveBeenLastCalledWith([])
  })

  it('child rows are indented deeper than their parent', () => {
    render(() => (
      <IrisTable
        columns={treeCols}
        data={treeData}
        getSubRows={(r) => r.children}
        defaultExpandedRowKeys={[1]}
      />
    ))
    expect(indentPaddingFor('Child A1')).toBeGreaterThan(indentPaddingFor('Root A'))
  })

  it('no tree indent/toggle when getSubRows is absent (flat mode unchanged)', () => {
    render(() => <IrisTable columns={treeCols} data={treeData} />)
    expect(document.querySelector('[data-iris-table-tree-toggle]')).toBeNull()
    expect(document.querySelector('[data-iris-table-tree-indent]')).toBeNull()
  })

  it('exposes aria-level on tree rows for screen-reader depth', () => {
    render(() => (
      <IrisTable
        columns={treeCols}
        data={treeData}
        getSubRows={(r) => r.children}
        defaultExpandedRowKeys={[1]}
      />
    ))
    // The Solid row carries data-iris-table-row="" (no id); its first-column
    // cell's parent is the row element, so read aria-level off that.
    const levelOf = (name: string): string | null | undefined =>
      nameCellFor(name)?.parentElement?.getAttribute('aria-level')
    expect(levelOf('Root A')).toBe('1') // root
    expect(levelOf('Child A1')).toBe('2') // child
  })

  it('exposes aria-setsize/aria-posinset on tree rows for sibling position', () => {
    render(() => (
      <IrisTable
        columns={treeCols}
        data={treeData}
        getSubRows={(r) => r.children}
        defaultExpandedRowKeys={[1]}
      />
    ))
    // The Solid row carries data-iris-table-row="" (no id); read the aria attrs
    // off the first-column cell's parent (the row element).
    const rowFor = (name: string): HTMLElement | null | undefined =>
      nameCellFor(name)?.parentElement
    // Two roots → setsize 2; Root A is the first (posinset 1), Root B second.
    expect(rowFor('Root A')?.getAttribute('aria-setsize')).toBe('2')
    expect(rowFor('Root A')?.getAttribute('aria-posinset')).toBe('1')
    expect(rowFor('Root B')?.getAttribute('aria-posinset')).toBe('2')
    // Root A has two children → child setsize 2; Child A1 is first, A2 second.
    expect(rowFor('Child A1')?.getAttribute('aria-setsize')).toBe('2')
    expect(rowFor('Child A1')?.getAttribute('aria-posinset')).toBe('1')
    expect(rowFor('Child A2')?.getAttribute('aria-posinset')).toBe('2')
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
    render(() => (
      <IrisTable
        columns={sortableCols}
        data={data}
        getSubRows={(r) => r.children}
        defaultExpandedRowKeys={[1]}
      />
    ))
    // Unsorted: roots and children keep their source order.
    expect(visibleNames()).toEqual(['Root B', 'Child B2', 'Child B1', 'Root A'])
    // Sort asc by name: roots reorder (A before B) AND Root B's children reorder.
    const header = document.querySelector('[data-iris-table-header="name"]') as HTMLElement
    fireEvent.click(header)
    expect(visibleNames()).toEqual(['Root A', 'Root B', 'Child B1', 'Child B2'])
  })
})
