import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { formatClock } from '@iris-ui-kit/core'
import { IrisTable } from './Table'
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

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

/** The spec-literal header of the timeline export. */
const HEADER = 'time,type,rowKey,column,old,new'

function tableRef(): { current: IrisTableHandle<Row> | null } {
  return { current: null }
}

/** A row-list commit (the commitRowList funnel) — records ONE audit entry. */
function commit(
  ref: { current: IrisTableHandle<Row> | null },
  id: number,
  patch: Partial<Row>,
): void {
  act(() => {
    ref.current?.updateRow(id, patch)
  })
}

/** A structural insert — the audit entry carries only the rowKey. */
function insert(ref: { current: IrisTableHandle<Row> | null }, row: Row, index?: number): void {
  act(() => {
    ref.current?.insertRow(row, index)
  })
}

// ── exportTimelineCsv (iris 独有, batch CO) ──────────────────────────────
// Exports the batch-AT audit ring as CSV through core `toCsv` — spec-literal
// 6 columns `time,type,rowKey,column,old,new`. time = `formatClock(new
// Date(at))` (HH:MM:SS local, byte-identical to the audit panel's time cell);
// the rest passes through verbatim (undefined → '', numbers bare, strings
// RFC-4180-quoted + OWASP formula-neutralized). Order = ring order (newest
// first). Fail-closed family: auditLog off → ''; on but empty ring → header
// only (the caller distinguishes the two via `getAuditLog()`).
describe('IrisTable exportTimelineCsv', () => {
  it('is inert without the auditLog prop (empty string, never throws)', () => {
    const r = tableRef()
    render(<IrisTable columns={cols} data={rows} rowKey="id" tableRef={r} />)
    commit(r, 1, { name: 'Renamed' })
    expect(r.current!.getAuditLog()).toHaveLength(0)
    expect(r.current!.exportTimelineCsv()).toBe('')
  })

  it('exports a single edit as the spec-literal 6 columns with an HH:MM:SS local time', () => {
    const r = tableRef()
    render(<IrisTable columns={cols} data={rows} rowKey="id" auditLog tableRef={r} />)
    commit(r, 1, { name: 'Renamed' })
    const lines = r.current!.exportTimelineCsv().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe(HEADER)
    const fields = lines[1]!.split(',')
    expect(fields).toHaveLength(6)
    expect(fields[0]).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    expect(fields[1]).toBe('edit')
    expect(fields[2]).toBe('1')
    expect(fields[3]).toBe('name')
    expect(fields[4]).toBe('Charlie')
    expect(fields[5]).toBe('Renamed')
  })

  it('is newest-first (ring order — the same view as getAuditLog)', () => {
    const r = tableRef()
    render(<IrisTable columns={cols} data={rows} rowKey="id" auditLog tableRef={r} />)
    commit(r, 1, { name: 'Renamed' }) // entry 1
    commit(r, 2, { age: 33 }) // entry 2 (newest)
    const lines = r.current!.exportTimelineCsv().split('\n')
    expect(lines).toHaveLength(3)
    const first = lines[1]!.split(',')
    expect(first[1]).toBe('edit')
    expect(first[2]).toBe('2')
    expect(first[3]).toBe('age')
    expect(first[4]).toBe('32')
    expect(first[5]).toBe('33')
    const second = lines[2]!.split(',')
    expect(second[2]).toBe('1')
    expect(second[4]).toBe('Charlie')
    expect(second[5]).toBe('Renamed')
  })

  it('row-level structural changes (insert) export trailing empty column/old/new cells', () => {
    const r = tableRef()
    render(<IrisTable columns={cols} data={rows} rowKey="id" auditLog tableRef={r} />)
    insert(r, { id: 4, name: 'Dora', age: 41 }, 0)
    const fields = r.current!.exportTimelineCsv().split('\n')[1]!.split(',')
    expect(fields).toHaveLength(6)
    expect(fields[1]).toBe('insert')
    expect(fields[2]).toBe('4')
    expect(fields[3]).toBe('')
    expect(fields[4]).toBe('')
    expect(fields[5]).toBe('')
  })

  it('on but empty ring → header only; after clearAuditLog → header only', () => {
    const r = tableRef()
    render(<IrisTable columns={cols} data={rows} rowKey="id" auditLog tableRef={r} />)
    // Nothing committed yet — the ring is empty, the export is the header alone.
    expect(r.current!.exportTimelineCsv()).toBe(HEADER)
    commit(r, 1, { name: 'Renamed' })
    expect(r.current!.exportTimelineCsv().split('\n')).toHaveLength(2)
    act(() => {
      r.current!.clearAuditLog()
    })
    expect(r.current!.getAuditLog()).toHaveLength(0)
    expect(r.current!.exportTimelineCsv()).toBe(HEADER)
  })

  it('RFC-4180: values with commas/quotes are quoted with doubled quotes', () => {
    const r = tableRef()
    render(<IrisTable columns={cols} data={rows} rowKey="id" auditLog tableRef={r} />)
    commit(r, 1, { name: 'Doe, John' })
    commit(r, 2, { name: 'He said "hi"' })
    const lines = r.current!.exportTimelineCsv().split('\n')
    expect(lines[0]).toBe(HEADER)
    // Newest first: entry 2 (embedded quote) then entry 1 (comma). The time
    // field is a live HH:MM:SS — assert its format, then the exact tail.
    const t1 = lines[1]!.split(',')[0]!
    expect(t1).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    expect(lines[1]).toBe(`${t1},edit,2,name,Alice,"He said ""hi"""`)
    const t2 = lines[2]!.split(',')[0]!
    expect(t2).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    expect(lines[2]).toBe(`${t2},edit,1,name,Charlie,"Doe, John"`)
  })

  it('OWASP: values leading with = get formula-neutralized with a leading quote', () => {
    const r = tableRef()
    render(<IrisTable columns={cols} data={rows} rowKey="id" auditLog tableRef={r} />)
    commit(r, 1, { name: '=cmd|calc' })
    const [t, ...tail] = r.current!.exportTimelineCsv().split('\n')[1]!.split(',')
    expect(t).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    expect(tail.join(',')).toBe(`edit,1,name,Charlie,'=cmd|calc`)
  })

  it('numbers stay bare (never quoted or neutralized)', () => {
    const r = tableRef()
    render(<IrisTable columns={cols} data={rows} rowKey="id" auditLog tableRef={r} />)
    commit(r, 2, { age: 33 })
    const fields = r.current!.exportTimelineCsv().split('\n')[1]!.split(',')
    expect(fields[4]).toBe('32')
    expect(fields[5]).toBe('33')
  })

  it('matches getAuditLog per field (time via formatClock — same source)', () => {
    const r = tableRef()
    render(<IrisTable columns={cols} data={rows} rowKey="id" auditLog tableRef={r} />)
    commit(r, 1, { name: 'Renamed' })
    commit(r, 3, { age: 29 })
    const lines = r.current!.exportTimelineCsv().split('\n')
    const log = r.current!.getAuditLog()
    expect(lines).toHaveLength(log.length + 1)
    expect(lines[0]).toBe(HEADER)
    log.forEach((entry, i) => {
      const fields = lines[i + 1]!.split(',')
      expect(fields[0]).toBe(formatClock(new Date(entry.at)))
      expect(fields[1]).toBe(entry.type)
      expect(fields[2]).toBe(String(entry.rowKey))
      expect(fields[3]).toBe(entry.column ?? '')
      expect(fields[4]).toBe(String(entry.oldValue ?? ''))
      expect(fields[5]).toBe(String(entry.newValue ?? ''))
    })
  })
})
