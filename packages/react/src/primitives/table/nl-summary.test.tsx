import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { summarizeColumn } from '@iris-ui-kit/core'
import { IrisTable } from './Table'
import type { IrisTableColumn, IrisTableContextMenuParams } from './types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  status: string
  score: number | null
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', status: 'active', score: 10 },
  { id: 2, name: 'Alice', status: 'paused', score: 20 },
  { id: 3, name: 'Bob', status: 'active', score: 30 },
  { id: 4, name: 'Dana', status: 'active', score: null },
  { id: 5, name: 'Erin', status: 'offline', score: 5 },
]

const summaryCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'status', title: 'Status' },
  { key: 'score', title: 'Score' },
]

function cell(rowId: string | number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}
function contextMenu(): HTMLElement | null {
  return document.querySelector('[data-iris-table-context-menu]')
}
function summaryPanel(): HTMLElement | null {
  return document.querySelector('[data-iris-summary-panel]')
}

describe('@iris-ui-kit/core summarizeColumn (batch AW, iris 独有)', () => {
  it('numeric column: count / range / average / missing sentence', () => {
    // 4 of 5 non-empty are numeric (score null excluded) → numeric branch.
    const s = summarizeColumn(
      rows.map((r) => r.score),
      'Score',
    )
    expect(s).toBe('Score：共 4 个值，范围 5.0–30.0，平均 16.3，1 个缺失')
  })

  it('categorical column: top-3 shares with Math.round percentages', () => {
    const s = summarizeColumn(
      rows.map((r) => r.status),
      'Status',
    )
    // active ×3 = 60%, paused/offline 20% each, exactly 3 distinct → no fold.
    expect(s).toBe('Status：60% active，20% paused，20% offline')
  })

  it('empty / all-missing column: 无数据', () => {
    expect(summarizeColumn([], 'Col')).toBe('Col：无数据')
    expect(summarizeColumn([null, undefined, ''], 'Col')).toBe('Col：无数据')
  })
})

describe('@iris-ui-kit/react IrisTable nlSummary (batch AW, iris 独有)', () => {
  function renderSummaryTable(onSelect: ReturnType<typeof vi.fn>): void {
    render(
      <IrisTable
        columns={summaryCols}
        data={rows}
        rowKey="id"
        valueDistribution
        nlSummary
        contextMenu={{
          items: (_params: IrisTableContextMenuParams<Row>) => [{ key: 'edit', label: 'Edit row' }],
          onSelect,
        }}
      />,
    )
  }

  it('the built-in item is appended AFTER the value-distribution item', () => {
    renderSummaryTable(vi.fn())
    fireEvent.contextMenu(cell(1, 'score'), { clientX: 120, clientY: 80 })
    const items = contextMenu()!.querySelectorAll('[data-iris-table-context-menu-item]')
    expect(items.length).toBe(3)
    expect(items[1]!.textContent).toBe('Value distribution')
    expect(items[1]!.getAttribute('data-iris-table-context-menu-item')).toBe('__iris_distribution')
    expect(items[2]!.textContent).toBe('Column summary')
    expect(items[2]!.getAttribute('data-iris-table-context-menu-item')).toBe('__iris-summary')
  })

  it('selecting the item opens the panel with the summary text (user callback untouched)', () => {
    const onSelect = vi.fn()
    renderSummaryTable(onSelect)
    fireEvent.contextMenu(cell(1, 'score'), { clientX: 80, clientY: 60 })
    fireEvent.click(document.querySelector('[data-iris-table-context-menu-item="__iris-summary"]')!)
    const panel = summaryPanel()
    expect(panel).not.toBeNull()
    expect(contextMenu()).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
    expect(panel!.getAttribute('data-iris-summary-column')).toBe('Score')
    const title = panel!.querySelector('[data-iris-summary-title]')!
    expect(title.textContent).toBe('Score')
    const text = panel!.querySelector('[data-iris-summary-text]')!
    expect(text.textContent).toBe('Score：共 4 个值，范围 5.0–30.0，平均 16.3，1 个缺失')
  })

  it('categorical column renders the top-3 summary in the panel', () => {
    renderSummaryTable(vi.fn())
    fireEvent.contextMenu(cell(1, 'status'), { clientX: 10, clientY: 10 })
    fireEvent.click(document.querySelector('[data-iris-table-context-menu-item="__iris-summary"]')!)
    const text = summaryPanel()!.querySelector('[data-iris-summary-text]')!
    expect(text.textContent).toBe('Status：60% active，20% paused，20% offline')
  })

  it('without nlSummary the built-in item is absent (inert)', () => {
    const onSelect = vi.fn()
    render(
      <IrisTable
        columns={summaryCols}
        data={rows}
        rowKey="id"
        contextMenu={{ items: () => [{ key: 'edit', label: 'Edit row' }], onSelect }}
      />,
    )
    fireEvent.contextMenu(cell(1, 'name'), { clientX: 10, clientY: 10 })
    const items = contextMenu()!.querySelectorAll('[data-iris-table-context-menu-item]')
    expect(items.length).toBe(1)
    expect(items[0]!.textContent).toBe('Edit row')
    expect(summaryPanel()).toBeNull()
  })

  it('valueDistribution without nlSummary keeps the old menu shape (summary absent)', () => {
    const onSelect = vi.fn()
    render(
      <IrisTable
        columns={summaryCols}
        data={rows}
        rowKey="id"
        valueDistribution
        contextMenu={{ items: () => [], onSelect }}
      />,
    )
    fireEvent.contextMenu(cell(1, 'name'), { clientX: 10, clientY: 10 })
    const items = contextMenu()!.querySelectorAll('[data-iris-table-context-menu-item]')
    expect(items.length).toBe(1)
    expect(items[0]!.getAttribute('data-iris-table-context-menu-item')).toBe('__iris_distribution')
  })

  it('a user item already using the reserved key is not duplicated', () => {
    const onSelect = vi.fn()
    render(
      <IrisTable
        columns={summaryCols}
        data={rows}
        rowKey="id"
        nlSummary
        contextMenu={{
          items: () => [{ key: '__iris-summary', label: 'Mine' }],
          onSelect,
        }}
      />,
    )
    fireEvent.contextMenu(cell(1, 'name'), { clientX: 10, clientY: 10 })
    const items = contextMenu()!.querySelectorAll('[data-iris-table-context-menu-item]')
    expect(items.length).toBe(1)
    expect(items[0]!.textContent).toBe('Mine')
    fireEvent.click(items[0]!)
    expect(summaryPanel()).not.toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('Escape closes the panel', () => {
    renderSummaryTable(vi.fn())
    fireEvent.contextMenu(cell(1, 'score'), { clientX: 10, clientY: 10 })
    fireEvent.click(document.querySelector('[data-iris-table-context-menu-item="__iris-summary"]')!)
    expect(summaryPanel()).not.toBeNull()
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(summaryPanel()).toBeNull()
  })

  it('dataIndex indirection: the summary reads the column dataIndex field', () => {
    render(
      <IrisTable
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'score', title: 'Score', dataIndex: 'points' },
        ]}
        data={rows.map((r) => ({ id: r.id, name: r.name, points: r.score }))}
        rowKey="id"
        nlSummary
        contextMenu={{ items: () => [], onSelect: vi.fn() }}
      />,
    )
    fireEvent.contextMenu(cell(1, 'score'), { clientX: 10, clientY: 10 })
    fireEvent.click(document.querySelector('[data-iris-table-context-menu-item="__iris-summary"]')!)
    const text = summaryPanel()!.querySelector('[data-iris-summary-text]')!
    expect(text.textContent).toBe('Score：共 4 个值，范围 5.0–30.0，平均 16.3，1 个缺失')
  })
})
