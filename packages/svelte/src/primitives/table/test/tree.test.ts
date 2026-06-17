import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import IrisTable from '../IrisTable.svelte'

afterEach(cleanup)

describe('IrisTable tree rows', () => {
  // Hierarchical fixture: Root A (id 1) has two children A1/A2; Root B (id 2)
  // is a leaf. Svelte body rows carry no key attribute, so the tree toggle /
  // indent are addressed by the row's position in the flattened body.
  const treeData = [
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
  const treeCols = [{ key: 'name', title: 'Name' }]
  const getSubRows = (r: Record<string, unknown>) =>
    r.children as Array<Record<string, unknown>> | undefined

  function bodyRows(container: HTMLElement): NodeListOf<HTMLElement> {
    return container.querySelectorAll('[data-iris-table-body] [data-iris-table-row]')
  }
  function toggleAt(container: HTMLElement, index: number): HTMLElement | null {
    return bodyRows(container)[index].querySelector('[data-iris-table-tree-toggle]')
  }
  function indentAt(container: HTMLElement, index: number): HTMLElement {
    return bodyRows(container)[index].querySelector('[data-iris-table-tree-indent]') as HTMLElement
  }
  function visibleNames(container: HTMLElement): string[] {
    // The tree toggle (▶) renders inside the first cell; strip it to read the name.
    return Array.from(container.querySelectorAll('[data-iris-table-cell="name"]')).map((c) =>
      (c.textContent ?? '').replace('▶', '').trim(),
    )
  }

  it('renders only roots collapsed, with a toggle on parents only; aria-expanded=false', () => {
    const { container } = render(IrisTable, {
      props: { columns: treeCols, data: treeData, getSubRows },
    })
    expect(visibleNames(container)).toEqual(['Root A', 'Root B'])
    expect(toggleAt(container, 0)).not.toBeNull() // Root A has children
    expect(toggleAt(container, 1)).toBeNull() // Root B is a leaf
    expect(toggleAt(container, 0)!.getAttribute('aria-expanded')).toBe('false')
  })

  it('clicking the toggle reveals children then hides them', async () => {
    const { container } = render(IrisTable, {
      props: { columns: treeCols, data: treeData, getSubRows },
    })
    await fireEvent.click(toggleAt(container, 0)!)
    expect(visibleNames(container)).toEqual(['Root A', 'Child A1', 'Child A2', 'Root B'])
    expect(toggleAt(container, 0)!.getAttribute('aria-expanded')).toBe('true')
    await fireEvent.click(toggleAt(container, 0)!)
    expect(visibleNames(container)).toEqual(['Root A', 'Root B'])
  })

  it('defaultExpandedRowKeys starts a branch open + onExpandedRowsChange fires on toggle', async () => {
    const onExpandedRowsChange = vi.fn()
    const { container } = render(IrisTable, {
      props: {
        columns: treeCols,
        data: treeData,
        getSubRows,
        defaultExpandedRowKeys: [1],
        onExpandedRowsChange,
      },
    })
    expect(visibleNames(container)).toEqual(['Root A', 'Child A1', 'Child A2', 'Root B'])
    await fireEvent.click(toggleAt(container, 0)!) // collapse Root A
    expect(onExpandedRowsChange).toHaveBeenLastCalledWith([])
    expect(visibleNames(container)).toEqual(['Root A', 'Root B'])
  })

  it('child rows are indented deeper than their parent', () => {
    const { container } = render(IrisTable, {
      props: { columns: treeCols, data: treeData, getSubRows, defaultExpandedRowKeys: [1] },
    })
    const pad = (index: number): number =>
      parseInt(indentAt(container, index).style.paddingLeft || '0', 10)
    // Flattened order: [Root A, Child A1, Child A2, Root B]; child (idx 1) deeper than parent (idx 0).
    expect(pad(1)).toBeGreaterThan(pad(0))
  })

  it('no tree toggle/indent when getSubRows is absent (flat mode unchanged)', () => {
    const { container } = render(IrisTable, { props: { columns: treeCols, data: treeData } })
    expect(container.querySelector('[data-iris-table-tree-toggle]')).toBeNull()
    expect(container.querySelector('[data-iris-table-tree-indent]')).toBeNull()
  })

  it('exposes aria-level/setsize/posinset on tree rows for screen readers', () => {
    const { container } = render(IrisTable, {
      props: { columns: treeCols, data: treeData, getSubRows, defaultExpandedRowKeys: [1] },
    })
    // Flattened order: [Root A, Child A1, Child A2, Root B]. Svelte body rows
    // carry no key attribute, so each row is addressed by its position.
    const attrs = (index: number) => ({
      level: bodyRows(container)[index].getAttribute('aria-level'),
      setsize: bodyRows(container)[index].getAttribute('aria-setsize'),
      posinset: bodyRows(container)[index].getAttribute('aria-posinset'),
    })
    // Root A (idx 0): level 1, 2 roots, position 1.
    expect(attrs(0)).toEqual({ level: '1', setsize: '2', posinset: '1' })
    // Child A1 (idx 1): level 2, 2 children, position 1.
    expect(attrs(1)).toEqual({ level: '2', setsize: '2', posinset: '1' })
  })

  it('uses role=treegrid for a keyboard-navigable tree (else grid/table)', () => {
    const root = (container: HTMLElement): string | null =>
      container.querySelector('[data-iris-table]')!.getAttribute('role')
    // Tree + keyboardNavigation → treegrid.
    expect(
      root(
        render(IrisTable, {
          props: { columns: treeCols, data: treeData, getSubRows, keyboardNavigation: true },
        }).container,
      ),
    ).toBe('treegrid')
    // Non-tree + keyboardNavigation → grid.
    expect(
      root(
        render(IrisTable, {
          props: { columns: treeCols, data: treeData, keyboardNavigation: true },
        }).container,
      ),
    ).toBe('grid')
    // Tree without keyboardNavigation → table.
    expect(
      root(
        render(IrisTable, {
          props: { columns: treeCols, data: treeData, getSubRows },
        }).container,
      ),
    ).toBe('table')
  })

  it('column sort reorders tree siblings hierarchically (roots and children)', async () => {
    // Roots AND Root B's children are out of alphabetical order in the source.
    const data = [
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
    const sortableCols = [{ key: 'name', title: 'Name', sortable: true }]
    const { container } = render(IrisTable, {
      props: { columns: sortableCols, data, getSubRows, defaultExpandedRowKeys: [1] },
    })
    // Unsorted: roots and children keep their source order.
    expect(visibleNames(container)).toEqual(['Root B', 'Child B2', 'Child B1', 'Root A'])
    // Sort asc by name: roots reorder (A before B) AND Root B's children reorder.
    const header = container.querySelector('[data-iris-table-header="name"]')!
    await fireEvent.click(header)
    expect(visibleNames(container)).toEqual(['Root A', 'Root B', 'Child B1', 'Child B2'])
  })
})

describe('IrisTable virtual tree rows', () => {
  // Tree rows are uniform height, so they virtualize like flat rows when
  // `virtualScroll` is set — UNLESS `renderDetail` is also on (detail panels
  // are variable-height, which the virtual scroller can't window).
  const treeCols = [{ key: 'name', title: 'Name' }]
  const getSubRows = (r: Record<string, unknown>) =>
    r.children as Array<Record<string, unknown>> | undefined

  it('virtualizes an expanded tree (uniform-height rows) with the tree toggle intact + windows', () => {
    // One root expanded with ~40 children → 41 total flattened rows.
    const tree = [
      {
        id: 1,
        name: 'Root',
        children: Array.from({ length: 40 }, (_, i) => ({ id: 100 + i, name: `C${i}` })),
      },
    ]
    const { container } = render(IrisTable, {
      props: {
        columns: treeCols,
        data: tree,
        getSubRows,
        defaultExpandedRowKeys: [1],
        virtualScroll: { itemHeight: 36, height: 200 },
      },
    })
    // Tree mode now uses the virtual scroller (was previously excluded).
    expect(container.querySelector('[data-iris-virtual-scroll]')).not.toBeNull()
    // Tree meta still flows into the virtualized rows (the parent toggle renders).
    expect(container.querySelector('[data-iris-table-tree-toggle]')).not.toBeNull()
    // Windowed: far fewer than the 41 total rows are in the DOM.
    expect(container.querySelectorAll('[data-iris-table-row]').length).toBeLessThan(41)
  })

  it('does NOT virtualize tree mode when renderDetail is set (variable-height rows)', () => {
    const tree = [{ id: 1, name: 'Root', children: [{ id: 2, name: 'C' }] }]
    const { container } = render(IrisTable, {
      props: {
        columns: treeCols,
        data: tree,
        getSubRows,
        renderDetail: (r: Record<string, unknown>) => `d-${r.id}`,
        virtualScroll: { itemHeight: 36, height: 200 },
      },
    })
    expect(container.querySelector('[data-iris-virtual-scroll]')).toBeNull()
  })
})
