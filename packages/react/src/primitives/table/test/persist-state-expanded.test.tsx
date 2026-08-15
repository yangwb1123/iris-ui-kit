import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import * as React from 'react'
import { IrisTable } from '../Table'
import type { IrisTableColumn, IrisTablePersistConfig, IrisTableSortState } from '../types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

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

const baseColumns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age' },
]

const DEFAULT_KEY = 'iris-table-state'

/** In-memory Storage adapter stub with spies on getItem/setItem. */
function makeStorage(seed?: string | null): {
  data: Map<string, string>
  getItem: Mock
  setItem: Mock
} {
  const data = new Map<string, string>()
  if (seed != null) data.set(DEFAULT_KEY, seed)
  return {
    data,
    getItem: vi.fn((k: string) => data.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => {
      data.set(k, v)
    }),
  }
}

function lastSaved(storage: { setItem: Mock }): Record<string, unknown> {
  const calls = storage.setItem.mock.calls as Array<[string, string]>
  expect(calls.length).toBeGreaterThan(0)
  return JSON.parse(calls[calls.length - 1]![1]!) as Record<string, unknown>
}

function toggle(rowId: string | number): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-expand-toggle]`,
  ) as HTMLElement
}

function detail(rowId: string | number): HTMLElement | null {
  return document.querySelector(`[data-iris-table-row-detail="${rowId}"]`)
}

interface HarnessProps {
  persist: IrisTablePersistConfig
  /** detail=false renders a FLAT table (no expansion capability). */
  detail?: boolean
  onExpandedRowsChange?: (keys: Array<string | number>) => void
  onSortChange?: (next: IrisTableSortState | null) => void
}

/** One harness for both modes — the expansion model is internal (no controlled
 * prop); the parent observes through `onExpandedRowsChange` (batch BY restore
 * channel). `onSortChange` is passed through so the sort channel saves too
 * (proving expandedKeys is gated independently). */
function PersistHarness(props: HarnessProps): React.ReactElement {
  return (
    <IrisTable
      columns={baseColumns}
      data={rows}
      rowKey="id"
      {...(props.detail === false
        ? {}
        : { renderDetail: (r: Row): React.ReactNode => <div>detail-{r.id}</div> })}
      onSortChange={props.onSortChange}
      onExpandedRowsChange={props.onExpandedRowsChange}
      persistState={props.persist}
    />
  )
}

describe('@iris-ui-kit/react IrisTable persistState expandedKeys (batch BY, iris 独有)', () => {
  it('a caret expand saves the expanded keys (detail mode)', () => {
    const storage = makeStorage()
    const onChange = vi.fn()
    render(
      <PersistHarness
        persist={{ storage: { getItem: storage.getItem, setItem: storage.setItem } }}
        onExpandedRowsChange={onChange}
      />,
    )
    act(() => fireEvent.click(toggle(2)))
    expect(onChange).toHaveBeenLastCalledWith(['2'])
    expect(detail(2)).not.toBeNull()
    expect(lastSaved(storage).expandedKeys).toEqual(['2'])
  })

  it('a seeded snapshot restores through the callback AND the DOM expands', () => {
    const storage = makeStorage('{"expandedKeys":["2"]}')
    const onChange = vi.fn()
    render(
      <PersistHarness
        persist={{ storage: { getItem: storage.getItem, setItem: storage.setItem } }}
        onExpandedRowsChange={onChange}
      />,
    )
    expect(onChange).toHaveBeenCalledWith(['2'])
    expect(detail(2)).not.toBeNull()
    expect(toggle(2).getAttribute('aria-expanded')).toBe('true')
    // FULL-SET restore: the seeded set replaces — row 1 stays collapsed.
    expect(detail(1)).toBeNull()
  })

  it('skip-first does not stick: the next toggle saves the full current set', () => {
    const storage = makeStorage('{"expandedKeys":["2"]}')
    render(
      <PersistHarness
        persist={{ storage: { getItem: storage.getItem, setItem: storage.setItem } }}
        onExpandedRowsChange={vi.fn()}
      />,
    )
    expect(detail(2)).not.toBeNull()
    act(() => fireEvent.click(toggle(1)))
    expect(detail(1)).not.toBeNull()
    expect(detail(2)).not.toBeNull()
    expect(lastSaved(storage).expandedKeys).toEqual(['2', '1'])
  })

  it('the mount commit never overwrites storage with the pre-restore (empty) set', () => {
    const storage = makeStorage('{"expandedKeys":["2"]}')
    render(
      <PersistHarness
        persist={{ storage: { getItem: storage.getItem, setItem: storage.setItem } }}
        onExpandedRowsChange={vi.fn()}
      />,
    )
    const stored = JSON.parse(storage.data.get(DEFAULT_KEY)!) as { expandedKeys?: string[] }
    expect(stored.expandedKeys).toEqual(['2'])
    expect(lastSaved(storage).expandedKeys).toEqual(['2'])
  })

  it('include restricts expandedKeys in BOTH directions', () => {
    // Included → restored + saved (and only the listed piece).
    const storage = makeStorage(
      JSON.stringify({ expandedKeys: ['2'], sort: { key: 'name', direction: 'asc' } }),
    )
    const onChange = vi.fn()
    const onSortChange = vi.fn()
    render(
      <PersistHarness
        persist={{
          storage: { getItem: storage.getItem, setItem: storage.setItem },
          include: ['expandedKeys'],
        }}
        onExpandedRowsChange={onChange}
        onSortChange={onSortChange}
      />,
    )
    expect(onChange).toHaveBeenCalledWith(['2'])
    expect(onSortChange).not.toHaveBeenCalled()
    act(() => fireEvent.click(toggle(3)))
    expect(lastSaved(storage).expandedKeys).toEqual(['2', '3'])
    // Excluded → neither restored nor saved.
    cleanup()
    const storage2 = makeStorage('{"expandedKeys":["2"]}')
    const onChange2 = vi.fn()
    render(
      <PersistHarness
        persist={{
          storage: { getItem: storage2.getItem, setItem: storage2.setItem },
          include: ['sort'],
        }}
        onExpandedRowsChange={onChange2}
        onSortChange={vi.fn()}
      />,
    )
    expect(onChange2).not.toHaveBeenCalled()
    act(() => fireEvent.click(toggle(1)))
    expect((lastSaved(storage2) as { expandedKeys?: unknown }).expandedKeys).toBeUndefined()
  })

  it('no onExpandedRowsChange → the piece is inert (toggle works, never persisted)', () => {
    const storage = makeStorage('{"expandedKeys":["2"]}')
    render(
      <PersistHarness
        persist={{ storage: { getItem: storage.getItem, setItem: storage.setItem } }}
        onSortChange={vi.fn()}
      />,
    )
    // Nothing restored — row 1 stays collapsed; the internal model still works.
    expect(detail(1)).toBeNull()
    expect(detail(2)).toBeNull()
    act(() => fireEvent.click(toggle(2)))
    expect(detail(2)).not.toBeNull()
    // A real save happens (the sort channel), but expandedKeys is gated off.
    const saved = lastSaved(storage)
    expect(saved.sort).toEqual(null)
    expect((saved as { expandedKeys?: unknown }).expandedKeys).toBeUndefined()
  })

  it('a flat table is inert — never saved, seeded snapshots never replay', () => {
    const storage = makeStorage('{"expandedKeys":["2"]}')
    const onChange = vi.fn()
    render(
      <PersistHarness
        detail={false}
        persist={{ storage: { getItem: storage.getItem, setItem: storage.setItem } }}
        onExpandedRowsChange={onChange}
        onSortChange={vi.fn()}
      />,
    )
    expect(onChange).not.toHaveBeenCalled()
    expect(document.querySelector('[data-iris-table-expand-toggle]')).toBeNull()
    // The sort channel still saves — expandedKeys is excluded by the gate.
    const saved = lastSaved(storage)
    expect(saved.sort).toEqual(null)
    expect((saved as { expandedKeys?: unknown }).expandedKeys).toBeUndefined()
  })

  it('tree mode parity: caret expand saves, seeded snapshot restores children', () => {
    interface TreeRow extends Record<string, unknown> {
      id: number
      name: string
      children?: TreeRow[]
    }
    const treeData: TreeRow[] = [
      {
        id: 1,
        name: 'Root A',
        children: [
          { id: 11, name: 'A1' },
          { id: 12, name: 'A2' },
        ],
      },
      { id: 2, name: 'Root B' },
    ]
    const treeCols: IrisTableColumn<TreeRow>[] = [{ key: 'name', title: 'Name' }]
    const treeToggle = (rowId: number): HTMLElement =>
      document.querySelector(
        `[data-iris-table-row="${rowId}"] [data-iris-table-tree-toggle]`,
      ) as HTMLElement

    const storage = makeStorage()
    render(
      <IrisTable
        columns={treeCols}
        data={treeData}
        rowKey="id"
        getSubRows={(r) => r.children}
        onExpandedRowsChange={vi.fn()}
        persistState={{ storage: { getItem: storage.getItem, setItem: storage.setItem } }}
      />,
    )
    expect(document.querySelector('[data-iris-table-row="11"]')).toBeNull()
    act(() => fireEvent.click(treeToggle(1)))
    expect(document.querySelector('[data-iris-table-row="11"]')).not.toBeNull()
    expect(lastSaved(storage).expandedKeys).toEqual(['1'])

    // Re-mount from the saved snapshot → the children render again.
    cleanup()
    const storage2 = makeStorage(JSON.stringify({ expandedKeys: ['1'] }))
    const onChange2 = vi.fn()
    render(
      <IrisTable
        columns={treeCols}
        data={treeData}
        rowKey="id"
        getSubRows={(r) => r.children}
        onExpandedRowsChange={onChange2}
        persistState={{ storage: { getItem: storage2.getItem, setItem: storage2.setItem } }}
      />,
    )
    expect(onChange2).toHaveBeenCalledWith(['1'])
    expect(document.querySelector('[data-iris-table-row="11"]')).not.toBeNull()
    expect(treeToggle(1).getAttribute('aria-expanded')).toBe('true')
  })

  it('stale keys and corrupt JSON are fail-inert', () => {
    // Stale keys (no matching row) → no crash, nothing expanded.
    const storage = makeStorage('{"expandedKeys":["99"]}')
    const onChange = vi.fn()
    render(
      <PersistHarness
        persist={{ storage: { getItem: storage.getItem, setItem: storage.setItem } }}
        onExpandedRowsChange={onChange}
      />,
    )
    expect(onChange).toHaveBeenCalledWith(['99'])
    expect(detail(1)).toBeNull()
    expect(detail(2)).toBeNull()
    // The table still works; a toggle keeps the set (stale key inert, real
    // key applies) and the snapshot follows.
    act(() => fireEvent.click(toggle(2)))
    expect(detail(2)).not.toBeNull()
    expect(lastSaved(storage).expandedKeys).toEqual(['99', '2'])
    // Corrupt JSON → no restore, no crash.
    cleanup()
    const storage2 = makeStorage('{oops: not json')
    const onChange2 = vi.fn()
    render(
      <PersistHarness
        persist={{ storage: { getItem: storage2.getItem, setItem: storage2.setItem } }}
        onExpandedRowsChange={onChange2}
      />,
    )
    expect(onChange2).not.toHaveBeenCalled()
    expect(document.querySelector('[role=table]')).not.toBeNull()
  })
})
