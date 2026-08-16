import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import * as React from 'react'
import { IrisTable } from './Table'
import type {
  IrisTableColumn,
  IrisTableSortState,
  IrisTableTab,
  IrisTableViewConfig,
} from './types'

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
  { key: 'age', title: 'Age', sortable: true },
]

const DEFAULT_KEY = 'iris-table-views'

/** Stored views seeded like a user-saved toolbar session (batch AH shape). */
const seedSingle = JSON.stringify([
  { name: 'NameAsc', snapshot: { sort: { key: 'name', direction: 'asc' } } },
  { name: 'AgeAsc', snapshot: { sort: { key: 'age', direction: 'asc' } } },
])

/** Two views that overlap on `sort` — for the later-wins order test. */
const seedOrdered = JSON.stringify([
  {
    name: 'First',
    snapshot: { sort: { key: 'name', direction: 'asc' }, columnOrder: ['age', 'name'] },
  },
  { name: 'Second', snapshot: { sort: { key: 'age', direction: 'desc' } } },
])

/** In-memory Storage adapter stub (same shape as the views tests). */
function makeStorage(seed?: string | null): { getItem: Mock; setItem: Mock } {
  const data = new Map<string, string>()
  if (seed != null) data.set(DEFAULT_KEY, seed)
  return {
    getItem: vi.fn((k: string) => data.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => {
      data.set(k, v)
    }),
  }
}

function tabsStrip(): HTMLElement {
  const el = document.querySelector('[data-iris-table-tabs]')
  expect(el).not.toBeNull()
  return el as HTMLElement
}

function tabButtons(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-table-tab]'))
}

function tab(key: string): HTMLElement {
  const el = document.querySelector(`[data-iris-table-tab="${key}"]`)
  expect(el).not.toBeNull()
  return el as HTMLElement
}

function viewsSelect(): HTMLSelectElement {
  const el = document.querySelector('[data-iris-table-views]')
  expect(el).not.toBeNull()
  return el as HTMLSelectElement
}

function toolbarEl(): HTMLElement {
  const el = document.querySelector('[data-iris-table-toolbar]')
  expect(el).not.toBeNull()
  return el as HTMLElement
}

interface HarnessProps {
  tabs?: IrisTableTab[]
  viewsCfg?: IrisTableViewConfig
  layouts?: { toolbar?: 'top' | 'hidden' }
  onSortChange?: Mock
  onColumnOrderChange?: Mock
  onActiveViewChange?: Mock
}

/** Fully CONTROLLED table: sort/columnOrder are parent-owned through
 * callbacks, so a tab click's view apply is observable through them. */
function TabsHarness(props: HarnessProps): React.ReactElement {
  const { tabs, viewsCfg, layouts, onSortChange, onColumnOrderChange, onActiveViewChange } = props
  const [sort, setSort] = React.useState<IrisTableSortState | null>(null)
  const [columnOrder, setColumnOrder] = React.useState<string[]>([])
  return (
    <IrisTable
      columns={baseColumns}
      data={rows}
      rowKey="id"
      tableTabs={tabs}
      views={viewsCfg}
      layouts={layouts}
      onActiveViewChange={onActiveViewChange}
      sort={sort}
      onSortChange={(next) => {
        setSort(next)
        onSortChange?.(next)
      }}
      columnOrder={columnOrder}
      onColumnOrderChange={(next) => {
        setColumnOrder(next)
        onColumnOrderChange?.(next)
      }}
    />
  )
}

describe('@iris-ui-kit/react IrisTable tableTabs (batch CT, iris 独有)', () => {
  it('renders a role=tablist strip above the toolbar — nothing active until the first click', () => {
    render(
      <TabsHarness
        tabs={[
          { key: 'by-name', label: 'By Name', views: ['NameAsc'] },
          { key: 'by-age', label: 'By Age', views: ['AgeAsc'] },
        ]}
        viewsCfg={{ storage: makeStorage(seedSingle) }}
      />,
    )
    const strip = tabsStrip()
    expect(strip.getAttribute('role')).toBe('tablist')
    // The strip is the fragment's first element (no form in this harness).
    expect(strip.previousElementSibling).toBeNull()
    // The strip sits above the toolbar (the toolbar follows it in DOM order).
    expect(strip.nextElementSibling?.getAttribute('data-iris-table-toolbar')).not.toBeNull()
    const buttons = tabButtons()
    expect(buttons.map((b) => b.textContent)).toEqual(['By Name', 'By Age'])
    expect(buttons.map((b) => b.getAttribute('aria-selected'))).toEqual(['false', 'false'])
  })

  it('fail-closed: no strip without the prop (or with an empty array) and the toolbar keeps its top radius', () => {
    // Bare table (no tableTabs): zero tabs DOM, toolbar radius untouched.
    render(<IrisTable columns={baseColumns} data={rows} rowKey="id" toolbar={{}} />)
    expect(document.querySelector('[data-iris-table-tabs]')).toBeNull()
    expect(toolbarEl().style.borderTopLeftRadius).toBe('var(--iris-radius-md, 6px)')
    expect(toolbarEl().style.borderTopRightRadius).toBe('var(--iris-radius-md, 6px)')
    cleanup()
    // Empty array: also zero tabs DOM.
    render(<IrisTable columns={baseColumns} data={rows} rowKey="id" tableTabs={[]} />)
    expect(document.querySelector('[data-iris-table-tabs]')).toBeNull()
  })

  it('clicking a tab applies its single view through selectView + the toolbar select mirrors it', () => {
    const onSortChange = vi.fn()
    const onActiveViewChange = vi.fn()
    render(
      <TabsHarness
        tabs={[{ key: 'asc', label: 'Asc', views: ['NameAsc'] }]}
        viewsCfg={{ storage: makeStorage(seedSingle) }}
        onSortChange={onSortChange}
        onActiveViewChange={onActiveViewChange}
      />,
    )
    expect(viewsSelect().value).toBe('')
    act(() => fireEvent.click(tab('asc')))
    // The SAME selectView path: snapshot replayed through the callbacks…
    expect(onSortChange).toHaveBeenCalledTimes(1)
    expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'asc' })
    expect(document.querySelector('[aria-sort="ascending"]')).not.toBeNull()
    // …the view is selected (onActiveViewChange = the selectView notification)…
    expect(onActiveViewChange).toHaveBeenCalledWith('NameAsc')
    // …and the toolbar select mirrors the applied view.
    expect(viewsSelect().value).toBe('NameAsc')
    expect(tab('asc').getAttribute('aria-selected')).toBe('true')
  })

  it('multi-view tabs apply IN ORDER — the later view wins on overlapping pieces', () => {
    const onSort = vi.fn()
    const onOrder = vi.fn()
    render(
      <TabsHarness
        tabs={[{ key: 'combo', label: 'Combo', views: ['First', 'Second'] }]}
        viewsCfg={{ storage: makeStorage(seedOrdered) }}
        onSortChange={onSort}
        onColumnOrderChange={onOrder}
      />,
    )
    act(() => fireEvent.click(tab('combo')))
    // First applies sort + order, Second overrides sort (later wins).
    expect(onSort).toHaveBeenCalledTimes(2)
    expect(onSort).toHaveBeenLastCalledWith({ key: 'age', direction: 'desc' })
    expect(onOrder).toHaveBeenCalledTimes(1)
    expect(onOrder).toHaveBeenCalledWith(['age', 'name'])
    expect(document.querySelector('[aria-sort="descending"]')).not.toBeNull()
    // The toolbar select mirrors the LAST applied view.
    expect(viewsSelect().value).toBe('Second')
  })

  it('unknown view names are skipped fail-inert (the tab activates, nothing applies)', () => {
    const onSortChange = vi.fn()
    const onActiveViewChange = vi.fn()
    render(
      <TabsHarness
        tabs={[{ key: 'ghost', label: 'Ghost', views: ['Nope'] }]}
        viewsCfg={{ storage: makeStorage(seedSingle) }}
        onSortChange={onSortChange}
        onActiveViewChange={onActiveViewChange}
      />,
    )
    act(() => fireEvent.click(tab('ghost')))
    expect(onSortChange).not.toHaveBeenCalled()
    expect(onActiveViewChange).not.toHaveBeenCalled()
    expect(tab('ghost').getAttribute('aria-selected')).toBe('true')
  })

  it('an empty views array renders an inert tab (click applies nothing)', () => {
    const onSortChange = vi.fn()
    const onActiveViewChange = vi.fn()
    render(
      <TabsHarness
        tabs={[{ key: 'empty', label: 'Empty', views: [] }]}
        viewsCfg={{ storage: makeStorage(seedSingle) }}
        onSortChange={onSortChange}
        onActiveViewChange={onActiveViewChange}
      />,
    )
    expect(tabButtons().map((b) => b.textContent)).toEqual(['Empty'])
    act(() => fireEvent.click(tab('empty')))
    expect(onSortChange).not.toHaveBeenCalled()
    expect(onActiveViewChange).not.toHaveBeenCalled()
    expect(tab('empty').getAttribute('aria-selected')).toBe('true')
  })

  it('without a views config the strip renders but clicks are inert', () => {
    const onSortChange = vi.fn()
    render(
      <TabsHarness
        tabs={[{ key: 'solo', label: 'Solo', views: ['NameAsc'] }]}
        onSortChange={onSortChange}
      />,
    )
    // The strip renders (independent of the toolbar gate — no toolbar here).
    expect(tabsStrip()).not.toBeNull()
    expect(document.querySelector('[data-iris-table-toolbar]')).toBeNull()
    act(() => fireEvent.click(tab('solo')))
    // selectView's fail-inert guard: no views loaded → nothing applied.
    expect(onSortChange).not.toHaveBeenCalled()
  })

  it('clicking switches the active tab (aria-selected moves)', () => {
    render(
      <TabsHarness
        tabs={[
          { key: 'a', label: 'A', views: ['NameAsc'] },
          { key: 'b', label: 'B', views: ['AgeAsc'] },
        ]}
        viewsCfg={{ storage: makeStorage(seedSingle) }}
      />,
    )
    act(() => fireEvent.click(tab('a')))
    expect(tab('a').getAttribute('aria-selected')).toBe('true')
    expect(tab('b').getAttribute('aria-selected')).toBe('false')
    act(() => fireEvent.click(tab('b')))
    expect(tab('a').getAttribute('aria-selected')).toBe('false')
    expect(tab('b').getAttribute('aria-selected')).toBe('true')
    // The select mirrors the last clicked tab's view.
    expect(viewsSelect().value).toBe('AgeAsc')
  })

  it('duplicate tab keys keep the first occurrence (render + apply)', () => {
    const onSortChange = vi.fn()
    render(
      <TabsHarness
        tabs={[
          { key: 'dup', label: 'First', views: ['NameAsc'] },
          { key: 'dup', label: 'Second', views: ['AgeAsc'] },
        ]}
        viewsCfg={{ storage: makeStorage(seedSingle) }}
        onSortChange={onSortChange}
      />,
    )
    const buttons = tabButtons()
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.textContent).toBe('First')
    act(() => fireEvent.click(tab('dup')))
    expect(onSortChange).toHaveBeenLastCalledWith({ key: 'name', direction: 'asc' })
  })

  it('radius coordination: tabs take the top radius, toolbar drops it; toolbar: hidden keeps the tabs', () => {
    // Tabs + toolbar (pulled out by `views`): the strip owns the top radius.
    render(
      <TabsHarness
        tabs={[{ key: 'asc', label: 'Asc', views: ['NameAsc'] }]}
        viewsCfg={{ storage: makeStorage(seedSingle) }}
      />,
    )
    expect(tabsStrip().style.borderTopLeftRadius).toBe('var(--iris-radius-md, 6px)')
    expect(toolbarEl().style.borderTopLeftRadius).toBe('')
    expect(toolbarEl().style.borderTopRightRadius).toBe('')
    cleanup()
    // toolbar: 'hidden' suppresses the toolbar but NOT the tabs strip.
    render(
      <TabsHarness
        tabs={[{ key: 'asc', label: 'Asc', views: ['NameAsc'] }]}
        viewsCfg={{ storage: makeStorage(seedSingle) }}
        layouts={{ toolbar: 'hidden' }}
      />,
    )
    expect(document.querySelector('[data-iris-table-toolbar]')).toBeNull()
    expect(tabButtons().map((b) => b.textContent)).toEqual(['Asc'])
    act(() => fireEvent.click(tab('asc')))
    // With the toolbar gone the select is gone too, but the tab still applies.
    expect(document.querySelector('[data-iris-table-views]')).toBeNull()
  })
})
