import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, createEvent, cleanup, waitFor } from '@testing-library/svelte'
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

describe('IrisTable', () => {
  it('renders without crashing', () => {
    const { container } = render(IrisTable, { props: { columns, data } })
    expect(container).toBeTruthy()
  })

  it('renders column headers', () => {
    const { container } = render(IrisTable, { props: { columns, data } })
    const headers = container.querySelectorAll('[role="columnheader"]')
    expect(headers.length).toBe(2)
    expect(headers[0].textContent?.trim()).toContain('Name')
    expect(headers[1].textContent?.trim()).toContain('Age')
  })

  it('renders data rows', () => {
    const { container } = render(IrisTable, { props: { columns, data } })
    const rows = container.querySelectorAll('[data-iris-table-row]')
    expect(rows.length).toBe(3)
  })

  it('resolves string, number, missing/null, and numeric edge-case row keys', () => {
    const keyRows: Array<Record<string, unknown>> = [
      { key: 'alpha', label: 'Alpha' },
      { key: 0, label: 'Zero' },
      { label: 'Missing' },
      { key: null, label: 'Null' },
      { key: Number.NaN, label: 'NaN' },
      { key: '', label: 'Empty' },
    ]
    const { container } = render(IrisTable, {
      props: {
        columns: [{ key: 'label', title: 'Label' }],
        data: keyRows,
        rowKey: 'key',
      },
    })
    expect(
      Array.from(container.querySelectorAll<HTMLElement>('[data-iris-table-row-key]')).map((row) =>
        row.getAttribute('data-iris-table-row-key'),
      ),
    ).toEqual(['alpha', '0', '2', '3', 'NaN', ''])
  })

  it('controlled sort re-bases after a rejected callback', async () => {
    const onUpdateSort = vi.fn()
    const { container } = render(IrisTable, {
      props: { columns, data, sort: null, onUpdateSort },
    })
    const nameHeader = container.querySelector('[data-iris-table-header="name"]')!
    await fireEvent.click(nameHeader)
    await fireEvent.click(nameHeader)
    flushSync()
    expect(onUpdateSort).toHaveBeenLastCalledWith({ key: 'name', direction: 'asc' })
  })

  it('shows loading state', () => {
    const { container } = render(IrisTable, { props: { columns, data: [], loading: true } })
    expect(container.querySelector('[data-iris-table-row="loading"]')).not.toBeNull()
  })

  it('shows empty state', () => {
    const { container } = render(IrisTable, { props: { columns, data: [] } })
    expect(container.querySelector('[data-iris-table-row="empty"]')).not.toBeNull()
  })

  it('shows error state', () => {
    const { container } = render(IrisTable, { props: { columns, data: [], error: true } })
    expect(container.querySelector('[data-iris-table-row="error"]')).not.toBeNull()
  })

  it('fires onRowClick', async () => {
    const onRowClick = vi.fn()
    const { container } = render(IrisTable, { props: { columns, data, onRowClick } })
    const rows = container.querySelectorAll('[data-iris-table-row]')
    await fireEvent.click(rows[0])
    expect(onRowClick).toHaveBeenCalledTimes(1)
  })

  it('sorts ascending on header click for sortable column', async () => {
    const onUpdateSort = vi.fn()
    const { container } = render(IrisTable, { props: { columns, data, onUpdateSort } })
    const nameHeader = container.querySelector('[data-iris-table-header="name"]')!
    await fireEvent.click(nameHeader)
    expect(onUpdateSort).toHaveBeenCalledWith({ key: 'name', direction: 'asc' })
  })
})

describe('IrisTable inline-edit validation', () => {
  const validatedCols = [
    {
      key: 'name',
      title: 'Name',
      editable: true,
      validate: (v: unknown) => (String(v).trim() === '' ? 'Name is required' : null),
    },
    { key: 'age', title: 'Age' },
  ]

  function cell(container: HTMLElement, rowIdx: number, key: string): HTMLElement {
    const rows = container.querySelectorAll('[data-iris-table-body] [data-iris-table-row]')
    return rows[rowIdx].querySelector(`[data-iris-table-cell="${key}"]`) as HTMLElement
  }
  function editor(container: HTMLElement): HTMLInputElement | null {
    return container.querySelector('[data-iris-table-editor]')
  }

  it('a failing validator blocks the commit, keeps the editor open, and shows the error', async () => {
    const onCellEdit = vi.fn()
    const { container } = render(IrisTable, {
      props: { columns: validatedCols, data, onCellEdit },
    })
    await fireEvent.dblClick(cell(container, 0, 'name'))
    await fireEvent.input(editor(container)!, { target: { value: '   ' } })
    await fireEvent.keyDown(editor(container)!, { key: 'Enter' })

    expect(onCellEdit).not.toHaveBeenCalled()
    expect(editor(container)).not.toBeNull() // stays open
    expect(editor(container)!.getAttribute('aria-invalid')).toBe('true')
    const err = container.querySelector('[data-iris-table-editor-error]')
    expect(err?.textContent).toBe('Name is required')
    expect(err?.getAttribute('role')).toBe('alert')
    expect(editor(container)!.getAttribute('aria-describedby')).toBe(err?.id)
  })

  it('correcting the value clears the error and commits', async () => {
    const onCellEdit = vi.fn()
    const { container } = render(IrisTable, {
      props: { columns: validatedCols, data, onCellEdit },
    })
    await fireEvent.dblClick(cell(container, 0, 'name'))
    await fireEvent.input(editor(container)!, { target: { value: '' } })
    await fireEvent.keyDown(editor(container)!, { key: 'Enter' })
    expect(onCellEdit).not.toHaveBeenCalled()

    await fireEvent.input(editor(container)!, { target: { value: 'Valid Name' } })
    await fireEvent.keyDown(editor(container)!, { key: 'Enter' })

    expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ newValue: 'Valid Name' }))
    expect(editor(container)).toBeNull()
    expect(container.querySelector('[data-iris-table-editor-error]')).toBeNull()
  })

  it('Escape cancels even while an error is showing', async () => {
    const onCellEdit = vi.fn()
    const { container } = render(IrisTable, {
      props: { columns: validatedCols, data, onCellEdit },
    })
    await fireEvent.dblClick(cell(container, 0, 'name'))
    await fireEvent.input(editor(container)!, { target: { value: '' } })
    await fireEvent.keyDown(editor(container)!, { key: 'Enter' })
    expect(editor(container)).not.toBeNull()

    await fireEvent.keyDown(editor(container)!, { key: 'Escape' })

    expect(editor(container)).toBeNull()
    expect(onCellEdit).not.toHaveBeenCalled()
  })
})

describe('IrisTable summary/footer row', () => {
  // Aggregate computed from the fixture: ages 30 + 25 + 35.
  const expectedSum = data.reduce((n, r) => n + (r.age as number), 0)

  it('renders a summary row; the summary column shows the aggregate, non-summary cell is blank', () => {
    const summaryCols = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age', summary: 'sum' as const },
    ]
    const { container } = render(IrisTable, { props: { columns: summaryCols, data } })
    const summaryRow = container.querySelector('[data-iris-table-row="summary"]')
    expect(summaryRow).not.toBeNull()

    const ageCell = summaryRow!.querySelector('[data-iris-table-cell="age"]') as HTMLElement
    expect(ageCell.textContent?.trim()).toBe(String(expectedSum))
    expect(ageCell.getAttribute('data-iris-table-summary-cell')).toBe('')

    const nameCell = summaryRow!.querySelector('[data-iris-table-cell="name"]') as HTMLElement
    expect(nameCell.textContent?.trim()).toBe('')
    expect(nameCell.hasAttribute('data-iris-table-summary-cell')).toBe(false)
  })

  it('renderSummary formats the aggregated value', () => {
    const summaryCols = [
      { key: 'name', title: 'Name' },
      {
        key: 'age',
        title: 'Age',
        summary: 'sum' as const,
        renderSummary: (value: number) => `Σ ${value}`,
      },
    ]
    const { container } = render(IrisTable, { props: { columns: summaryCols, data } })
    const ageCell = container.querySelector(
      '[data-iris-table-row="summary"] [data-iris-table-cell="age"]',
    ) as HTMLElement
    expect(ageCell.textContent?.trim()).toBe(`Σ ${expectedSum}`)
  })

  it('preserves null and zero aggregate semantics through a custom callback', () => {
    const edgeRows = [
      { id: 10, name: 'Null', age: null },
      { id: 11, name: 'Zero', age: 0 },
      { id: 12, name: 'String', age: '2' },
    ]
    const renderSummary = vi.fn((value: number) => `Σ${value}`)
    const { container } = render(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name' },
          { key: 'age', title: 'Age', summary: 'sum', renderSummary },
        ],
        data: edgeRows,
      },
    })
    expect(
      container.querySelector('[data-iris-table-row="summary"] [data-iris-table-cell="age"]')
        ?.textContent,
    ).toBe('Σ2')
    expect(renderSummary).toHaveBeenCalledWith(2, edgeRows)
  })

  it('uses the remote page rows for summary values, including zero', async () => {
    const query = vi.fn(async () => ({ rows: [{ id: 90, name: 'Remote', age: 0 }], total: 10 }))
    const { container } = render(IrisTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name' },
          { key: 'age', title: 'Age', summary: 'sum' as const },
        ],
        data: [],
        rowKey: 'id',
        proxyConfig: { query },
      },
    })
    await waitFor(() =>
      expect(
        container.querySelector('[data-iris-table-row="summary"] [data-iris-table-cell="age"]')
          ?.textContent,
      ).toBe('0'),
    )
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('renders no summary row when no column declares one', () => {
    const summaryCols = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age' },
    ]
    const { container } = render(IrisTable, { props: { columns: summaryCols, data } })
    expect(container.querySelector('[data-iris-table-row="summary"]')).toBeNull()
  })

  it('renders no summary row when data is empty', () => {
    const summaryCols = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age', summary: 'sum' as const },
    ]
    const { container } = render(IrisTable, { props: { columns: summaryCols, data: [] } })
    expect(container.querySelector('[data-iris-table-row="summary"]')).toBeNull()
  })
})

describe('IrisTable expandable detail rows', () => {
  // Fixture rows have keys 1, 2, 3 (the `id` field). Detail rows carry the key
  // via [data-iris-table-row-detail]; the svelte body rows carry no key
  // attribute, so toggles are indexed by fixture order.
  function toggleAt(container: HTMLElement, index: number): HTMLElement {
    const rows = container.querySelectorAll('[data-iris-table-body] [data-iris-table-row]')
    return rows[index].querySelector('[data-iris-table-expand-toggle]') as HTMLElement
  }
  function detail(container: HTMLElement, rowId: string | number): HTMLElement | null {
    return container.querySelector(`[data-iris-table-row-detail="${rowId}"]`)
  }

  const renderDetail = (r: Record<string, unknown>) => `detail-${r.id}`

  it('renders an expand toggle per row and no detail panel by default; aria-expanded=false', () => {
    const { container } = render(IrisTable, { props: { columns, data, renderDetail } })
    expect(container.querySelectorAll('[data-iris-table-expand-toggle]').length).toBe(3)
    expect(detail(container, 1)).toBeNull()
    expect(toggleAt(container, 0).getAttribute('aria-expanded')).toBe('false')
  })

  it('clicking the toggle reveals the detail panel with content, clicking again hides it', async () => {
    const { container } = render(IrisTable, { props: { columns, data, renderDetail } })
    await fireEvent.click(toggleAt(container, 0))
    expect(detail(container, 1)).not.toBeNull()
    expect(detail(container, 1)!.textContent?.trim()).toBe('detail-1')
    expect(toggleAt(container, 0).getAttribute('aria-expanded')).toBe('true')
    await fireEvent.click(toggleAt(container, 0))
    expect(detail(container, 1)).toBeNull()
  })

  it('rowExpandable gates which rows get a toggle', () => {
    const { container } = render(IrisTable, {
      props: {
        columns,
        data,
        renderDetail,
        rowExpandable: (r: Record<string, unknown>) => r.id !== 2,
      },
    })
    const rows = container.querySelectorAll('[data-iris-table-body] [data-iris-table-row]')
    expect(rows[0].querySelector('[data-iris-table-expand-toggle]')).not.toBeNull()
    expect(rows[1].querySelector('[data-iris-table-expand-toggle]')).toBeNull() // row 2 not expandable
    expect(rows[2].querySelector('[data-iris-table-expand-toggle]')).not.toBeNull()
  })

  it('defaultExpandedRowKeys starts expanded; onExpandedRowsChange fires with string keys on toggle', async () => {
    const onExpandedRowsChange = vi.fn()
    const { container } = render(IrisTable, {
      props: {
        columns,
        data,
        renderDetail,
        defaultExpandedRowKeys: [1],
        onExpandedRowsChange,
      },
    })
    expect(detail(container, 1)).not.toBeNull()
    await fireEvent.click(toggleAt(container, 1)) // toggle row 2
    expect(onExpandedRowsChange).toHaveBeenLastCalledWith(['1', '2'])
    expect(detail(container, 2)).not.toBeNull()
  })

  it('no __expand column when renderDetail is absent', () => {
    const { container } = render(IrisTable, { props: { columns, data } })
    expect(container.querySelector('[data-iris-table-cell="__expand"]')).toBeNull()
    expect(container.querySelector('[data-iris-table-header="__expand"]')).toBeNull()
  })
})

describe('IrisTable grid keyboard navigation', () => {
  // Fixture: 2 columns (name, age) × 3 rows from the shared `columns`/`data`.
  function cellAt(container: HTMLElement, r: number, c: number): HTMLElement | null {
    return container.querySelector(`[data-grid-row="${r}"][data-grid-col="${c}"]`)
  }

  it('is off by default: role=table, no grid coords', () => {
    const { container } = render(IrisTable, { props: { columns, data } })
    expect(container.querySelector('[role="grid"]')).toBeNull()
    expect(container.querySelector('[role="table"]')).not.toBeNull()
    expect(cellAt(container, 0, 0)).toBeNull()
  })

  it('opt-in makes the table a grid with roving cell tabindex', () => {
    const { container } = render(IrisTable, {
      props: { columns, data, keyboardNavigation: true },
    })
    expect(container.querySelector('[role="grid"]')).not.toBeNull()
    expect(cellAt(container, 0, 0)!.getAttribute('tabindex')).toBe('0') // first cell focusable
    expect(cellAt(container, 0, 1)!.getAttribute('tabindex')).toBe('-1')
  })

  it('ArrowRight / ArrowDown move the focused cell and roving tabindex', async () => {
    const { container } = render(IrisTable, {
      props: { columns, data, keyboardNavigation: true },
    })
    cellAt(container, 0, 0)!.focus()
    // Dispatch the keydown ON THE CELL so it bubbles to the root handler with
    // the cell as target (firing on the root would make target=root, which has
    // no data-grid-row and is correctly ignored).
    await fireEvent.keyDown(cellAt(container, 0, 0)!, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(cellAt(container, 0, 1))
    expect(cellAt(container, 0, 1)!.getAttribute('tabindex')).toBe('0')
    expect(cellAt(container, 0, 0)!.getAttribute('tabindex')).toBe('-1')
    await fireEvent.keyDown(cellAt(container, 0, 1)!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(cellAt(container, 1, 1))
  })

  it('does not move past an edge (no wrap)', async () => {
    const { container } = render(IrisTable, {
      props: { columns, data, keyboardNavigation: true },
    })
    cellAt(container, 0, 0)!.focus()
    await fireEvent.keyDown(cellAt(container, 0, 0)!, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(cellAt(container, 0, 0)) // stayed
  })

  it('End jumps to the last column of the row', async () => {
    const { container } = render(IrisTable, {
      props: { columns, data, keyboardNavigation: true },
    })
    cellAt(container, 0, 0)!.focus()
    await fireEvent.keyDown(cellAt(container, 0, 0)!, { key: 'End' })
    expect(document.activeElement).toBe(cellAt(container, 0, 1)) // 2 columns → last is col 1
  })
})

describe('IrisTable multi-level (grouped) headers', () => {
  // `info` is a header GROUP over two leaves (age, id); `name` stays flat. The
  // fixture rows carry name/age/id, so the body renders 3 leaf data columns.
  const groupedCols = [
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
  function header(container: HTMLElement, key: string): HTMLElement | null {
    return container.querySelector(`[data-iris-table-header="${key}"]`)
  }

  it('flat columns render a non-grouped header (unchanged)', () => {
    const { container } = render(IrisTable, { props: { columns, data } })
    expect(container.querySelector('[data-iris-table-header-grouped]')).toBeNull()
  })

  it('a column with children renders a grouped header with span attrs', () => {
    const { container } = render(IrisTable, { props: { columns: groupedCols, data } })
    expect(container.querySelector('[data-iris-table-header-grouped]')).not.toBeNull()
    // The group cell spans its 2 leaves and is marked as a group.
    const group = header(container, 'info')!
    expect(group.getAttribute('aria-colspan')).toBe('2')
    expect(group.getAttribute('data-iris-table-header-group')).toBe('')
    // Leaf header cells exist and the group's leaves are NOT marked as a group.
    expect(header(container, 'age')!.getAttribute('data-iris-table-header-group')).toBeNull()
    expect(header(container, 'id')).not.toBeNull()
  })

  it('the body renders the LEAF columns (group is header-only)', () => {
    const { container } = render(IrisTable, { props: { columns: groupedCols, data } })
    // 3 leaf columns × 3 rows of body cells (name, age, id); no "info" data cell.
    const bodyCell = (key: string) =>
      container.querySelectorAll(`[data-iris-table-body] [data-iris-table-cell="${key}"]`)
    expect(bodyCell('age').length).toBe(3)
    expect(bodyCell('id').length).toBe(3)
    expect(bodyCell('info').length).toBe(0)
  })

  it('a sortable leaf inside a group still sorts', async () => {
    const onUpdateSort = vi.fn()
    const { container } = render(IrisTable, {
      props: { columns: groupedCols, data, onUpdateSort },
    })
    await fireEvent.click(header(container, 'age')!)
    expect(onUpdateSort).toHaveBeenLastCalledWith({ key: 'age', direction: 'asc' })
  })
})

describe('IrisTable column virtualization', () => {
  // 8 fixed-width columns; with jsdom's clientWidth of 0 the visible window is a
  // small slice (start + overscan), so only a few of the 8 render when enabled.
  const wideCols = Array.from({ length: 8 }, (_, i) => ({
    key: `c${i}`,
    title: `C${i}`,
    width: 120,
  }))
  const wideRows = [Object.fromEntries([['id', 1], ...wideCols.map((c) => [c.key, `${c.key}-v`])])]

  it('renders every column when disabled (default)', () => {
    const { container } = render(IrisTable, { props: { columns: wideCols, data: wideRows } })
    expect(container.querySelectorAll('[data-iris-table-header]').length).toBe(8)
    // No virtualization marker / horizontal scroll attribute on the root.
    expect(container.querySelector('[data-iris-table][data-column-virtualized]')).toBeNull()
  })

  it('renders only a window of columns when enabled, marks the root, and tracks cells', () => {
    const { container } = render(IrisTable, {
      props: { columns: wideCols, data: wideRows, columnVirtualization: true },
    })
    const headerCount = container.querySelectorAll('[data-iris-table-header]').length
    expect(headerCount).toBeGreaterThan(0)
    expect(headerCount).toBeLessThan(8) // windowed — fewer than all 8
    expect(
      container.querySelector('[data-iris-table][data-column-virtualized="true"]'),
    ).not.toBeNull()
    // Body cells are windowed too (fewer than the 8 leaf columns).
    const bodyCells = container.querySelectorAll('[data-iris-table-body] [data-iris-table-cell]')
    expect(bodyCells.length).toBeGreaterThan(0)
    expect(bodyCells.length).toBeLessThan(8)
    // Rendered header cells carry an explicit grid track so they land correctly.
    const first = container.querySelector('[data-iris-table-header]') as HTMLElement
    expect(first.style.gridColumnStart).toBeTruthy()
  })

  it('always renders pinned columns even when out of the window', () => {
    const cols = wideCols.map((c, i) => (i === 7 ? { ...c, pinned: 'right' as const } : c))
    const { container } = render(IrisTable, {
      props: { columns: cols, data: wideRows, columnVirtualization: true },
    })
    // The far pinned column (index 7) renders despite being outside the window.
    expect(container.querySelector('[data-iris-table-header="c7"]')).not.toBeNull()
    expect(
      container.querySelector('[data-iris-table-body] [data-iris-table-cell="c7"]'),
    ).not.toBeNull()
  })
})

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

describe('IrisTable column resize', () => {
  // jsdom's PointerEvent drops clientX / button / pointerId from its init, so
  // build the event and define them explicitly to drive the useDrag handlers
  // (useDrag filters on button === 0 + matches the pointerId across the drag).
  async function dragPointer(
    node: Element,
    kind: 'pointerDown' | 'pointerMove' | 'pointerUp',
    clientX: number,
  ): Promise<void> {
    const ev = createEvent[kind](node)
    Object.defineProperty(ev, 'clientX', { value: clientX, configurable: true })
    Object.defineProperty(ev, 'button', { value: 0, configurable: true })
    Object.defineProperty(ev, 'pointerId', { value: 1, configurable: true })
    await fireEvent(node, ev)
  }

  const handle = (container: HTMLElement, key: string): HTMLElement | null =>
    container.querySelector(`[data-iris-table-resize-handle][data-column-key="${key}"]`)

  const gridCols = (container: HTMLElement): string =>
    (container.querySelector('[data-iris-table-header-row]') as HTMLElement).style
      .gridTemplateColumns

  it('renders no resize handles unless resizableColumns', () => {
    const { container } = render(IrisTable, { props: { columns, data } })
    expect(container.querySelectorAll('[data-iris-table-resize-handle]').length).toBe(0)
  })

  it('renders a separator handle per column when resizableColumns', () => {
    const { container } = render(IrisTable, {
      props: { columns, data, resizableColumns: true },
    })
    expect(container.querySelectorAll('[data-iris-table-resize-handle]').length).toBe(2)
    const h = handle(container, 'name')!
    expect(h.getAttribute('role')).toBe('slider')
    expect(h.getAttribute('aria-orientation')).toBe('horizontal')
  })

  it('ArrowRight grows the column width (uncontrolled)', async () => {
    const { container } = render(IrisTable, {
      props: { columns, data, resizableColumns: true, defaultColumnWidths: { name: 100 } },
    })
    expect(gridCols(container)).toContain('100px')
    await fireEvent.keyDown(handle(container, 'name')!, { key: 'ArrowRight' })
    flushSync()
    expect(gridCols(container)).toContain('116px')
  })

  it('ArrowLeft shrinks but clamps to the column minWidth', async () => {
    const cols = [
      { key: 'name', title: 'Name', minWidth: 90 },
      { key: 'age', title: 'Age' },
    ]
    const { container } = render(IrisTable, {
      props: { columns: cols, data, resizableColumns: true, defaultColumnWidths: { name: 100 } },
    })
    // 100 - 16 = 84 → clamp up to minWidth 90.
    await fireEvent.keyDown(handle(container, 'name')!, { key: 'ArrowLeft' })
    flushSync()
    expect(gridCols(container)).toContain('90px')
  })

  it('ArrowRight clamps to the column maxWidth', async () => {
    const cols = [
      { key: 'name', title: 'Name', maxWidth: 110 },
      { key: 'age', title: 'Age' },
    ]
    const { container } = render(IrisTable, {
      props: { columns: cols, data, resizableColumns: true, defaultColumnWidths: { name: 100 } },
    })
    // 100 + 16 = 116 → clamp down to maxWidth 110.
    await fireEvent.keyDown(handle(container, 'name')!, { key: 'ArrowRight' })
    flushSync()
    expect(gridCols(container)).toContain('110px')
  })

  it('onColumnWidthsChange fires with the new widths', async () => {
    const onColumnWidthsChange = vi.fn()
    const { container } = render(IrisTable, {
      props: {
        columns,
        data,
        resizableColumns: true,
        defaultColumnWidths: { name: 100 },
        onColumnWidthsChange,
      },
    })
    await fireEvent.keyDown(handle(container, 'name')!, { key: 'ArrowRight' })
    flushSync()
    expect(onColumnWidthsChange).toHaveBeenCalledWith({ name: 116 })
  })

  it('controlled columnWidths render the given widths', () => {
    const { container } = render(IrisTable, {
      props: { columns, data, resizableColumns: true, columnWidths: { name: 150, age: 80 } },
    })
    expect(gridCols(container)).toContain('150px')
    expect(gridCols(container)).toContain('80px')
  })

  it('clicking the resize handle does not trigger sort', async () => {
    const onUpdateSort = vi.fn()
    const { container } = render(IrisTable, {
      props: { columns, data, resizableColumns: true, onUpdateSort },
    })
    await fireEvent.click(handle(container, 'name')!)
    flushSync()
    expect(onUpdateSort).not.toHaveBeenCalled()
  })

  it('dragging the handle adjusts the column width + fires onColumnWidthsChange', async () => {
    const onColumnWidthsChange = vi.fn()
    const { container } = render(IrisTable, {
      props: {
        columns,
        data,
        resizableColumns: true,
        defaultColumnWidths: { name: 100 },
        onColumnWidthsChange,
      },
    })
    const h = handle(container, 'name')!
    await dragPointer(h, 'pointerDown', 0)
    await dragPointer(h, 'pointerMove', 40) // dx = 40 → 100 + 40 = 140
    await dragPointer(h, 'pointerUp', 40)
    flushSync()
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ name: 140 })
    expect(gridCols(container)).toContain('140px')
  })
})
