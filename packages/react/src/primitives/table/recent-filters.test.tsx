import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import * as React from 'react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  status: string
  level: number
}

const rows: Row[] = [
  { id: 1, name: 'ab', status: 'active', level: 1 },
  { id: 2, name: 'bc', status: 'paused', level: 2 },
  { id: 3, name: 'ca', status: 'active', level: 3 },
]

const filterCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', sortable: true },
  {
    key: 'status',
    title: 'Status',
    sortable: true,
    filterable: true,
    filterOptions: [
      { value: 'active', label: 'Active' },
      { value: 'paused', label: 'Paused' },
    ],
  },
  {
    key: 'level',
    title: 'Level',
    filterable: true,
    filterOptions: [
      { value: '1', label: 'One' },
      { value: '2', label: 'Two' },
    ],
  },
]

function panel(): HTMLElement | null {
  return document.querySelector('[data-iris-table-filter-panel]')
}
function trigger(key: string): HTMLButtonElement | null {
  return document.querySelector(`[data-iris-filter-trigger="${key}"]`)
}
function recentTitle(): HTMLElement | null {
  return document.querySelector('[data-iris-filter-recent-title]')
}
function recentEntry(i: number): HTMLElement | null {
  return document.querySelector(`[data-iris-filter-recent="${i}"]`)
}

/** Controlled filterValues harness (the prop pair is controlled-only). */
function FilterHarness({
  onFilterValuesChange,
}: {
  onFilterValuesChange?: (next: Record<string, string[]>) => void
}): React.ReactElement {
  const [filterValues, setFilterValues] = React.useState<Record<string, string[]>>({})
  return (
    <IrisTable
      columns={filterCols}
      data={rows}
      rowKey="id"
      recentFilters
      filterValues={filterValues}
      onFilterValuesChange={(next) => {
        setFilterValues(next)
        onFilterValuesChange?.(next)
      }}
    />
  )
}

describe('@iris-ui-kit/react IrisTable recent filters (batch CB, iris 独有)', () => {
  it('records a confirmed non-empty set; an empty set (clear) is never recorded', () => {
    render(<FilterHarness />)
    // Open + clear immediately → no record (empty set = clear semantics).
    act(() => {
      fireEvent.click(trigger('status')!)
    })
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-clear]') as HTMLElement)
    })
    act(() => {
      fireEvent.click(trigger('status')!)
    })
    expect(recentTitle()).toBeNull()

    // Confirm a non-empty set → recorded; the reopened panel shows it.
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-option="active"] input')!)
    })
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-confirm]') as HTMLElement)
    })
    act(() => {
      fireEvent.click(trigger('status')!)
    })
    expect(recentTitle()!.textContent).toBe('Recent filters')
    expect(recentEntry(0)!.textContent).toBe('Status: Active')
  })

  it('renders recent entries above the options with a muted title', () => {
    render(<FilterHarness />)
    act(() => {
      fireEvent.click(trigger('status')!)
    })
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-option="active"] input')!)
    })
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-confirm]') as HTMLElement)
    })
    act(() => {
      fireEvent.click(trigger('level')!)
    })
    const title = recentTitle()!
    expect(title.textContent).toBe('Recent filters')
    // The recent section sits ABOVE the options in DOM order.
    const firstOpt = panel()!.querySelector('[data-iris-filter-option]')!
    expect(title.compareDocumentPosition(firstOpt) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(recentEntry(0)!.textContent).toBe('Status: Active')
    expect(recentEntry(1)).toBeNull()
  })

  it('clicking a recent entry applies it immediately (cross-column) and closes', () => {
    const onChange = vi.fn()
    render(<FilterHarness onFilterValuesChange={onChange} />)
    // Record on the status column…
    act(() => {
      fireEvent.click(trigger('status')!)
    })
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-option="active"] input')!)
    })
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-confirm]') as HTMLElement)
    })
    // …then open the LEVEL column's panel and apply the status entry.
    act(() => {
      fireEvent.click(trigger('level')!)
    })
    act(() => {
      fireEvent.click(recentEntry(0)!)
    })
    expect(onChange).toHaveBeenLastCalledWith({ status: ['active'] })
    expect(panel()).toBeNull()
  })

  it('label resolves column title + option labels; unknown values fall back raw', () => {
    const cols: IrisTableColumn<Row>[] = [
      {
        key: 'status',
        title: 'Status',
        filterable: true,
        filterOptions: [
          { value: 'active', label: 'Active' },
          { value: 'paused', label: 'Paused' },
        ],
      },
      { key: 'level', title: 'Level', filterable: true, filterOptions: [] },
    ]
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        recentFilters
        filterValues={{}}
        onFilterValuesChange={() => undefined}
      />,
    )
    act(() => {
      fireEvent.click(trigger('status')!)
    })
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-option="paused"] input')!)
      fireEvent.click(panel()!.querySelector('[data-iris-filter-option="active"] input')!)
    })
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-confirm]') as HTMLElement)
    })
    act(() => {
      fireEvent.click(trigger('level')!)
    })
    expect(recentEntry(0)!.textContent).toBe('Status: Paused, Active')
  })

  it('re-confirming the same set bumps the entry to the top (MRU)', () => {
    render(<FilterHarness />)
    // 1. Confirm status=active.
    act(() => {
      fireEvent.click(trigger('status')!)
    })
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-option="active"] input')!)
    })
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-confirm]') as HTMLElement)
    })
    // 2. Confirm level=1 — newest entry.
    act(() => {
      fireEvent.click(trigger('level')!)
    })
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-option="1"] input')!)
    })
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-confirm]') as HTMLElement)
    })
    // 3. Re-confirm status=active as-is (the option is pre-checked from the
    // applied filterValues) — the same set must bump back to index 0.
    act(() => {
      fireEvent.click(trigger('status')!)
    })
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-confirm]') as HTMLElement)
    })
    act(() => {
      fireEvent.click(trigger('status')!)
    })
    expect(recentEntry(0)!.textContent).toBe('Status: Active')
    expect(recentEntry(1)!.textContent).toBe('Level: One')
    // The ring did not duplicate the re-confirmed entry.
    expect(panel()!.querySelectorAll('[data-iris-filter-recent]').length).toBe(2)
  })

  it('is fully lazy without the recentFilters prop (no recording, no section)', () => {
    render(
      <IrisTable
        columns={filterCols}
        data={rows}
        rowKey="id"
        filterValues={{}}
        onFilterValuesChange={() => undefined}
      />,
    )
    act(() => {
      fireEvent.click(trigger('status')!)
    })
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-option="active"] input')!)
    })
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-confirm]') as HTMLElement)
    })
    act(() => {
      fireEvent.click(trigger('status')!)
    })
    expect(recentTitle()).toBeNull()
    expect(panel()!.querySelector('[data-iris-filter-recent]')).toBeNull()
  })

  it('records even without an onFilterValuesChange handler (controlled-irrelevant)', () => {
    render(
      <IrisTable columns={filterCols} data={rows} rowKey="id" recentFilters filterValues={{}} />,
    )
    act(() => {
      fireEvent.click(trigger('status')!)
    })
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-option="active"] input')!)
    })
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-confirm]') as HTMLElement)
    })
    act(() => {
      fireEvent.click(trigger('status')!)
    })
    expect(recentEntry(0)!.textContent).toBe('Status: Active')
  })
})
