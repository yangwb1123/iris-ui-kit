import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createAuditLog, createPerfStats } from '@iris-ui-kit/core'
import { IrisTable } from './Table'
import { TablePerfPanel } from './PerfPanel'
import type { IrisTableColumn } from './types'
import type { IrisTableHandle } from './types'

afterEach(cleanup)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
  city: string
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25, city: 'Rome' },
  { id: 2, name: 'Alice', age: 32, city: 'Oslo' },
  { id: 3, name: 'Bob', age: 28, city: 'Lima' },
]

const editableCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'age', title: 'Age', editable: true },
]

const baseCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

// Grouped: 1 flat + 2 children = 3 leaf columns (leafColumns drives the
// perf panel's column count).
const groupedCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  {
    key: 'info',
    title: 'Info',
    children: [
      { key: 'age', title: 'Age' },
      { key: 'city', title: 'City' },
    ],
  },
]

function tableRef(): { current: IrisTableHandle<Row> | null } {
  return { current: null }
}

function cell(rowId: string | number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}

function editor(): HTMLInputElement | null {
  return document.querySelector('[data-iris-table-editor]')
}

function editCell(rowId: string | number, colKey: string, value: string): void {
  act(() => {
    fireEvent.doubleClick(cell(rowId, colKey))
  })
  act(() => {
    fireEvent.change(editor()!, { target: { value } })
    fireEvent.keyDown(editor()!, { key: 'Enter' })
  })
}

function perfTrigger(): HTMLElement | null {
  return document.querySelector('[data-iris-perf-trigger]')
}

function openPanel(): HTMLElement {
  fireEvent.click(perfTrigger()!)
  const panel = document.querySelector('[data-iris-perf-panel]') as HTMLElement
  expect(panel).not.toBeNull()
  return panel
}

function statRow(attr: string): HTMLElement | null {
  return document.querySelector(`[data-iris-perf-panel] [${attr}]`)
}

function statValue(attr: string): string {
  const row = statRow(attr)
  return row === null ? '' : (row.querySelector('[data-iris-perf-value]')?.textContent ?? '')
}

// ── Performance panel (iris 独有, batch BL) ────────────────────────────────
describe('IrisTable perfStats', () => {
  it('the trigger opens a panel showing a real render-commit sample', () => {
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" perfStats />)
    expect(perfTrigger()).not.toBeNull()
    const panel = openPanel()
    expect(panel).not.toBeNull()
    // A sample lands at mount (layout-effect push) — duration formatted.
    expect(statValue('data-iris-perf-duration')).toMatch(/^\d+\.\d ms$/)
    expect(panel.querySelector('[data-iris-perf-empty]')).toBeNull()
  })

  it('counts rows and leaf columns correctly (grouped children flatten)', () => {
    render(<IrisTable columns={groupedCols} data={rows} rowKey="id" perfStats />)
    openPanel()
    expect(statValue('data-iris-perf-rows')).toBe('3')
    // 1 flat + 2 children = 3 leaf columns, NOT the 2 top-level entries.
    expect(statValue('data-iris-perf-columns')).toBe('3')
  })

  it('changes = audit-trail depth when auditLog is on', () => {
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" auditLog perfStats />)
    editCell(1, 'name', 'Renamed')
    editCell(2, 'age', '33')
    openPanel()
    expect(statValue('data-iris-perf-changes')).toBe('2')
  })

  it('changes shows a muted — when auditLog is off', () => {
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" perfStats />)
    openPanel()
    expect(statRow('data-iris-perf-changes')!.textContent).toContain('—')
  })

  it('stays live while open: a commit bumps duration/changes without reopening', () => {
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" auditLog perfStats />)
    editCell(1, 'name', 'Renamed')
    openPanel()
    expect(statValue('data-iris-perf-changes')).toBe('1')
    editCell(2, 'age', '33')
    expect(statValue('data-iris-perf-changes')).toBe('2')
    expect(statValue('data-iris-perf-duration')).toMatch(/^\d+\.\d ms$/)
  })

  it('clearAuditLog via the handle refreshes the changes row in place (dual subscription)', () => {
    const r = tableRef()
    render(
      <IrisTable columns={editableCols} data={rows} rowKey="id" auditLog perfStats tableRef={r} />,
    )
    editCell(1, 'name', 'Renamed')
    openPanel()
    expect(statValue('data-iris-perf-changes')).toBe('1')
    // The handle clears the audit controller WITHOUT re-rendering the
    // table — the panel's own audit subscription refreshes the count.
    act(() => {
      r.current?.clearAuditLog()
    })
    expect(statValue('data-iris-perf-changes')).toBe('0')
  })

  it('no feedback loop: an open panel does not re-trigger the table (sample stays stable)', () => {
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" perfStats />)
    openPanel()
    const before = statValue('data-iris-perf-duration')
    // Flush any pending work — a self-induced loop would keep bumping the
    // sample (render-top mark re-captured, duration re-measured).
    act(() => {})
    act(() => {})
    expect(statValue('data-iris-perf-duration')).toBe(before)
  })

  it('a data change re-samples rows while the panel is open', () => {
    const { rerender } = render(<IrisTable columns={baseCols} data={rows} rowKey="id" perfStats />)
    openPanel()
    expect(statValue('data-iris-perf-rows')).toBe('3')
    const moreRows: Row[] = [...rows, { id: 4, name: 'Dora', age: 41, city: 'Tokyo' }]
    rerender(<IrisTable columns={baseCols} data={moreRows} rowKey="id" perfStats />)
    expect(statValue('data-iris-perf-rows')).toBe('4')
  })

  it('Esc / outside pointer-down close the panel (trigger excluded)', () => {
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" perfStats />)
    openPanel()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelector('[data-iris-perf-panel]')).toBeNull()
    fireEvent.click(perfTrigger()!)
    expect(document.querySelector('[data-iris-perf-panel]')).not.toBeNull()
    fireEvent.pointerDown(document.body)
    expect(document.querySelector('[data-iris-perf-panel]')).toBeNull()
  })

  it('is inert without the perfStats prop (no trigger, no panel)', () => {
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" />)
    expect(perfTrigger()).toBeNull()
    expect(document.querySelector('[data-iris-perf-panel]')).toBeNull()
  })

  it('the panel shows an empty state before the first sample (defensive)', () => {
    const anchor = { current: document.createElement('button') }
    render(
      <TablePerfPanel
        open
        anchorRef={anchor}
        perf={createPerfStats()}
        audit={createAuditLog()}
        onClose={() => {}}
        t={(k) => k}
      />,
    )
    const panel = document.querySelector('[data-iris-perf-panel]') as HTMLElement
    expect(panel).not.toBeNull()
    expect(panel.querySelector('[data-iris-perf-empty]')).not.toBeNull()
    expect(panel.querySelector('[data-iris-perf-stats]')).toBeNull()
  })

  it('the trigger toggles the panel (a second click closes it)', () => {
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" perfStats />)
    fireEvent.click(perfTrigger()!)
    expect(document.querySelector('[data-iris-perf-panel]')).not.toBeNull()
    fireEvent.click(perfTrigger()!)
    expect(document.querySelector('[data-iris-perf-panel]')).toBeNull()
  })
})
