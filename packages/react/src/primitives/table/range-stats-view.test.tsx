import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import * as React from 'react'
import { IrisTable } from './Table'
import type { IrisTableColumn, IrisTableViewConfig } from './types'

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

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

const DEFAULT_VIEWS_KEY = 'iris-table-views'
const SAVE_ITEM = '__iris-save-view'

function makeStorage(seed?: string | null): {
  getItem: Mock
  setItem: Mock
  data: Map<string, string>
} {
  const data = new Map<string, string>()
  if (seed != null) data.set(DEFAULT_VIEWS_KEY, seed)
  return {
    getItem: vi.fn((k: string) => data.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => data.set(k, v)),
    data,
  }
}

function lastSaved(storage: {
  setItem: Mock
}): Array<{ name: string; snapshot: Record<string, unknown> }> {
  const calls = storage.setItem.mock.calls as Array<[string, string]>
  expect(calls.length).toBeGreaterThan(0)
  return JSON.parse(calls[calls.length - 1]![1]!) as Array<{
    name: string
    snapshot: Record<string, unknown>
  }>
}

function cell(row: number, col: number): HTMLElement {
  return document.querySelector(
    `[data-iris-cell-row="${row}"][data-iris-cell-col="${col}"]`,
  ) as HTMLElement
}

function bar(): HTMLElement | null {
  return document.querySelector('[data-iris-table-range-toolbar]')
}

function statsButton(): HTMLElement {
  const el = document.querySelector('[data-iris-range-stats]')
  expect(el).not.toBeNull()
  return el as HTMLElement
}

function statsPanel(): HTMLElement | null {
  return document.querySelector('[data-iris-range-stats-panel]')
}

function selectRange(r0: number, c0: number, r1: number, c1: number): void {
  fireEvent.click(cell(r0, c0))
  if (r1 !== r0 || c1 !== c0) fireEvent.click(cell(r1, c1), { shiftKey: true })
}

function viewsSelect(): HTMLSelectElement {
  const el = document.querySelector('[data-iris-table-views]')
  expect(el).not.toBeNull()
  return el as HTMLSelectElement
}

function saveView(name: string): void {
  fireEvent.change(viewsSelect(), { target: { value: SAVE_ITEM } })
  const input = document.querySelector('[data-iris-views-save]') as HTMLInputElement
  expect(input).not.toBeNull()
  fireEvent.change(input, { target: { value: name } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

function queryInput(): HTMLInputElement {
  const el = document.querySelector('[data-iris-table-query-input]')
  expect(el).not.toBeNull()
  return el as HTMLInputElement
}

/** Fully controlled query harness: the parent owns the string via
 * `query` + `onQueryChange`, exactly like the docs' controlled usage. */
function QueryHarness(props: {
  viewsCfg?: IrisTableViewConfig
  initialQuery?: string
  onQueryChange?: Mock
}): React.ReactElement {
  const [query, setQuery] = React.useState(props.initialQuery ?? '')
  return (
    <IrisTable
      columns={cols}
      data={rows}
      rowKey="id"
      views={props.viewsCfg}
      query={query}
      onQueryChange={(next) => {
        setQuery(next)
        props.onQueryChange?.(next)
      }}
    />
  )
}

describe('@iris-ui-kit/react IrisTable range stats (batch AJ, iris 独有)', () => {
  it('stats button toggles the panel; selecting a numeric range shows sum/avg/min/max', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange />)
    expect(statsPanel()).toBeNull()
    selectRange(0, 0, 1, 1) // rows 0..1 × name+age
    expect(statsPanel()).toBeNull() // closed by default
    fireEvent.click(statsButton())
    const panel = statsPanel()
    expect(panel).not.toBeNull()
    const cellTexts = Array.from(panel!.querySelectorAll('[role="cell"]')).map(
      (el) => el.textContent ?? '',
    )
    // name row: count only (sum/avg/min/max show the no-data em dash)
    expect(cellTexts.slice(0, 6)).toEqual(['Name', '2', '—', '—', '—', '—'])
    // age row: 25 + 32 → sum 57, avg 28.5, min 25, max 32
    expect(cellTexts.slice(6, 12)).toEqual(['Age', '2', '57', '28.5', '25', '32'])
    // second click closes
    fireEvent.click(statsButton())
    expect(statsPanel()).toBeNull()
  })

  it('panel stays open across a range change and recomputes for the new range', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange />)
    selectRange(0, 1, 1, 1) // age rows 0..1
    fireEvent.click(statsButton())
    const texts = () =>
      Array.from(statsPanel()!.querySelectorAll('[role="cell"]')).map((el) => el.textContent ?? '')
    expect(texts()).toContain('57')
    // Extend to row 2 → 25 + 32 + 28 = 85; the panel stays open (hoisted state)
    fireEvent.click(cell(2, 1), { shiftKey: true })
    expect(statsPanel()).not.toBeNull()
    expect(texts()).toContain('85')
    expect(texts()).toContain('28.333333333333332') // avg of 85/3
  })

  it('outside pointer-down closes the panel (useDismiss clears the range)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange />)
    selectRange(0, 0, 1, 1)
    fireEvent.click(statsButton())
    expect(statsPanel()).not.toBeNull()
    fireEvent.pointerDown(document.body)
    expect(statsPanel()).toBeNull()
    expect(bar()).toBeNull()
  })

  it('Escape closes the panel', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange />)
    selectRange(0, 0, 1, 1)
    fireEvent.click(statsButton())
    expect(statsPanel()).not.toBeNull()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(statsPanel()).toBeNull()
  })

  it('data shrink out of the selected range bounds does not crash the panel (review regression)', () => {
    // Review HIGH blocker: select range → open 统计 → the view shrinks below
    // the range (batch-AI NL query fires per keystroke and empties the view) →
    // core `rangeStats` returns `{}` → the panel dereferenced undefined.
    const Harness = (): React.ReactElement => {
      const [data, setData] = React.useState<Row[]>(rows)
      return (
        <IrisTable
          columns={cols}
          data={data}
          rowKey="id"
          cellRange
          query={data.length > 1 ? '' : 'name = Bob'}
          onQueryChange={(q) => setData(q === 'name = Bob' ? rows.slice(0, 1) : rows)}
        />
      )
    }
    render(<Harness />)
    selectRange(1, 0, 2, 1) // rows 1..2 of 3
    fireEvent.click(statsButton())
    expect(statsPanel()).not.toBeNull()
    // The shrinking query empties bodyData below the range → the panel must
    // hide (no stats remain), never crash dereferencing undefined stats.
    fireEvent.change(queryInput(), { target: { value: 'name = Bob' } })
    expect(statsPanel()).toBeNull()
    // aria-expanded reflects the hidden panel, not the hoisted open state.
    expect(statsButton().getAttribute('aria-expanded')).toBe('false')
    // The bar survives (the range store is intact) until dismissed.
    expect(bar()).not.toBeNull()
    // The data can grow back → the panel reappears without re-toggling.
    fireEvent.change(queryInput(), { target: { value: '' } })
    expect(statsPanel()).not.toBeNull()
    expect(statsButton().getAttribute('aria-expanded')).toBe('true')
  })
})

describe('@iris-ui-kit/react IrisTable view snapshots carry the query (batch AJ)', () => {
  it('save with a query → the snapshot contains it (gated on views)', () => {
    const storage = makeStorage()
    render(<QueryHarness viewsCfg={{ storage: storageAdapter(storage) }} initialQuery="age > 25" />)
    saveView('Over 25')
    const saved = lastSaved(storage)
    expect(saved[0]!.name).toBe('Over 25')
    expect(saved[0]!.snapshot.query).toBe('age > 25')
  })

  it('apply restores the query FIRST via onQueryChange', () => {
    const seed = JSON.stringify([{ name: 'Devs', snapshot: { query: 'name = Alice' } }])
    const storage = makeStorage(seed)
    const onQueryChange = vi.fn()
    render(
      <QueryHarness
        viewsCfg={{ storage: storageAdapter(storage) }}
        onQueryChange={onQueryChange}
      />,
    )
    expect(queryInput().value).toBe('')
    fireEvent.change(viewsSelect(), { target: { value: 'Devs' } })
    expect(onQueryChange).toHaveBeenCalledWith('name = Alice')
    // The controlled parent state followed the restore.
    expect(queryInput().value).toBe('name = Alice')
  })

  it('legacy views without query apply without touching the query', () => {
    const seed = JSON.stringify([
      { name: 'Legacy', snapshot: { sort: { key: 'name', direction: 'asc' } } },
    ])
    const storage = makeStorage(seed)
    const onQueryChange = vi.fn()
    render(
      <QueryHarness
        viewsCfg={{ storage: storageAdapter(storage) }}
        initialQuery="age > 25"
        onQueryChange={onQueryChange}
      />,
    )
    fireEvent.change(viewsSelect(), { target: { value: 'Legacy' } })
    expect(onQueryChange).not.toHaveBeenCalled()
    expect(queryInput().value).toBe('age > 25')
  })
})

function storageAdapter(storage: { getItem: Mock; setItem: Mock }): {
  getItem: Mock
  setItem: Mock
} {
  return { getItem: storage.getItem, setItem: storage.setItem }
}
