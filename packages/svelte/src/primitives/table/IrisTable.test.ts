import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
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
