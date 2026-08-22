import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import * as React from 'react'
import { IrisTable } from '../Table'
import type { IrisTableProps } from '../Table'
import { IrisI18nProvider } from '../../../i18n'
import type { IrisTableColumn, IrisTableHandle } from '../types'

/**
 * Batch ED (iris 独有 — vxe has no compare/merge capability): `mergeCompare`
 * adds a `data-iris-table-compare-merge` toolbar button that applies every
 * added/changed difference of the compare view to the CURRENT data —
 * changed rows replaced in place by their snapshot version (shallow copy,
 * never aliased into liveData), added rows appended in snapshot order
 * (shallow copy), removed/unchanged rows untouched — through the ONE normal
 * write-back channel (commitRowList, type 'merge'), so the merge is audited
 * (a single `merge` entry), undoable and versioned like any row-list commit.
 * Disabled with nothing to apply (identical snapshot / removed-only); the
 * handler early-returns the same way (idempotent double-safety).
 */

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
  note?: string
}

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

const current: Row[] = [
  { id: 1, name: 'Alice', age: 32, note: 'live-only' },
  { id: 2, name: 'Bob', age: 28 },
]

/** id=1 changed (name+age), id=2 identical, id=3 added — the batch-ed fixture. */
const snapshot: Row[] = [
  { id: 1, name: 'Alicia', age: 99 },
  { id: 2, name: 'Bob', age: 28 },
  { id: 3, name: 'Carol', age: 44 },
]

const toolbarEl = (): HTMLElement | null => document.querySelector('[data-iris-table-toolbar]')
const mergeBtn = (): HTMLButtonElement | null =>
  document.querySelector('[data-iris-table-compare-merge]')

function renderTable(over: Partial<IrisTableProps<Row>> = {}): void {
  render(
    <IrisTable
      columns={cols}
      data={current}
      rowKey="id"
      mergeCompare
      compareWith={snapshot}
      {...over}
    />,
  )
}

function cell(rowId: string | number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}

function attrs(rowId: string | number): string[] {
  const el = document.querySelector(`[data-iris-table-row="${rowId}"]`) as HTMLElement | null
  if (!el) return []
  return ['added', 'removed', 'changed']
    .filter((kind) => el.hasAttribute(`data-iris-row-${kind}`))
    .map((kind) => kind)
}

function commitRows(onDataChange: ReturnType<typeof vi.fn>): Row[] {
  return onDataChange.mock.calls.at(-1)![0] as Row[]
}

// ── Gating (batch ED 门控) ────────────────────────────────────────────────
describe('IrisTable mergeCompare — gating', () => {
  it('off (no mergeCompare) → no toolbar, no merge button', () => {
    render(<IrisTable columns={cols} data={current} rowKey="id" compareWith={snapshot} />)
    expect(toolbarEl()).toBeNull()
    expect(mergeBtn()).toBeNull()
  })

  it('mergeCompare without compareWith → toolbar renders, no merge button', () => {
    render(<IrisTable columns={cols} data={current} rowKey="id" mergeCompare />)
    expect(toolbarEl()).not.toBeNull()
    expect(mergeBtn()).toBeNull()
  })

  it('mergeCompare without a usable rowKey → no merge button (no diff identity)', () => {
    // rowKey defaults to 'id' — an EMPTY string is the falsy guard the
    // compare memo uses (diff identity impossible → no button).
    render(
      <IrisTable columns={cols} data={current} rowKey="" mergeCompare compareWith={snapshot} />,
    )
    expect(toolbarEl()).not.toBeNull()
    expect(mergeBtn()).toBeNull()
  })

  it('identical snapshot → button present but disabled', () => {
    renderTable({ compareWith: current })
    const btn = mergeBtn()!
    expect(btn).not.toBeNull()
    expect(btn.disabled).toBe(true)
  })

  it('removed-only diff (nothing to apply) → button disabled', () => {
    // Snapshot = current minus id=1 → id=1 removed, nothing changed/added.
    renderTable({ compareWith: current.slice(1) })
    expect(mergeBtn()!.disabled).toBe(true)
  })
})

// ── Merge result (batch ED 合并结果) ──────────────────────────────────────
describe('IrisTable mergeCompare — merge result', () => {
  it('replaces changed rows in place with their snapshot version (shallow copy)', () => {
    const onDataChange = vi.fn()
    renderTable({ onDataChange })
    fireEvent.click(mergeBtn()!)
    const after = commitRows(onDataChange)
    // Snapshot version wins (live-only `note` field is not part of it)…
    expect(after[0]).toEqual({ id: 1, name: 'Alicia', age: 99 })
    // …from a FRESH object — the snapshot element is never aliased.
    expect(after[0]).not.toBe(snapshot[0])
  })

  it('appends added rows in snapshot order after the live list', () => {
    const onDataChange = vi.fn()
    renderTable({ onDataChange })
    fireEvent.click(mergeBtn()!)
    const after = commitRows(onDataChange)
    expect(after.map((r) => r.name)).toEqual(['Alicia', 'Bob', 'Carol'])
    expect(after[2]).toEqual(snapshot[2])
    expect(after[2]).not.toBe(snapshot[2])
  })

  it('removed rows stay untouched (spec: changed/added only)', () => {
    const liveWithRemoved = [...current, { id: 4, name: 'Dana', age: 60 }]
    const onDataChange = vi.fn()
    renderTable({ data: liveWithRemoved, onDataChange })
    fireEvent.click(mergeBtn()!)
    const after = commitRows(onDataChange)
    const dana = after.find((r) => r.id === 4)!
    expect(dana).toEqual({ id: 4, name: 'Dana', age: 60 })
    expect(dana).toBe(liveWithRemoved[2]) // same reference — never copied
    expect(cell(4, 'name').textContent).toBe('Dana')
  })

  it('rows identical in both lists stay byte-identical (same object)', () => {
    const onDataChange = vi.fn()
    renderTable({ onDataChange })
    fireEvent.click(mergeBtn()!)
    const after = commitRows(onDataChange)
    expect(after[1]).toEqual(current[1])
    expect(after[1]).toBe(current[1])
  })

  it('empty live table → every snapshot row appended in snapshot order', () => {
    const onDataChange = vi.fn()
    renderTable({ data: [], onDataChange })
    fireEvent.click(mergeBtn()!)
    expect(commitRows(onDataChange)).toEqual(snapshot)
  })

  it('null-keyed snapshot rows are never merged in (same skip as diffRows)', () => {
    const ghost = { id: null as unknown as number, name: 'Ghost', age: 0 }
    const onDataChange = vi.fn()
    renderTable({ compareWith: [...snapshot, ghost], onDataChange })
    fireEvent.click(mergeBtn()!)
    const after = commitRows(onDataChange)
    expect(after.find((r) => r.name === 'Ghost')).toBeUndefined()
    expect(after).toHaveLength(3)
  })

  it('null-keyed live rows pass through untouched (same object)', () => {
    const keyless = { id: null as unknown as number, name: 'Zed', age: 1 }
    const onDataChange = vi.fn()
    renderTable({ data: [...current, keyless], onDataChange })
    fireEvent.click(mergeBtn()!)
    const after = commitRows(onDataChange)
    expect(after).toContain(keyless)
    expect(after).toHaveLength(4)
  })

  it('idempotent: after the merge the button disables and a second click commits nothing', () => {
    const onDataChange = vi.fn()
    renderTable({ onDataChange })
    const btn = mergeBtn()!
    expect(btn.disabled).toBe(false)
    fireEvent.click(btn)
    expect(onDataChange).toHaveBeenCalledTimes(1)
    expect(mergeBtn()!.disabled).toBe(true)
    fireEvent.click(mergeBtn()!)
    expect(onDataChange).toHaveBeenCalledTimes(1)
  })

  it('flips the compare attrs: changed rows unmark, added rows now render', () => {
    renderTable()
    expect(attrs(1)).toEqual(['changed'])
    expect(document.querySelector('[data-iris-table-row="3"]')).toBeNull()
    fireEvent.click(mergeBtn()!)
    expect(attrs(1)).toEqual([])
    expect(cell(3, 'name').textContent).toBe('Carol')
  })
})

// ── Write-back channels (batch ED 通道) ───────────────────────────────────
describe('IrisTable mergeCompare — write-back channels', () => {
  it('commits through onDataChange with the merged row list', () => {
    const onDataChange = vi.fn()
    renderTable({ onDataChange })
    fireEvent.click(mergeBtn()!)
    expect(onDataChange).toHaveBeenCalledTimes(1)
    expect(commitRows(onDataChange)).toHaveLength(3)
  })

  it('audits ONE entry of type merge with the first changed rowKey', () => {
    const r = { current: null as IrisTableHandle<Row> | null }
    renderTable({ auditLog: true, tableRef: r })
    fireEvent.click(mergeBtn()!)
    const log = r.current!.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.type).toBe('merge')
    expect(log[0]!.rowKey).toBe(1)
  })

  it('undo restores the pre-merge rows (the merge is undoable)', () => {
    const r = { current: null as IrisTableHandle<Row> | null }
    renderTable({ undo: true, tableRef: r })
    fireEvent.click(mergeBtn()!)
    fireEvent.click(document.querySelector('[data-iris-table-undo]') as HTMLButtonElement)
    expect(r.current!.getData()).toEqual(current)
  })

  it('version history captures the merge commit; restoreVersion returns pre-merge rows', () => {
    const r = { current: null as IrisTableHandle<Row> | null }
    renderTable({ versionHistory: {}, tableRef: r })
    fireEvent.click(mergeBtn()!)
    const versions = r.current!.getVersions()
    expect(versions).toHaveLength(1)
    expect(versions[0]!.type).toBe('merge')
    r.current!.restoreVersion(0)
    expect(r.current!.getData()).toEqual(current)
  })

  it('selection survives the merge (existing keys keep their selected state)', () => {
    const r = { current: null as IrisTableHandle<Row> | null }
    renderTable({
      selectable: 'multi',
      selection: [2],
      onSelectionChange: vi.fn(),
      tableRef: r,
    })
    fireEvent.click(mergeBtn()!)
    expect(r.current!.getSelection()).toEqual([2])
  })
})

// ── Contract (batch ED 契约) ──────────────────────────────────────────────
describe('IrisTable mergeCompare — contract', () => {
  it('renders the text-label button with its data-iris marker + label', () => {
    renderTable()
    const btn = mergeBtn()!
    expect(btn.getAttribute('data-iris-table-compare-merge')).toBe('')
    expect(btn.textContent).toBe('Merge compare')
    expect(btn.getAttribute('aria-label')).toBe('Merge compare')
    expect(btn.getAttribute('title')).toBe('Merge compare')
  })

  it('en override: provider messages win over the built-in default', () => {
    render(
      <IrisI18nProvider locale="en" messages={{ 'table.mergeCompare': 'Apply diffs' }}>
        <IrisTable columns={cols} data={current} rowKey="id" mergeCompare compareWith={snapshot} />
      </IrisI18nProvider>,
    )
    expect(mergeBtn()!.textContent).toBe('Apply diffs')
  })

  it('zh-CN renders 合并差异', () => {
    render(
      <IrisI18nProvider locale="zh-CN" messages={{ 'table.mergeCompare': '合并差异' }}>
        <IrisTable columns={cols} data={current} rowKey="id" mergeCompare compareWith={snapshot} />
      </IrisI18nProvider>,
    )
    expect(mergeBtn()!.textContent).toBe('合并差异')
  })
})
