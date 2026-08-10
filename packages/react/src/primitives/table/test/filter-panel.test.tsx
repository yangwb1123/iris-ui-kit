import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import * as React from 'react'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'

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

const formatterCols: IrisTableColumn<Row>[] = [
  // Formatter reverses the raw text: formatted order ≠ raw order, so a sort
  // keyed on the formatted text would produce a DIFFERENT row order.
  {
    key: 'name',
    title: 'Name',
    sortable: true,
    formatter: (v) => String(v).split('').reverse().join(''),
  },
  { key: 'status', title: 'Status' },
]

const textareaCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true, editor: 'textarea' },
  { key: 'status', title: 'Status' },
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
]

function rowEls(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll('[data-iris-table-row]:not([data-iris-table-row="header"])'),
  )
}
function cell(rowId: string | number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}
function panel(): HTMLElement | null {
  return document.querySelector('[data-iris-table-filter-panel]')
}
function trigger(): HTMLButtonElement | null {
  return document.querySelector('[data-iris-filter-trigger="status"]')
}

/** Controlled filterValues harness (the prop pair is controlled-only). */
function FilterHarness({
  initial = {},
  onFilterValuesChange,
}: {
  initial?: Record<string, string[]>
  onFilterValuesChange?: (next: Record<string, string[]>) => void
}): React.ReactElement {
  const [filterValues, setFilterValues] = React.useState<Record<string, string[]>>(initial)
  return (
    <IrisTable
      columns={filterCols}
      data={rows}
      rowKey="id"
      filterValues={filterValues}
      onFilterValuesChange={(next) => {
        setFilterValues(next)
        onFilterValuesChange?.(next)
      }}
    />
  )
}

describe('@iris-ui-kit/react IrisTable formatter (vxe formatter parity, batch I)', () => {
  it('renders the formatted text in the body cell and the tooltip', () => {
    render(<IrisTable columns={formatterCols} data={rows} rowKey="id" tooltipConfig={{}} />)
    expect(cell(1, 'name').textContent).toBe('ba') // raw 'ab' reversed
    expect(cell(1, 'name').getAttribute('title')).toBe('ba')
    expect(cell(2, 'name').textContent).toBe('cb')
  })

  it('sorting uses the RAW value — the order is untouched by the formatter', () => {
    render(<IrisTable columns={formatterCols} data={rows} rowKey="id" />)
    // Raw asc: ab, bc, ca — formatted asc would be: ac, ba, cb.
    fireEvent.click(document.querySelector('[data-iris-table-header="name"]')!)
    expect(
      Array.from(rowEls()).map(
        (r) => r.querySelector('[data-iris-table-cell="name"]')?.textContent,
      ),
    ).toEqual(['ba', 'cb', 'ac'])
  })

  it('formatter loses to col.render but wins over the raw value', () => {
    const cols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        render: (v) => `R:${String(v)}`,
        formatter: (v) => `F:${String(v)}`,
      },
      { key: 'status', title: 'Status' },
    ]
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    expect(cell(1, 'name').textContent).toBe('R:ab')
  })

  it('editing a formatter column still reads and commits the RAW value', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, formatter: (v) => `[${String(v)}]` },
      { key: 'status', title: 'Status' },
    ]
    const onCellEdit = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        editConfig={{ trigger: 'click' }}
        onCellEdit={onCellEdit}
      />,
    )
    act(() => {
      fireEvent.click(cell(1, 'name'))
    })
    const input = document.querySelector('[data-iris-table-editor]') as HTMLInputElement
    expect(input.value).toBe('ab') // raw, not '[ab]'
    act(() => {
      fireEvent.change(input, { target: { value: 'zz' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ newValue: 'zz' }))
    expect(cell(1, 'name').textContent).toBe('[zz]')
  })
})

describe('@iris-ui-kit/react IrisTable textarea editor (vxe edit-render parity, batch I)', () => {
  function textareaEditor(): HTMLTextAreaElement | null {
    return document.querySelector('[data-iris-table-editor-textarea]')
  }

  it('double-clicking an editable textarea column opens a rows=3 textarea seeded with the raw value', () => {
    render(<IrisTable columns={textareaCols} data={rows} rowKey="id" />)
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    const ta = textareaEditor()
    expect(ta).not.toBeNull()
    expect(ta!.tagName).toBe('TEXTAREA')
    expect(ta!.getAttribute('rows')).toBe('3')
    expect(ta!.getAttribute('data-iris-table-editor')).toBe('')
    expect(ta!.value).toBe('ab')
  })

  it('Enter commits the draft', () => {
    const onCellEdit = vi.fn()
    render(<IrisTable columns={textareaCols} data={rows} rowKey="id" onCellEdit={onCellEdit} />)
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    const ta = textareaEditor()!
    act(() => {
      fireEvent.change(ta, { target: { value: 'hello world' } })
      fireEvent.keyDown(ta, { key: 'Enter' })
    })
    expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ newValue: 'hello world' }))
    expect(textareaEditor()).toBeNull()
    expect(cell(1, 'name').textContent).toBe('hello world')
  })

  it('Shift+Enter inserts a newline WITHOUT committing', () => {
    const onCellEdit = vi.fn()
    render(<IrisTable columns={textareaCols} data={rows} rowKey="id" onCellEdit={onCellEdit} />)
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    const ta = textareaEditor()!
    act(() => {
      fireEvent.change(ta, { target: { value: 'line1' } })
      fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true })
    })
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(textareaEditor()).not.toBeNull()
    expect(textareaEditor()!.value).toBe('line1')
  })

  it('Escape cancels without emitting', () => {
    const onCellEdit = vi.fn()
    render(<IrisTable columns={textareaCols} data={rows} rowKey="id" onCellEdit={onCellEdit} />)
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    const ta = textareaEditor()!
    act(() => {
      fireEvent.change(ta, { target: { value: 'discard me' } })
      fireEvent.keyDown(ta, { key: 'Escape' })
    })
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(textareaEditor()).toBeNull()
    expect(cell(1, 'name').textContent).toBe('ab')
  })

  it('blur commits', () => {
    const onCellEdit = vi.fn()
    render(<IrisTable columns={textareaCols} data={rows} rowKey="id" onCellEdit={onCellEdit} />)
    act(() => {
      fireEvent.doubleClick(cell(1, 'name'))
    })
    act(() => {
      fireEvent.change(textareaEditor()!, { target: { value: 'blurred' } })
      fireEvent.blur(textareaEditor()!)
    })
    expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ newValue: 'blurred' }))
  })
})

describe('@iris-ui-kit/react IrisTable filter panel (vxe filterConfig parity, batch I)', () => {
  it('a filterable header shows the trigger; clicking it opens the panel WITHOUT sorting', () => {
    render(<FilterHarness />)
    const trg = trigger()
    expect(trg).not.toBeNull()
    expect(trg!.getAttribute('aria-label')).toBe('Filter')
    // The status column is sortable too — the trigger click must not sort.
    fireEvent.click(trg!)
    expect(panel()).not.toBeNull()
    expect(panel()!.parentElement).toBe(document.body)
    expect(panel()!.getAttribute('role')).toBe('dialog')
    expect(panel()!.getAttribute('data-iris-table-filter-column')).toBe('status')
    const options = panel()!.querySelectorAll('[data-iris-filter-option]')
    expect(options.length).toBe(2)
    expect(options[0]!.textContent).toBe('Active')
    expect(options[1]!.textContent).toBe('Paused')
    expect(
      document
        .querySelector('[data-iris-table-header="status"]')
        ?.getAttribute('data-sort-direction'),
    ).toBeNull()
  })

  it('checking options + confirm filters rows (OR-match) and highlights the trigger', () => {
    render(<FilterHarness />)
    fireEvent.click(trigger()!)
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-option="active"] input')!)
    })
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-confirm]') as HTMLElement)
    })
    // OR-match: only 'active' rows survive.
    expect(Array.from(rowEls()).map((r) => r.getAttribute('data-iris-table-row'))).toEqual([
      '1',
      '3',
    ])
    // Trigger highlight state.
    expect(trigger()!.getAttribute('data-iris-filter-active')).toBe('true')

    // A second open pre-checks the applied set; adding 'paused' widens to all.
    fireEvent.click(trigger()!)
    const pausedBox = panel()!.querySelector(
      '[data-iris-filter-option="paused"] input',
    ) as HTMLInputElement
    expect(
      (panel()!.querySelector('[data-iris-filter-option="active"] input') as HTMLInputElement)
        .checked,
    ).toBe(true)
    act(() => {
      fireEvent.click(pausedBox)
    })
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-confirm]') as HTMLElement)
    })
    expect(rowEls().length).toBe(3)
  })

  it('clear removes the filter immediately', () => {
    render(<FilterHarness initial={{ status: ['active'] }} />)
    expect(trigger()!.getAttribute('data-iris-filter-active')).toBe('true')
    fireEvent.click(trigger()!)
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-clear]') as HTMLElement)
    })
    expect(trigger()!.getAttribute('data-iris-filter-active')).toBeNull()
    expect(rowEls().length).toBe(3)
  })

  it('a text filter AND the checked set combine (both must pass)', () => {
    // name contains 'a' AND status in {active}: rows 1 ('ab') and 3 ('ca').
    render(
      <IrisTable
        columns={filterCols}
        data={rows}
        rowKey="id"
        filters={{ name: 'a' }}
        filterValues={{ status: ['active'] }}
      />,
    )
    expect(Array.from(rowEls()).map((r) => r.getAttribute('data-iris-table-row'))).toEqual([
      '1',
      '3',
    ])
  })

  it('the panel closes on outside pointer-down and discards the draft', () => {
    render(<FilterHarness />)
    fireEvent.click(trigger()!)
    expect(panel()).not.toBeNull()
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-option="active"] input')!)
    })
    fireEvent.pointerDown(document.body)
    expect(panel()).toBeNull()
    // Nothing applied.
    expect(rowEls().length).toBe(3)
    expect(trigger()!.getAttribute('data-iris-filter-active')).toBeNull()
  })

  it('Escape closes the panel', () => {
    render(<FilterHarness />)
    fireEvent.click(trigger()!)
    expect(panel()).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(panel()).toBeNull()
  })

  it('a non-filterable column has no trigger; grouped headers only show it on leaves', () => {
    const groupedCols: IrisTableColumn<Row>[] = [
      {
        key: 'group',
        title: 'Group',
        children: [
          {
            key: 'name',
            title: 'Name',
            filterable: true,
            filterOptions: [{ value: 'ab', label: 'AB' }],
          },
          { key: 'status', title: 'Status' },
        ],
      },
    ]
    render(<IrisTable columns={groupedCols} data={rows} rowKey="id" />)
    expect(document.querySelector('[data-iris-filter-trigger="name"]')).not.toBeNull()
    expect(document.querySelector('[data-iris-filter-trigger="status"]')).toBeNull()
    expect(
      document.querySelector('[data-iris-table-header="group"] [data-iris-filter-trigger]'),
    ).toBeNull()
  })
})

describe('@iris-ui-kit/react IrisTable filterValues remote mode (proxy, batch I)', () => {
  it('merges the checked sets into the query filters as comma-joined strings', async () => {
    const query = vi.fn(async () => ({ rows, total: rows.length }))
    const { container } = render(
      <IrisTable
        columns={filterCols}
        data={[]}
        rowKey="id"
        filterValues={{ status: ['active', 'paused'] }}
        proxyConfig={{ query, remoteFilter: true }}
      />,
    )
    await waitFor(() => {
      expect(container.querySelector('[data-iris-table-cell="name"]')).toBeTruthy()
    })
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ filters: { status: 'active,paused' } }),
    )
  })

  it('confirming a filter re-queries with the comma-joined set', async () => {
    const query = vi.fn(async () => ({ rows, total: rows.length }))
    function RemoteHarness(): React.ReactElement {
      const [filterValues, setFilterValues] = React.useState<Record<string, string[]>>({})
      return (
        <IrisTable
          columns={filterCols}
          data={[]}
          rowKey="id"
          filterValues={filterValues}
          onFilterValuesChange={setFilterValues}
          proxyConfig={{ query, remoteFilter: true }}
        />
      )
    }
    render(<RemoteHarness />)
    await waitFor(() => {
      expect(query).toHaveBeenCalledTimes(1)
    })
    fireEvent.click(trigger()!)
    act(() => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-option="active"] input')!)
    })
    await act(async () => {
      fireEvent.click(panel()!.querySelector('[data-iris-filter-confirm]') as HTMLElement)
    })
    await waitFor(() => {
      expect(query).toHaveBeenLastCalledWith(
        expect.objectContaining({ filters: { status: 'active' }, page: 1 }),
      )
    })
  })
})
