import { describe, it, expect, afterEach, vi } from 'vitest'
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
