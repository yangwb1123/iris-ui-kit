import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from '../Table'
import { IrisI18nProvider } from '../../../i18n'
import type { IrisTableColumn, IrisTableHandle } from '../types'

/**
 * Batch EB (iris 独有 — vxe has no column access stats): `columnStats`
 * counts per-column clicks + edit opens; `handle.getColumnStats()`
 * (total desc / key asc) + a toolbar `▦` top-5 panel. Every click counts
 * once; edits count at OPEN (Escape still counts); paste/fill + headers
 * never count.
 */

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  name: `R${i + 1}`,
  age: 10 + i,
}))

const plainCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

const editableCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'age', title: 'Age', editable: true },
]

const sortableCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true },
]

function tableRef(): { current: IrisTableHandle<Row> | null } {
  return { current: null }
}

function root(): HTMLElement {
  return document.querySelector('[data-iris-table]') as HTMLElement
}

function cell(rowId: string | number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}

function editor(): HTMLInputElement | null {
  return document.querySelector('[data-iris-table-editor]')
}

function statsTrigger(): HTMLElement | null {
  return document.querySelector('[data-iris-column-stats-trigger]')
}

function openPanel(): HTMLElement {
  fireEvent.click(statsTrigger()!)
  const panel = document.querySelector('[data-iris-column-stats-panel]') as HTMLElement
  expect(panel).not.toBeNull()
  return panel
}

function statRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-column-stats-row]'))
}

function statRow(i: number): HTMLElement {
  return statRows()[i]!
}

function clickCell(rowId: string | number, key: string): void {
  act(() => {
    fireEvent.click(cell(rowId, key))
  })
}

function dblclickCell(rowId: string | number, key: string): void {
  act(() => {
    fireEvent.doubleClick(cell(rowId, key))
  })
}

function commitEdit(value: string): void {
  act(() => {
    fireEvent.change(editor()!, { target: { value } })
    fireEvent.keyDown(editor()!, { key: 'Enter' })
  })
}

function focusCell(rowId: string | number, key: string): HTMLElement {
  const el = cell(rowId, key)
  act(() => {
    el.focus()
    fireEvent.focus(el)
  })
  return el
}

const f2 = (el: HTMLElement): void => {
  act(() => {
    fireEvent.keyDown(el, { key: 'F2' })
  })
}

const titleText = (i: number): string | null =>
  statRows()[i]!.querySelector('[data-iris-column-stats-key]')!.textContent

// ── Counting (13) ─────────────────────────────────────────────────────────
describe('IrisTable columnStats counting (batch EB, iris 独有)', () => {
  it('plain-table clicks count once each through the unified throat', () => {
    const r = tableRef()
    render(
      <IrisTable
        columns={plainCols}
        data={rows}
        rowKey="id"
        columnStats
        onCellClick={() => {}}
        tableRef={r}
      />,
    )
    clickCell(1, 'name')
    clickCell(1, 'age')
    clickCell(1, 'age')
    const [a, b] = r.current!.getColumnStats()
    expect(a).toEqual({ key: 'age', clicks: 2, edits: 0, total: 2 })
    expect(b).toEqual({ key: 'name', clicks: 1, edits: 0, total: 1 })
  })

  it('row mode: one click + one edit per editable column opened (fan-out)', () => {
    const r = tableRef()
    render(
      <IrisTable
        columns={editableCols}
        data={rows}
        rowKey="id"
        columnStats
        editConfig={{ mode: 'row' }}
        tableRef={r}
      />,
    )
    clickCell(1, 'name')
    const [top, next] = r.current!.getColumnStats()
    expect(top).toEqual({ key: 'name', clicks: 1, edits: 1, total: 2 })
    expect(next).toEqual({ key: 'age', clicks: 0, edits: 1, total: 1 })
    // A second click on an already-open column = a plain click (no new session).
    clickCell(1, 'age')
    const [a2, b2] = r.current!.getColumnStats()
    expect(a2).toEqual({ key: 'age', clicks: 1, edits: 1, total: 2 })
    expect(b2).toEqual({ key: 'name', clicks: 1, edits: 1, total: 2 })
  })

  it('cellRange-only table (no onCellClick): narrow branch counts the click', () => {
    const r = tableRef()
    render(
      <IrisTable columns={plainCols} data={rows} rowKey="id" columnStats cellRange tableRef={r} />,
    )
    clickCell(1, 'name')
    clickCell(1, 'age')
    expect(document.querySelectorAll('[data-iris-cell-row]').length).toBeGreaterThan(0)
    const [a, b] = r.current!.getColumnStats()
    expect(a).toEqual({ key: 'age', clicks: 1, edits: 0, total: 1 })
    expect(b).toEqual({ key: 'name', clicks: 1, edits: 0, total: 1 })
  })

  it('click-trigger edits count as BOTH a click and an edit (double count)', () => {
    const r = tableRef()
    render(
      <IrisTable
        columns={editableCols}
        data={rows}
        rowKey="id"
        columnStats
        editConfig={{ trigger: 'click' }}
        tableRef={r}
      />,
    )
    clickCell(1, 'name')
    expect(editor()).not.toBeNull()
    expect(r.current!.getColumnStats()).toEqual([{ key: 'name', clicks: 1, edits: 1, total: 2 }])
  })

  it('dblclick opens a cell edit — 1 edit, 0 clicks', () => {
    const r = tableRef()
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" columnStats tableRef={r} />)
    dblclickCell(1, 'name')
    expect(editor()).not.toBeNull()
    expect(r.current!.getColumnStats()).toEqual([{ key: 'name', clicks: 0, edits: 1, total: 1 }])
  })

  it('F2 opens a cell edit through the keyboard path — 1 edit', () => {
    const r = tableRef()
    render(
      <IrisTable
        columns={editableCols}
        data={rows}
        rowKey="id"
        columnStats
        keyboardNavigation
        editKeys={[]}
        tableRef={r}
      />,
    )
    f2(focusCell(1, 'age'))
    expect(editor()).not.toBeNull()
    expect(r.current!.getColumnStats()).toEqual([{ key: 'age', clicks: 0, edits: 1, total: 1 }])
  })

  it('row fan-out skips locked columns (locked column gets zero counts)', () => {
    const lockedCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true },
      { key: 'age', title: 'Age', editable: true, locked: true },
    ]
    const r = tableRef()
    render(
      <IrisTable
        columns={lockedCols}
        data={rows}
        rowKey="id"
        columnStats
        editConfig={{ mode: 'row' }}
        tableRef={r}
      />,
    )
    clickCell(1, 'name')
    // The locked 'age' column never opens a session — no edit count there.
    expect(r.current!.getColumnStats()).toEqual([{ key: 'name', clicks: 1, edits: 1, total: 2 }])
  })

  it('Escape after opening keeps the edit count (counted at OPEN, not commit)', () => {
    const r = tableRef()
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" columnStats tableRef={r} />)
    dblclickCell(1, 'name')
    act(() => {
      fireEvent.keyDown(editor()!, { key: 'Escape' })
    })
    expect(editor()).toBeNull()
    expect(r.current!.getColumnStats()).toEqual([{ key: 'name', clicks: 0, edits: 1, total: 1 }])
  })

  it('off is fail-closed: no counting, no trigger, empty snapshot', () => {
    const r = tableRef()
    render(
      <IrisTable
        columns={editableCols}
        data={rows}
        rowKey="id"
        onCellClick={() => {}}
        tableRef={r}
      />,
    )
    clickCell(1, 'name')
    dblclickCell(2, 'age')
    expect(r.current!.getColumnStats()).toEqual([])
    expect(statsTrigger()).toBeNull()
    expect(document.querySelector('[data-iris-column-stats-panel]')).toBeNull()
  })

  it('getColumnStats returns a fresh snapshot copy (mutating it is inert)', () => {
    const r = tableRef()
    render(
      <IrisTable
        columns={plainCols}
        data={rows}
        rowKey="id"
        columnStats
        onCellClick={() => {}}
        tableRef={r}
      />,
    )
    clickCell(1, 'name')
    clickCell(1, 'age')
    const a = r.current!.getColumnStats()
    a.push({ key: 'x', clicks: 9, edits: 9, total: 18 })
    expect(a).toHaveLength(3) // the caller's copy mutated
    const b = r.current!.getColumnStats()
    expect(b).toHaveLength(2)
    expect(b).not.toBe(a)
    const [c, d] = b
    expect(c).toEqual({ key: 'age', clicks: 1, edits: 0, total: 1 })
    expect(d).toEqual({ key: 'name', clicks: 1, edits: 0, total: 1 })
  })

  it('paste-fill write-backs never count (selection clicks do, the fill adds zero)', () => {
    const r = tableRef()
    render(
      <IrisTable
        columns={plainCols}
        data={rows}
        rowKey="id"
        columnStats
        cellRange
        rangeFill
        tableRef={r}
      />,
    )
    // Select a 1×2 range — two clicks through the narrow cellRange branch.
    clickCell(1, 'name')
    act(() => {
      fireEvent.click(cell(1, 'age'), { shiftKey: true })
    })
    // Ctrl+D fills row 1 via the same commit funnel clipboard paste uses.
    act(() => {
      fireEvent.keyDown(root(), { key: 'd', ctrlKey: true })
    })
    expect(cell(2, 'name').textContent).toBe('R1') // the fill landed
    const [a, b] = r.current!.getColumnStats()
    expect(a).toEqual({ key: 'age', clicks: 1, edits: 0, total: 1 })
    expect(b).toEqual({ key: 'name', clicks: 1, edits: 0, total: 1 })
  })

  it('header clicks never count (sort still works)', () => {
    const r = tableRef()
    render(
      <IrisTable
        columns={sortableCols}
        data={rows}
        rowKey="id"
        columnStats
        onCellClick={() => {}}
        tableRef={r}
      />,
    )
    act(() => {
      fireEvent.click(Array.from(document.querySelectorAll('[data-iris-table-header="name"]'))[0]!)
    })
    expect(document.querySelector('[aria-sort="ascending"]')).not.toBeNull()
    expect(r.current!.getColumnStats()).toEqual([])
  })

  it('snapshot tiebreak: equal totals sort key ASC; higher total wins', () => {
    const r = tableRef()
    render(
      <IrisTable
        columns={plainCols}
        data={rows}
        rowKey="id"
        columnStats
        onCellClick={() => {}}
        tableRef={r}
      />,
    )
    clickCell(1, 'name')
    clickCell(1, 'age')
    expect(r.current!.getColumnStats().map((s) => s.key)).toEqual(['age', 'name'])
    clickCell(1, 'name')
    clickCell(1, 'name')
    expect(r.current!.getColumnStats().map((s) => s.key)).toEqual(['name', 'age'])
  })
})

// ── Panel (8) ─────────────────────────────────────────────────────────────
describe('IrisTable columnStats panel (batch EB, iris 独有)', () => {
  it('trigger is gated on the columnStats prop', () => {
    const { rerender } = render(
      <IrisTable columns={plainCols} data={rows} rowKey="id" columnStats onCellClick={() => {}} />,
    )
    expect(statsTrigger()).not.toBeNull()
    rerender(<IrisTable columns={plainCols} data={rows} rowKey="id" onCellClick={() => {}} />)
    expect(statsTrigger()).toBeNull()
  })

  it('shows at most the top 5 rows (6 active columns → 5)', () => {
    const sixCols: IrisTableColumn<Row>[] = ['a', 'b', 'c', 'd', 'e', 'f'].map((key) => ({
      key,
      title: key,
    }))
    render(
      <IrisTable columns={sixCols} data={rows} rowKey="id" columnStats onCellClick={() => {}} />,
    )
    for (const key of ['a', 'b', 'c', 'd', 'e', 'f']) clickCell(1, key)
    openPanel()
    expect(statRows()).toHaveLength(5)
    // All six tie at total 1 → key-asc order; the 6th (f) is dropped.
    expect(statRows().map((_, i) => titleText(i))).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('renders per-row key + clicks + edits + total', () => {
    const en: Record<string, string> = {
      'table.columnStats.clicks': '{count} clicks',
      'table.columnStats.edits': '{count} edits',
    }
    render(
      <IrisI18nProvider locale="en" messages={en}>
        <IrisTable
          columns={editableCols}
          data={rows}
          rowKey="id"
          columnStats
          onCellClick={() => {}}
        />
      </IrisI18nProvider>,
    )
    clickCell(1, 'name')
    clickCell(1, 'name')
    dblclickCell(1, 'name') // dblclick → a committed edit is not needed; open counts
    openPanel()
    const row = statRow(0)
    expect(row.getAttribute('data-iris-column-stats-rank')).toBe('1')
    expect(row.querySelector('[data-iris-column-stats-key]')!.textContent).toBe('name')
    const counts = row.querySelector('[data-iris-column-stats-counts]')!.textContent
    expect(counts).toBe('2 clicks · 1 edits · 3')
    expect(document.querySelector('[data-iris-column-stats-empty]')).toBeNull()
  })

  it('empty state when the panel opens with no activity', () => {
    render(<IrisTable columns={plainCols} data={rows} rowKey="id" columnStats />)
    openPanel()
    expect(document.querySelector('[data-iris-column-stats-empty]')).not.toBeNull()
    expect(statRows()).toHaveLength(0)
  })

  it('closes on Escape / outside pointer-down / scroll (three-way)', () => {
    render(
      <IrisTable columns={plainCols} data={rows} rowKey="id" columnStats onCellClick={() => {}} />,
    )
    openPanel()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelector('[data-iris-column-stats-panel]')).toBeNull()
    openPanel()
    fireEvent.pointerDown(document.body)
    expect(document.querySelector('[data-iris-column-stats-panel]')).toBeNull()
    openPanel()
    act(() => {
      fireEvent.scroll(document)
    })
    expect(document.querySelector('[data-iris-column-stats-panel]')).toBeNull()
  })

  it('live refresh: an F2 edit while open updates the panel without reopening', () => {
    render(
      <IrisTable
        columns={editableCols}
        data={rows}
        rowKey="id"
        columnStats
        keyboardNavigation
        editKeys={[]}
      />,
    )
    // Open one edit, commit it, then open the panel showing 1 edit.
    f2(focusCell(1, 'name'))
    commitEdit('R1x')
    openPanel()
    // Raw-key fallback: the counts line ends with the plain total — live.
    expect(statRows()[0]!.textContent).toContain('· 1')
    f2(focusCell(2, 'name'))
    expect(document.querySelector('[data-iris-column-stats-panel]')).not.toBeNull()
    expect(statRows()[0]!.textContent).toContain('· 2')
  })

  it('zh copy flows through the panel title + trigger + counts', () => {
    render(
      <IrisI18nProvider
        locale="zh-CN"
        messages={{
          'table.columnStats': '列访问统计',
          'table.columnStats.clicks': '{count} 次点击',
          'table.columnStats.edits': '{count} 次编辑',
          'table.columnStats.empty': '暂无列访问',
        }}
      >
        <IrisTable columns={plainCols} data={rows} rowKey="id" columnStats onCellClick={() => {}} />
      </IrisI18nProvider>,
    )
    expect(statsTrigger()!.getAttribute('aria-label')).toBe('列访问统计')
    clickCell(1, 'name')
    clickCell(1, 'name')
    const panel = openPanel()
    expect(panel.getAttribute('aria-label')).toBe('列访问统计')
    const counts = statRow(0).querySelector('[data-iris-column-stats-counts]')!.textContent
    expect(counts).toBe('2 次点击 · 0 次编辑 · 2')
  })

  it('panel order follows the same tiebreak (equal totals → key ASC)', () => {
    render(
      <IrisTable columns={plainCols} data={rows} rowKey="id" columnStats onCellClick={() => {}} />,
    )
    clickCell(1, 'name')
    clickCell(1, 'age')
    openPanel()
    expect(statRows().map((_, i) => titleText(i))).toEqual(['age', 'name'])
    expect(statRow(0).getAttribute('data-iris-column-stats-rank')).toBe('1')
    expect(statRow(1).getAttribute('data-iris-column-stats-rank')).toBe('2')
  })
})
