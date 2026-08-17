import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from './Table'
import { mergeEditTimeline } from './EditHistoryPanel'
import type { AuditLogEntry, AuditLogType } from '@iris-ui-kit/core'
import type { IrisTableColumn } from './types'
import type { IrisTableHandle } from './types'

afterEach(cleanup)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
  { id: 3, name: 'Bob', age: 28 },
]

const editableCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'age', title: 'Age', editable: true },
]

const baseCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
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

/** Inline cell edit — the commitValue funnel (audited, deliberately NOT versioned). */
function editCell(rowId: string | number, colKey: string, value: string): void {
  act(() => {
    fireEvent.doubleClick(cell(rowId, colKey))
  })
  act(() => {
    fireEvent.change(editor()!, { target: { value } })
    fireEvent.keyDown(editor()!, { key: 'Enter' })
  })
}

function sidebarTrigger(): HTMLElement | null {
  return document.querySelector('[data-iris-edit-sidebar-trigger]')
}

/** Click the ⏳ toolbar trigger and assert the fixed side panel is up. */
function openSidebar(): HTMLElement {
  fireEvent.click(sidebarTrigger()!)
  const panel = document.querySelector('[data-iris-edit-sidebar-panel]') as HTMLElement
  expect(panel).not.toBeNull()
  return panel
}

function sidebar(): HTMLElement | null {
  return document.querySelector('[data-iris-edit-sidebar-panel]')
}

function entries(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-edit-sidebar-item]'))
}

function versionEntries(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-edit-sidebar-version]'))
}

function auditEntries(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-edit-sidebar-audit]'))
}

// ── Edit-history sidebar (iris 独有, batch DB) — panel behavior ────────────
describe('IrisTable edit sidebar panel', () => {
  it('the ⏳ trigger appears only with editSidebar and opens the fixed portal panel', () => {
    const r = tableRef()
    const { unmount } = render(
      <IrisTable
        columns={baseCols}
        data={rows}
        rowKey="id"
        versionHistory
        auditLog
        editSidebar
        tableRef={r}
      />,
    )
    expect(sidebarTrigger()).not.toBeNull()
    openSidebar()
    const panel = sidebar()
    expect(panel).not.toBeNull()
    // Pinned to the inline-end edge via a portal (rendered OUTSIDE the table).
    expect(panel!.getAttribute('role')).toBe('dialog')
    expect(panel!.getAttribute('aria-label')).toBe('Edit history')
    expect(panel!.style.position).toBe('fixed')
    // jsdom normalizes the edge unit away; both spellings are the same pin.
    expect(['0', '0px']).toContain(panel!.style.insetInlineEnd)
    expect(document.querySelector('[data-iris-table]')!.contains(panel!)).toBe(false)
    unmount()
    // No trigger without the prop.
    render(<IrisTable columns={baseCols} data={rows} rowKey="id" tableRef={r} />)
    expect(sidebarTrigger()).toBeNull()
    expect(sidebar()).toBeNull()
  })

  it('a commit while it is open refreshes the merged timeline in place (both rings)', () => {
    const r = tableRef()
    render(
      <IrisTable
        columns={baseCols}
        data={rows}
        rowKey="id"
        versionHistory
        auditLog
        editSidebar
        tableRef={r}
      />,
    )
    openSidebar()
    expect(entries()).toHaveLength(0)
    // A row-level commit pushes BOTH rings; the open panel must show both
    // without a re-open (useSyncExternalStore on each controller).
    act(() => {
      r.current?.updateRow(1, { name: 'Renamed' })
    })
    expect(sidebar()).not.toBeNull()
    expect(versionEntries()).toHaveLength(1)
    expect(auditEntries()).toHaveLength(1)
  })

  it('Esc / outside pointer-down / any scroll close the panel', () => {
    render(
      <IrisTable columns={baseCols} data={rows} rowKey="id" versionHistory auditLog editSidebar />,
    )
    openSidebar()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(sidebar()).toBeNull()
    openSidebar()
    fireEvent.pointerDown(document.body)
    expect(sidebar()).toBeNull()
    openSidebar()
    fireEvent.scroll(document)
    expect(sidebar()).toBeNull()
  })

  it('the trigger is exempt from the outside-pointer-down close — a press on it toggles', () => {
    render(
      <IrisTable columns={baseCols} data={rows} rowKey="id" versionHistory auditLog editSidebar />,
    )
    openSidebar()
    // Pointer-down ON the trigger: exempt — the panel stays open (no
    // close-then-reopen flicker).
    fireEvent.pointerDown(sidebarTrigger()!)
    expect(sidebar()).not.toBeNull()
    // The click then toggles it shut; a second click reopens.
    fireEvent.click(sidebarTrigger()!)
    expect(sidebar()).toBeNull()
    fireEvent.click(sidebarTrigger()!)
    expect(sidebar()).not.toBeNull()
  })

  it('empty state when neither recording layer is on (fail-closed — layers never implicitly enabled)', () => {
    const r = tableRef()
    render(<IrisTable columns={editableCols} data={rows} rowKey="id" editSidebar tableRef={r} />)
    editCell(1, 'name', 'Renamed')
    openSidebar()
    expect(entries()).toHaveLength(0)
    expect(sidebar()!.querySelector('[data-iris-edit-sidebar-empty]')).not.toBeNull()
  })
})

// ── Edit-history timeline (batch DB) — the merged list ─────────────────────
describe('edit history timeline', () => {
  const versionAt = (index: number, at: number, type: AuditLogType = 'edit') => ({
    index,
    at,
    type,
    rows: [] as readonly Row[],
  })
  const auditAt = (seq: number, at: number, type: AuditLogType = 'edit'): AuditLogEntry => ({
    seq,
    at,
    type,
  })

  it('merges both rings newest-first; same-ms ties list the audit ABOVE its version', () => {
    const merged = mergeEditTimeline<Row>(
      [versionAt(1, 3000), versionAt(0, 1000)],
      [auditAt(2, 2000), auditAt(1, 1000)],
    )
    expect(merged.map((i) => [i.kind, i.at])).toEqual([
      ['version', 3000],
      ['audit', 2000],
      // Same-ms tie (1000): the audit entry goes FIRST — the deterministic
      // record-order arbitration, never wall-clock luck.
      ['audit', 1000],
      ['version', 1000],
    ])
    expect(merged).toHaveLength(4)
  })

  it('single sources pass through: versions alone / audits alone', () => {
    expect(mergeEditTimeline<Row>([versionAt(0, 100)], []).map((i) => i.kind)).toEqual(['version'])
    expect(mergeEditTimeline<Row>([], [auditAt(1, 100)]).map((i) => i.kind)).toEqual(['audit'])
    expect(mergeEditTimeline<Row>([], [])).toEqual([])
  })

  it('a version entry renders #index + clock + type; clicking one restores + closes WITHOUT pushing a new version', () => {
    const r = tableRef()
    render(
      <IrisTable
        columns={baseCols}
        data={rows}
        rowKey="id"
        versionHistory
        auditLog
        editSidebar
        tableRef={r}
      />,
    )
    act(() => {
      r.current?.updateRow(1, { name: 'Renamed' })
    })
    act(() => {
      r.current?.updateRow(2, { age: 33 })
    })
    const panel = openSidebar()
    const vs = versionEntries()
    // Newest first: the second commit (#1) is on top.
    expect(vs).toHaveLength(2)
    expect(vs[0]!.querySelector('[data-iris-edit-sidebar-index]')!.textContent).toBe('#1')
    expect(vs[0]!.querySelector('[data-iris-edit-sidebar-type]')!.textContent).toBe('edit')
    expect(vs[0]!.querySelector('[data-iris-edit-sidebar-time]')!.textContent).toMatch(
      /^\d{2}:\d{2}:\d{2}$/,
    )
    expect(vs[1]!.querySelector('[data-iris-edit-sidebar-index]')!.textContent).toBe('#0')
    expect(panel.querySelector('[data-iris-edit-sidebar-empty]')).toBeNull()
    // Click the newest entry → restores the state BEFORE the second commit,
    // closes the panel, and the replay is suppressed from pushing a version
    // (it IS audited as 'undo' through the normal write-back channel).
    fireEvent.click(vs[0]!)
    expect(cell(1, 'name').textContent).toBe('Renamed')
    expect(cell(2, 'age').textContent).toBe('32')
    expect(sidebar()).toBeNull()
    expect(r.current!.getVersions()).toHaveLength(2)
    expect(r.current!.getAuditLog()).toHaveLength(3)
    expect(r.current!.getAuditLog()[0]!.type).toBe('undo')
  })

  it('an audit entry renders #seq + clock + type + rowKey + column + muted old→new', () => {
    const r = tableRef()
    render(
      <IrisTable
        columns={editableCols}
        data={rows}
        rowKey="id"
        auditLog
        editSidebar
        tableRef={r}
      />,
    )
    editCell(1, 'name', 'Renamed')
    editCell(2, 'age', '33')
    const panel = openSidebar()
    const as = auditEntries()
    expect(as).toHaveLength(2)
    // Newest first: the age edit is #2 on top; inline edits are NOT versioned,
    // so the timeline holds audits only (single-source pass-through).
    expect(versionEntries()).toHaveLength(0)
    expect(as[0]!.querySelector('[data-iris-edit-sidebar-seq]')!.textContent).toBe('#2')
    expect(as[0]!.querySelector('[data-iris-edit-sidebar-type]')!.textContent).toBe('edit')
    expect(as[0]!.querySelector('[data-iris-edit-sidebar-time]')!.textContent).toMatch(
      /^\d{2}:\d{2}:\d{2}$/,
    )
    expect(as[0]!.querySelector('[data-iris-edit-sidebar-rowkey]')!.textContent).toBe('2')
    const cellSpan = as[0]!.querySelector('[data-iris-edit-sidebar-cell]')!
    expect(cellSpan.textContent).toContain('age')
    expect(as[0]!.querySelector('[data-iris-edit-sidebar-old]')!.textContent).toBe('32')
    expect(as[0]!.querySelector('[data-iris-edit-sidebar-new]')!.textContent).toBe('33')
    expect(as[1]!.querySelector('[data-iris-edit-sidebar-seq]')!.textContent).toBe('#1')
    expect(panel.querySelector('[data-iris-edit-sidebar-empty]')).toBeNull()
  })

  it('fail-closed single source: versionHistory only lists versions, auditLog only audits', () => {
    const r = tableRef()
    // versionHistory alone: the row-level commit shows a version, no audit.
    render(
      <IrisTable
        columns={baseCols}
        data={rows}
        rowKey="id"
        versionHistory
        editSidebar
        tableRef={r}
      />,
    )
    act(() => {
      r.current?.updateRow(1, { name: 'Renamed' })
    })
    openSidebar()
    expect(versionEntries()).toHaveLength(1)
    expect(auditEntries()).toHaveLength(0)
    cleanup()
    // auditLog alone: the cell edit shows an audit, no version.
    render(
      <IrisTable
        columns={editableCols}
        data={rows}
        rowKey="id"
        auditLog
        editSidebar
        tableRef={r}
      />,
    )
    editCell(1, 'name', 'Renamed')
    openSidebar()
    expect(auditEntries()).toHaveLength(1)
    expect(versionEntries()).toHaveLength(0)
  })

  it('smokes every AuditLogType through the merge (8 kinds, interleaved with a version)', () => {
    const types: AuditLogType[] = [
      'edit',
      'insert',
      'remove',
      'paste',
      'batch',
      'fill',
      'undo',
      'redo',
    ]
    const audits: AuditLogEntry[] = [
      auditAt(8, 1070, 'redo'),
      auditAt(7, 1060, 'undo'),
      auditAt(6, 1050, 'fill'),
      auditAt(5, 1040, 'batch'),
      auditAt(4, 1030, 'paste'),
      auditAt(3, 1020, 'remove'),
      auditAt(2, 1010, 'insert'),
      auditAt(1, 1000, 'edit'),
    ]
    // Newest-first per ring (the snapshot order `list()` returns).
    const merged = mergeEditTimeline<Row>([versionAt(0, 1040)], audits)
    expect(merged).toHaveLength(9)
    // Newest-first global order is preserved across the two sources.
    expect(merged[0]).toMatchObject({ kind: 'audit', type: 'redo' })
    // The version sits exactly where its 1040 timestamp places it: after
    // 'batch' (1040 — same-ms tie, audit above version) and before 'paste'
    // (1030) — the interleaving stays deterministic, every audit type intact.
    const seen = new Set(merged.filter((i) => i.kind === 'audit').map((i) => i.type))
    expect(seen).toEqual(new Set(types))
    expect(merged.some((i) => i.kind === 'version' && i.type === 'edit')).toBe(true)
  })
})
