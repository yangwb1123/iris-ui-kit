import { describe, it, expect, afterEach, vi } from 'vitest'
import { createSignal } from 'solid-js'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn } from './types'

afterEach(cleanup)

const columns = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age' },
]

const data = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
  { name: 'Charlie', age: 35 },
]

describe('IrisTable', () => {
  it('controlled selection renders from the prop (reject → no flip; accept → flips)', () => {
    const onChange = vi.fn()
    const idData = [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 },
    ]
    const [selection, setSelection] = createSignal<Array<string | number>>([])
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={idData}
        selectable="multi"
        selection={selection()}
        onSelectionChange={onChange}
      />
    ))
    const cb = (): HTMLInputElement[] =>
      Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
    // index 0 is the master checkbox; row checkboxes start at 1.
    fireEvent.click(cb()[1]!)
    // onChange emits the intended next value...
    expect(onChange).toHaveBeenLastCalledWith([1])
    // ...but the parent has NOT written it back → the row stays unchecked (true controlled).
    expect(cb()[1]!.checked).toBe(false)
    // parent accepts → prop updates → the row reflects it.
    setSelection([1])
    expect(cb()[1]!.checked).toBe(true)
    // a further toggle is computed against the prop base [1] → emits [] (deselect).
    fireEvent.click(cb()[1]!)
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('renders without crashing', () => {
    const { container } = render(() => <IrisTable columns={columns} data={data} />)
    expect(container.querySelector('[data-iris-table]')).not.toBeNull()
  })

  it('renders column headers', () => {
    const { getByText } = render(() => <IrisTable columns={columns} data={data} />)
    expect(getByText('Name')).toBeTruthy()
    expect(getByText('Age')).toBeTruthy()
  })

  it('renders data rows', () => {
    const { getByText } = render(() => <IrisTable columns={columns} data={data} />)
    expect(getByText('Alice')).toBeTruthy()
    expect(getByText('Bob')).toBeTruthy()
    expect(getByText('Charlie')).toBeTruthy()
  })

  it('shows loading state', () => {
    const { container } = render(() => <IrisTable columns={columns} data={data} loading={true} />)
    expect(container.querySelector('[data-iris-table-row="loading"]')).not.toBeNull()
  })

  it('shows error state', () => {
    const { container } = render(() => <IrisTable columns={columns} data={data} error={true} />)
    expect(container.querySelector('[data-iris-table-row="error"]')).not.toBeNull()
  })

  it('shows empty state when data is empty', () => {
    const { container } = render(() => <IrisTable columns={columns} data={[]} />)
    expect(container.querySelector('[data-iris-table-row="empty"]')).not.toBeNull()
  })

  it('calls onRowClick when a row is clicked', () => {
    const onRowClick = vi.fn()
    const { getByText } = render(() => (
      <IrisTable columns={columns} data={data} onRowClick={onRowClick} />
    ))
    fireEvent.click(getByText('Alice').closest('[role="row"]')!)
    expect(onRowClick).toHaveBeenCalledWith(data[0], 0)
  })

  it('sorts data when sortable column header is clicked', () => {
    const { getByText, container } = render(() => <IrisTable columns={columns} data={data} />)
    fireEvent.click(getByText('Name'))
    // After click, data should be sorted ascending
    const rows = container.querySelectorAll('[data-iris-table-row]')
    // First data row should be Alice (sorted ascending by name)
    expect(rows[0]?.textContent).toContain('Alice')
  })
})

describe('IrisTable summary / footer row', () => {
  // Fixture ages: 30 + 25 + 35 = 90.
  const ageSum = data.reduce((acc, r) => acc + r.age, 0)

  const summaryCols: IrisTableColumn[] = [
    { key: 'name', title: 'Name' },
    { key: 'age', title: 'Age', summary: 'sum' },
  ]

  it('renders a summary row whose aggregate cell shows the sum; non-summary cell is blank', () => {
    const { container } = render(() => <IrisTable columns={summaryCols} data={data} />)
    const summaryRow = container.querySelector('[data-iris-table-row="summary"]')
    expect(summaryRow).not.toBeNull()

    const ageCell = summaryRow!.querySelector('[data-iris-table-cell="age"]')
    expect(ageCell?.textContent).toBe(String(ageSum))
    expect(ageCell?.getAttribute('data-iris-table-summary-cell')).toBe('')

    const nameCell = summaryRow!.querySelector('[data-iris-table-cell="name"]')
    expect(nameCell?.textContent).toBe('')
    expect(nameCell?.hasAttribute('data-iris-table-summary-cell')).toBe(false)
  })

  it('renderSummary formats the aggregated value', () => {
    const formattedCols: IrisTableColumn[] = [
      { key: 'name', title: 'Name' },
      {
        key: 'age',
        title: 'Age',
        summary: 'sum',
        renderSummary: (value) => `Total: ${value}`,
      },
    ]
    const { container } = render(() => <IrisTable columns={formattedCols} data={data} />)
    const ageCell = container.querySelector(
      '[data-iris-table-row="summary"] [data-iris-table-cell="age"]',
    )
    expect(ageCell?.textContent).toBe(`Total: ${ageSum}`)
  })

  it('renders no summary row when no column declares one', () => {
    const { container } = render(() => <IrisTable columns={columns} data={data} />)
    expect(container.querySelector('[data-iris-table-row="summary"]')).toBeNull()
  })

  it('renders no summary row when data is empty', () => {
    const { container } = render(() => <IrisTable columns={summaryCols} data={[]} />)
    expect(container.querySelector('[data-iris-table-row="summary"]')).toBeNull()
  })
})

describe('IrisTable editable-cell validation', () => {
  type EditRow = { id: number; name: string }
  const editRows: EditRow[] = [{ id: 1, name: 'Charlie' }]
  const validatedCols: IrisTableColumn<EditRow>[] = [
    {
      key: 'name',
      title: 'Name',
      editable: true,
      validate: (v) => (String(v).trim() === '' ? 'Name is required' : null),
    },
  ]

  function nameCell(): HTMLElement {
    return document.querySelector('[data-iris-table-cell="name"]') as HTMLElement
  }
  function editor(): HTMLInputElement | null {
    return document.querySelector('[data-iris-table-editor]')
  }

  it('a failing validator blocks the commit, keeps the editor open, and shows the error', () => {
    const onCellEdit = vi.fn()
    render(() => <IrisTable columns={validatedCols} data={editRows} onCellEdit={onCellEdit} />)
    fireEvent.dblClick(nameCell())
    expect(editor()).not.toBeNull()
    fireEvent.input(editor()!, { target: { value: '   ' } })
    fireEvent.keyDown(editor()!, { key: 'Enter' })
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(editor()).not.toBeNull() // stays open
    expect(editor()!.getAttribute('aria-invalid')).toBe('true')
    const err = document.querySelector('[data-iris-table-editor-error]')
    expect(err?.textContent).toBe('Name is required')
    expect(err?.getAttribute('role')).toBe('alert')
    expect(editor()!.getAttribute('aria-describedby')).toBe(err?.id)
  })

  it('correcting the value clears the error and commits', () => {
    const onCellEdit = vi.fn()
    render(() => <IrisTable columns={validatedCols} data={editRows} onCellEdit={onCellEdit} />)
    fireEvent.dblClick(nameCell())
    fireEvent.input(editor()!, { target: { value: '' } })
    fireEvent.keyDown(editor()!, { key: 'Enter' })
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(document.querySelector('[data-iris-table-editor-error]')).not.toBeNull()
    fireEvent.input(editor()!, { target: { value: 'Valid Name' } })
    fireEvent.keyDown(editor()!, { key: 'Enter' })
    expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ newValue: 'Valid Name' }))
    expect(editor()).toBeNull()
    expect(document.querySelector('[data-iris-table-editor-error]')).toBeNull()
  })

  it('Escape cancels even while an error is showing', () => {
    const onCellEdit = vi.fn()
    render(() => <IrisTable columns={validatedCols} data={editRows} onCellEdit={onCellEdit} />)
    fireEvent.dblClick(nameCell())
    fireEvent.input(editor()!, { target: { value: '' } })
    fireEvent.keyDown(editor()!, { key: 'Enter' })
    expect(editor()).not.toBeNull()
    expect(document.querySelector('[data-iris-table-editor-error]')).not.toBeNull()
    fireEvent.keyDown(editor()!, { key: 'Escape' })
    expect(editor()).toBeNull()
    expect(onCellEdit).not.toHaveBeenCalled()
  })
})

describe('IrisTable expandable detail rows', () => {
  type DetailRow = { id: number; name: string; age: number }
  const detailRows: DetailRow[] = [
    { id: 1, name: 'Alice', age: 30 },
    { id: 2, name: 'Bob', age: 25 },
    { id: 3, name: 'Charlie', age: 35 },
  ]
  const detailCols: IrisTableColumn<DetailRow>[] = [
    { key: 'name', title: 'Name' },
    { key: 'age', title: 'Age' },
  ]
  const renderDetail = (row: DetailRow): JSX.Element => (
    <span data-testid="detail">Detail for {row.name}</span>
  )

  it('renders an expand toggle per row, no detail panel by default, aria-expanded="false"', () => {
    const { container } = render(() => (
      <IrisTable columns={detailCols} data={detailRows} renderDetail={renderDetail} />
    ))
    const toggles = container.querySelectorAll('[data-iris-table-expand-toggle]')
    expect(toggles).toHaveLength(detailRows.length)
    expect(container.querySelector('[data-iris-table-header="__expand"]')).not.toBeNull()
    expect(container.querySelector('[data-iris-table-row-detail]')).toBeNull()
    toggles.forEach((t) => expect(t.getAttribute('aria-expanded')).toBe('false'))
  })

  it('clicking the toggle reveals/hides the detail panel and flips aria-expanded', () => {
    const { container } = render(() => (
      <IrisTable columns={detailCols} data={detailRows} renderDetail={renderDetail} />
    ))
    const firstToggle = (): HTMLButtonElement =>
      container.querySelector('[data-iris-table-expand-toggle]') as HTMLButtonElement

    fireEvent.click(firstToggle())
    const detail = container.querySelector('[data-iris-table-row-detail="1"]')
    expect(detail).not.toBeNull()
    expect(detail!.querySelector('[data-iris-table-detail-cell]')?.textContent).toBe(
      'Detail for Alice',
    )
    expect(firstToggle().getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(firstToggle())
    expect(container.querySelector('[data-iris-table-row-detail="1"]')).toBeNull()
    expect(firstToggle().getAttribute('aria-expanded')).toBe('false')
  })

  it('rowExpandable gates which rows get a toggle', () => {
    const { container } = render(() => (
      <IrisTable
        columns={detailCols}
        data={detailRows}
        renderDetail={renderDetail}
        rowExpandable={(row) => row.name !== 'Bob'}
      />
    ))
    // Three expand cells (leading column) but only two toggles.
    expect(container.querySelectorAll('[data-iris-table-cell="__expand"]')).toHaveLength(3)
    expect(container.querySelectorAll('[data-iris-table-expand-toggle]')).toHaveLength(2)
  })

  it('defaultExpandedRowKeys starts expanded and onExpandedRowsChange fires with string keys', () => {
    const onExpandedRowsChange = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={detailCols}
        data={detailRows}
        renderDetail={renderDetail}
        defaultExpandedRowKeys={[2]}
        onExpandedRowsChange={onExpandedRowsChange}
      />
    ))
    expect(container.querySelector('[data-iris-table-row-detail="2"]')).not.toBeNull()

    // Expanding row 1 calls onChange with both keys as strings.
    const firstToggle = container.querySelector(
      '[data-iris-table-expand-toggle]',
    ) as HTMLButtonElement
    fireEvent.click(firstToggle)
    expect(onExpandedRowsChange).toHaveBeenLastCalledWith(['2', '1'])
  })

  it('renders no __expand column when renderDetail is absent', () => {
    const { container } = render(() => <IrisTable columns={detailCols} data={detailRows} />)
    expect(container.querySelector('[data-iris-table-header="__expand"]')).toBeNull()
    expect(container.querySelector('[data-iris-table-cell="__expand"]')).toBeNull()
    expect(container.querySelector('[data-iris-table-expand-toggle]')).toBeNull()
  })
})

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

describe('IrisTable multi-level (grouped) headers', () => {
  const groupedCols: IrisTableColumn[] = [
    { key: 'name', title: 'Name' },
    {
      key: 'info',
      title: 'Info',
      children: [
        { key: 'age', title: 'Age', sortable: true },
        { key: 'id', title: 'ID' },
      ],
    },
  ]
  function header(key: string): HTMLElement | null {
    return document.querySelector(`[data-iris-table-header="${key}"]`)
  }

  it('flat columns render a non-grouped header (unchanged)', () => {
    const { container } = render(() => <IrisTable columns={columns} data={data} />)
    expect(container.querySelector('[data-iris-table-header-grouped]')).toBeNull()
  })

  it('a column with children renders a grouped header with span attrs', () => {
    const { container } = render(() => <IrisTable columns={groupedCols} data={data} />)
    expect(container.querySelector('[data-iris-table-header-grouped]')).not.toBeNull()
    // The group cell spans its 2 leaves and is marked as a group.
    const group = header('info')!
    expect(group.getAttribute('aria-colspan')).toBe('2')
    expect(group.getAttribute('data-iris-table-header-group')).toBe('')
    // Leaf header cells exist and the group's leaves are NOT marked as a group.
    expect(header('age')!.getAttribute('data-iris-table-header-group')).toBeNull()
    expect(header('id')).not.toBeNull()
  })

  it('the body renders the LEAF columns (group is header-only)', () => {
    const { container } = render(() => <IrisTable columns={groupedCols} data={data} />)
    // 3 leaf columns × 3 rows of body cells (name, age, id); no "info" data cell.
    expect(container.querySelectorAll('[data-iris-table-cell="age"]').length).toBe(3)
    expect(container.querySelectorAll('[data-iris-table-cell="id"]').length).toBe(3)
    expect(container.querySelector('[data-iris-table-cell="info"]')).toBeNull()
  })

  it('a sortable leaf inside a group still sorts', () => {
    const onSortChange = vi.fn()
    render(() => <IrisTable columns={groupedCols} data={data} onSortChange={onSortChange} />)
    fireEvent.click(header('age')!)
    expect(onSortChange).toHaveBeenLastCalledWith({ key: 'age', direction: 'asc' })
  })
})

describe('IrisTable grid keyboard navigation', () => {
  function cellAt(r: number, c: number): HTMLElement | null {
    return document.querySelector(`[data-grid-row="${r}"][data-grid-col="${c}"]`)
  }

  it('is off by default: role=table, no grid coords', () => {
    render(() => <IrisTable columns={columns} data={data} />)
    expect(document.querySelector('[role=grid]')).toBeNull()
    expect(document.querySelector('[role=table]')).not.toBeNull()
    expect(cellAt(0, 0)).toBeNull()
  })

  it('opt-in makes the table a grid with roving cell tabindex', () => {
    render(() => <IrisTable columns={columns} data={data} keyboardNavigation />)
    expect(document.querySelector('[role=grid]')).not.toBeNull()
    expect(cellAt(0, 0)!.getAttribute('tabindex')).toBe('0') // first cell focusable
    expect(cellAt(0, 1)!.getAttribute('tabindex')).toBe('-1')
  })

  it('container role upgrades to treegrid only for a keyboard-navigable tree', () => {
    interface TRow extends Record<string, unknown> {
      id: number
      name: string
      children?: TRow[]
    }
    const tCols: IrisTableColumn<TRow>[] = [{ key: 'name', title: 'Name' }]
    const tData: TRow[] = [{ id: 1, name: 'Root', children: [{ id: 2, name: 'Child' }] }]
    // tree + keyboardNavigation → treegrid.
    const treeKbd = render(() => (
      <IrisTable columns={tCols} data={tData} getSubRows={(r) => r.children} keyboardNavigation />
    ))
    expect(treeKbd.container.querySelector('[data-iris-table]')?.getAttribute('role')).toBe(
      'treegrid',
    )
    treeKbd.unmount()
    // non-tree + keyboardNavigation → grid (unchanged).
    const flatKbd = render(() => <IrisTable columns={columns} data={data} keyboardNavigation />)
    expect(flatKbd.container.querySelector('[data-iris-table]')?.getAttribute('role')).toBe('grid')
    flatKbd.unmount()
    // tree WITHOUT keyboardNavigation → table (no managed cell focus).
    const treeOnly = render(() => (
      <IrisTable columns={tCols} data={tData} getSubRows={(r) => r.children} />
    ))
    expect(treeOnly.container.querySelector('[data-iris-table]')?.getAttribute('role')).toBe(
      'table',
    )
  })

  it('ArrowRight / ArrowDown move the focused cell and roving tabindex', () => {
    render(() => <IrisTable columns={columns} data={data} keyboardNavigation />)
    cellAt(0, 0)!.focus()
    // Fire on the CELL so the event bubbles to the root handler with the cell as
    // target (target carries data-grid-row); firing on the root makes target=root.
    fireEvent.keyDown(cellAt(0, 0)!, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(cellAt(0, 1))
    expect(cellAt(0, 1)!.getAttribute('tabindex')).toBe('0')
    expect(cellAt(0, 0)!.getAttribute('tabindex')).toBe('-1')
    fireEvent.keyDown(cellAt(0, 1)!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(cellAt(1, 1))
  })

  it('does not move past an edge (no wrap)', () => {
    render(() => <IrisTable columns={columns} data={data} keyboardNavigation />)
    cellAt(0, 0)!.focus()
    fireEvent.keyDown(cellAt(0, 0)!, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(cellAt(0, 0)) // stayed
  })

  it('End jumps to the last column of the row', () => {
    render(() => <IrisTable columns={columns} data={data} keyboardNavigation />)
    cellAt(0, 0)!.focus()
    fireEvent.keyDown(cellAt(0, 0)!, { key: 'End' })
    expect(document.activeElement).toBe(cellAt(0, 1)) // 2 columns → last is col 1
  })
})

describe('IrisTable virtual scroll', () => {
  interface VRow extends Record<string, unknown> {
    id: number
    name: string
    children?: VRow[]
  }
  const vcols: IrisTableColumn<VRow>[] = [{ key: 'name', title: 'Name' }]
  const rowEls = (): Element[] => Array.from(document.querySelectorAll('[data-iris-table-row=""]'))

  it('renders the body inside a virtual scroller that windows the rows', () => {
    const many: VRow[] = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `N${i}` }))
    render(() => (
      <IrisTable columns={vcols} data={many} virtualScroll={{ itemHeight: 36, height: 200 }} />
    ))
    expect(document.querySelector('[data-iris-virtual-scroll]')).not.toBeNull()
    const count = rowEls().length
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(50)
  })

  it('virtualizes tree mode (uniform-height rows) with tree decoration intact', () => {
    const tree: VRow[] = [
      {
        id: 1,
        name: 'Root',
        children: Array.from({ length: 40 }, (_, i) => ({ id: 100 + i, name: `C${i}` })),
      },
    ]
    render(() => (
      <IrisTable
        columns={vcols}
        data={tree}
        getSubRows={(r) => r.children}
        defaultExpandedRowKeys={[1]}
        virtualScroll={{ itemHeight: 36, height: 200 }}
      />
    ))
    // Tree mode now uses the virtual scroller (was previously excluded).
    expect(document.querySelector('[data-iris-virtual-scroll]')).not.toBeNull()
    // Tree meta still flows into the virtualized rows (the parent toggle renders).
    expect(document.querySelector('[data-iris-table-tree-toggle]')).not.toBeNull()
    // Windowed: far fewer than the 41 total rows are in the DOM.
    expect(rowEls().length).toBeLessThan(41)
  })

  it('does NOT virtualize tree mode when renderDetail is set (variable-height rows)', () => {
    const tree: VRow[] = [{ id: 1, name: 'Root', children: [{ id: 2, name: 'C' }] }]
    render(() => (
      <IrisTable
        columns={vcols}
        data={tree}
        getSubRows={(r) => r.children}
        renderDetail={(r) => <div>d{(r as VRow).id}</div>}
        virtualScroll={{ itemHeight: 36, height: 200 }}
      />
    ))
    expect(document.querySelector('[data-iris-virtual-scroll]')).toBeNull()
  })
})

describe('IrisTable column virtualization', () => {
  const wideCols: IrisTableColumn<Record<string, unknown>>[] = Array.from(
    { length: 8 },
    (_, i) => ({
      key: `c${i}`,
      title: `C${i}`,
      width: 120,
    }),
  )
  const wideRows: Record<string, unknown>[] = [
    Object.fromEntries([['id', 1], ...wideCols.map((c) => [c.key, `${c.key}-v`])]),
  ]

  it('renders every column when disabled (default)', () => {
    render(() => <IrisTable columns={wideCols} data={wideRows} />)
    expect(document.querySelectorAll('[data-iris-table-header]').length).toBe(8)
  })

  it('renders only a window of columns when enabled', () => {
    render(() => <IrisTable columns={wideCols} data={wideRows} columnVirtualization />)
    const headerCount = document.querySelectorAll('[data-iris-table-header]').length
    expect(headerCount).toBeGreaterThan(0)
    expect(headerCount).toBeLessThan(8)
    expect(document.querySelector('[data-iris-table][data-column-virtualized=true]')).not.toBeNull()
    // Rendered header cells carry an explicit grid track.
    const first = document.querySelector('[data-iris-table-header]') as HTMLElement
    expect(first.style.gridColumnStart).toBeTruthy()
  })

  it('always renders pinned columns even when out of the window', () => {
    const cols = wideCols.map((c, i) => (i === 7 ? { ...c, pinned: 'right' as const } : c))
    render(() => <IrisTable columns={cols} data={wideRows} columnVirtualization />)
    // The far pinned column (index 7) renders despite being outside the window.
    expect(document.querySelector('[data-iris-table-header="c7"]')).not.toBeNull()
  })
})
