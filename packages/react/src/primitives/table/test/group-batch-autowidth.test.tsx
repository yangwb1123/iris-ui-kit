import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IrisTable } from '../index'
import type { IrisTableColumn } from '../types'

afterEach(cleanup)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  role: string
  score: number
}

const rows: Row[] = [
  { id: 1, name: 'Alice', role: 'Develop', score: 100 },
  { id: 2, name: 'Bob', role: 'Develop', score: 150 },
  { id: 3, name: 'Cara', role: 'QA', score: 80 },
  { id: 4, name: 'Dan', role: 'QA', score: 120 },
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'role', title: 'Role' },
  { key: 'score', title: 'Score' },
]

const groupCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'role', title: 'Role', groupBy: true },
  { key: 'score', title: 'Score', summary: 'sum' },
]

// ── 1. Auto width (batch M) ────────────────────────────────────────────────
describe('IrisTable width auto (batch M)', () => {
  it("renders a minmax(max-content, max-content) track for width: 'auto'", () => {
    const { container } = render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name', width: 'auto' },
          { key: 'age', title: 'Age' },
        ]}
        data={[{ id: 1, name: 'Ada', age: 30 }]}
        rowKey="id"
      />,
    )
    const header = container.querySelector('[data-iris-table-row="header"]') as HTMLElement
    expect(header.style.gridTemplateColumns).toContain('minmax(max-content, max-content)')
  })

  it('keeps plain string widths (and px numbers) untouched', () => {
    const { container } = render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name', width: '120px' },
          { key: 'age', title: 'Age', width: 80 },
        ]}
        data={[{ id: 1, name: 'Ada', age: 30 }]}
        rowKey="id"
      />,
    )
    const header = container.querySelector('[data-iris-table-row="header"]') as HTMLElement
    expect(header.style.gridTemplateColumns).toContain('120px')
    expect(header.style.gridTemplateColumns).toContain('80px')
  })
})

// ── 2. Batch toolbar button (batch M) ──────────────────────────────────────
describe('IrisTable toolbar.batch (batch M)', () => {
  it('appears with a multi selection and delivers the selected keys on click', () => {
    const onClick = vi.fn()
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        selectable="multi"
        toolbar={{ batch: { label: 'Delete', icon: '✕', onClick } }}
      />,
    )
    expect(container.querySelector('[data-iris-table-toolbar-batch]')).toBeNull()
    fireEvent.click(container.querySelector('[data-iris-table-row="2"] input[type="checkbox"]')!)
    fireEvent.click(container.querySelector('[data-iris-table-row="3"] input[type="checkbox"]')!)
    const btn = container.querySelector('[data-iris-table-toolbar-batch]')!
    expect(btn).not.toBeNull()
    expect(btn.textContent).toContain('Delete')
    expect(btn.textContent).toContain('✕')
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledWith([2, 3])
  })

  it('hides once the selection is empty', () => {
    const onClick = vi.fn()
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        selectable="multi"
        toolbar={{ batch: { label: 'Delete', onClick } }}
      />,
    )
    const box = container.querySelector('[data-iris-table-row="1"] input[type="checkbox"]')!
    fireEvent.click(box)
    expect(container.querySelector('[data-iris-table-toolbar-batch]')).not.toBeNull()
    fireEvent.click(box) // un-select
    expect(container.querySelector('[data-iris-table-toolbar-batch]')).toBeNull()
  })

  it('never renders in single-select mode', () => {
    const onClick = vi.fn()
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        selectable="single"
        toolbar={{ batch: { label: 'Delete', onClick } }}
      />,
    )
    fireEvent.click(container.querySelector('[data-iris-table-row="1"] input[type="checkbox"]')!)
    expect(container.querySelector('[data-iris-table-toolbar-batch]')).toBeNull()
    expect(onClick).not.toHaveBeenCalled()
  })
})

// ── 3. Group rows (batch M) ────────────────────────────────────────────────
describe('IrisTable groupBy (batch M)', () => {
  it('renders a group header per distinct value (first-appearance order) with count', () => {
    const { container } = render(<IrisTable columns={groupCols} data={rows} rowKey="id" />)
    const headers = container.querySelectorAll('[data-iris-group-row]')
    expect(headers.length).toBe(2)
    const values = container.querySelectorAll('[data-iris-group-value]')
    expect(values[0]!.textContent).toBe('Develop')
    expect(values[1]!.textContent).toBe('QA')
    const counts = container.querySelectorAll('[data-iris-group-count]')
    expect(counts[0]!.textContent).toBe('(2)')
    expect(counts[1]!.textContent).toBe('(2)')
  })

  it('keeps rows under their group header in original order', () => {
    const { container } = render(<IrisTable columns={groupCols} data={rows} rowKey="id" />)
    // Document order: header → its rows → its summary → next header → …
    const order = Array.from(
      container.querySelectorAll('[data-iris-group-row], [data-iris-table-row]'),
    ).map((el) =>
      el.hasAttribute('data-iris-group-row')
        ? `group:${el.getAttribute('data-iris-group-key')}`
        : `row:${el.getAttribute('data-iris-table-row')}`,
    )
    expect(order).toEqual([
      'row:header',
      'group:Develop',
      'row:1',
      'row:2',
      'row:summary',
      'group:QA',
      'row:3',
      'row:4',
      'row:summary',
      'row:summary', // global footer (no data-iris-group-summary)
    ])
  })

  it('computes per-group summary with the same ops as the footer', () => {
    const { container } = render(<IrisTable columns={groupCols} data={rows} rowKey="id" />)
    const groupSummaries = container.querySelectorAll('[data-iris-group-summary]')
    expect(groupSummaries.length).toBe(2)
    const cells = container.querySelectorAll(
      '[data-iris-group-summary] [data-iris-table-summary-cell]',
    )
    expect(cells[0]!.textContent).toBe('250') // Develop: 100 + 150
    expect(cells[1]!.textContent).toBe('200') // QA: 80 + 120
    // The global footer still aggregates the whole dataset (it is the LAST
    // summary row — the earlier ones are per-group summaries).
    const summaries = container.querySelectorAll('[data-iris-table-row="summary"]')
    const footer = summaries[summaries.length - 1]!
    expect(footer.hasAttribute('data-iris-group-summary')).toBe(false)
    expect(footer.querySelector('[data-iris-table-summary-cell]')!.textContent).toBe('450')
  })

  it('keeps selection working on grouped rows (keys unchanged)', () => {
    const onClick = vi.fn()
    const { container } = render(
      <IrisTable
        columns={groupCols}
        data={rows}
        rowKey="id"
        selectable="multi"
        toolbar={{ batch: { label: 'Delete', onClick } }}
      />,
    )
    fireEvent.click(container.querySelector('[data-iris-table-row="1"] input[type="checkbox"]')!)
    const row = container.querySelector('[data-iris-table-row="1"]')!
    expect(row.getAttribute('data-iris-table-row-selected')).toBe('true')
    // The batch button sees the grouped rows' selection.
    fireEvent.click(container.querySelector('[data-iris-table-toolbar-batch]')!)
    expect(onClick).toHaveBeenCalledWith([1])
  })

  it('without groupBy the body is unchanged (no group rows)', () => {
    const { container } = render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    expect(container.querySelectorAll('[data-iris-group-row]').length).toBe(0)
    const bodyRows = container.querySelectorAll('[data-iris-table-row]')
    // header + 4 data rows + (no summary: cols have none) = 5
    expect(bodyRows.length).toBe(5)
  })

  it('tree mode ignores grouping (fail-closed)', () => {
    const { container } = render(
      <IrisTable
        columns={groupCols}
        data={rows}
        rowKey="id"
        getSubRows={(row) =>
          row.id === 1 ? [{ id: 11, name: 'A1', role: 'Develop', score: 1 }] : undefined
        }
      />,
    )
    expect(container.querySelectorAll('[data-iris-group-row]').length).toBe(0)
  })

  it('groups after filtering (grouping applies to filtered rows only)', () => {
    const { container } = render(
      <IrisTable columns={groupCols} data={rows} rowKey="id" filters={{ role: 'QA' }} />,
    )
    const headers = container.querySelectorAll('[data-iris-group-row]')
    expect(headers.length).toBe(1)
    expect(container.querySelector('[data-iris-group-value]')!.textContent).toBe('QA')
  })
})
