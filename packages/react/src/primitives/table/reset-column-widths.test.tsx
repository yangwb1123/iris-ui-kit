import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import * as React from 'react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
]

const baseColumns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

const DECLARED_COLS: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', width: 150 },
  { key: 'age', title: 'Age', width: 'auto' },
  { key: 'city', title: 'City' },
]

function resetButton(): HTMLElement | null {
  return document.querySelector('[data-iris-table-toolbar-reset-widths]')
}

function gridCols(): string {
  return (document.querySelector('[data-iris-table-row="header"]') as HTMLElement).style
    .gridTemplateColumns
}

function handle(key: string): HTMLElement | null {
  return document.querySelector(`[data-iris-table-resize-handle][data-column-key="${key}"]`)
}

describe('@iris-ui-kit/react IrisTable columnWidthsReset (batch BO, iris 独有)', () => {
  // ── 按钮 ────────────────────────────────────────────────────────────────
  it('renders the reset button in the toolbar with aria-label and ⇔ glyph', () => {
    render(
      <IrisTable columns={baseColumns} data={rows} rowKey="id" toolbar={{}} columnWidthsReset />,
    )
    const btn = resetButton()
    expect(btn).not.toBeNull()
    expect(btn!.getAttribute('aria-label')).toBe('Reset column widths')
    expect(btn!.getAttribute('title')).toBe('Reset column widths')
    expect(btn!.textContent).toContain('⇔')
  })

  it('renders no reset button without columnWidthsReset', () => {
    const { container } = render(
      <IrisTable columns={baseColumns} data={rows} rowKey="id" toolbar={{}} />,
    )
    expect(container.querySelector('[data-iris-table-toolbar]')).not.toBeNull()
    expect(resetButton()).toBeNull()
  })

  it('renders no reset button without a toolbar (like zoomConfig, the prop alone does not create one)', () => {
    const { container } = render(
      <IrisTable columns={baseColumns} data={rows} rowKey="id" columnWidthsReset />,
    )
    expect(container.querySelector('[data-iris-table-toolbar]')).toBeNull()
    expect(resetButton()).toBeNull()
  })

  // ── 重置回调（受控） ─────────────────────────────────────────────────────
  it('click fires onColumnWidthsChange with the empty map exactly once (controlled)', () => {
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        toolbar={{}}
        columnWidthsReset
        columnWidths={{ name: 150, age: 80 }}
        onColumnWidthsChange={onChange}
      />,
    )
    act(() => {
      fireEvent.click(resetButton()!)
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({})
  })

  it('parent applying {} falls back to the column-declared widths (number/auto/1fr)', () => {
    function Harness(): React.ReactElement {
      const [widths, setWidths] = React.useState<Record<string, number>>({ name: 150, age: 80 })
      return (
        <IrisTable
          columns={DECLARED_COLS}
          data={rows}
          rowKey="id"
          toolbar={{}}
          columnWidthsReset
          columnWidths={widths}
          onColumnWidthsChange={(next) => setWidths(next)}
        />
      )
    }
    render(<Harness />)
    expect(gridCols()).toContain('150px')
    expect(gridCols()).toContain('80px')
    expect(gridCols()).not.toContain('minmax(max-content, max-content)')
    act(() => {
      fireEvent.click(resetButton()!)
    })
    // Parent re-renders with the canonical 默认映射 {} — declared widths win.
    expect(gridCols()).toContain('150px')
    expect(gridCols()).toContain('minmax(max-content, max-content)')
    expect(gridCols()).toContain('minmax(0, 1fr)')
    expect(gridCols()).not.toContain('80px')
  })

  // ── 非受控 ──────────────────────────────────────────────────────────────
  it('uncontrolled: resize to 116 then reset → back to the DECLARED width (not the mount seed)', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', width: 120 },
      { key: 'age', title: 'Age' },
    ]
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        toolbar={{}}
        columnWidthsReset
        resizableColumns
        defaultColumnWidths={{ name: 100 }}
      />,
    )
    expect(gridCols()).toContain('100px')
    act(() => {
      fireEvent.keyDown(handle('name')!, { key: 'ArrowRight' }) // 100+16=116
    })
    expect(gridCols()).toContain('116px')
    act(() => {
      fireEvent.click(resetButton()!)
    })
    // Reset target = column-DECLARED width (120), not the 100 mount seed.
    expect(gridCols()).toContain('120px')
    expect(gridCols()).not.toContain('116px')
  })

  it('uncontrolled: the callback still fires with {} (dual channel, setColumnWidth precedent)', () => {
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        toolbar={{}}
        columnWidthsReset
        defaultColumnWidths={{ name: 100 }}
        onColumnWidthsChange={onChange}
      />,
    )
    act(() => {
      fireEvent.click(resetButton()!)
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({})
  })

  it('reset works without resizableColumns (controlled widths are resettable too)', () => {
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        toolbar={{}}
        columnWidthsReset
        columnWidths={{ name: 200 }}
        onColumnWidthsChange={onChange}
      />,
    )
    expect(handle('name')).toBeNull()
    act(() => {
      fireEvent.click(resetButton()!)
    })
    expect(onChange).toHaveBeenCalledWith({})
  })

  // ── 不触发其他回调 ──────────────────────────────────────────────────────
  it('click does not trigger sorting or other callbacks', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', sortable: true },
      { key: 'age', title: 'Age', sortable: true },
    ]
    const onSortChange = vi.fn()
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        toolbar={{}}
        columnWidthsReset
        onSortChange={onSortChange}
        onColumnWidthsChange={onChange}
      />,
    )
    act(() => {
      fireEvent.click(resetButton()!)
    })
    expect(onSortChange).not.toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({})
  })

  // ── persistState ────────────────────────────────────────────────────────
  it('persistState: reset saves {} and a remount restores it → default widths', () => {
    const storage: { data: Map<string, string>; getItem: Mock; setItem: Mock } = {
      data: new Map(),
      getItem: vi.fn((k: string) => storage.data.get(k) ?? null),
      setItem: vi.fn((k: string, v: string) => {
        storage.data.set(k, v)
      }),
    }
    function Harness(): React.ReactElement {
      const [widths, setWidths] = React.useState<Record<string, number>>({ name: 150 })
      return (
        <IrisTable
          columns={[
            { key: 'name', title: 'Name', width: 120 },
            { key: 'age', title: 'Age' },
          ]}
          data={rows}
          rowKey="id"
          toolbar={{}}
          columnWidthsReset
          columnWidths={widths}
          onColumnWidthsChange={(next) => setWidths(next)}
          persistState={{ storage: { getItem: storage.getItem, setItem: storage.setItem } }}
        />
      )
    }
    const first = render(<Harness />)
    expect(gridCols()).toContain('150px')
    act(() => {
      fireEvent.click(resetButton()!)
    })
    expect(gridCols()).toContain('120px') // declared width wins through {}
    expect(storage.setItem).toHaveBeenCalled()
    const calls = storage.setItem.mock.calls as Array<[string, string]>
    const saved = JSON.parse(calls[calls.length - 1]![1]!) as { columnWidths?: unknown }
    expect(saved.columnWidths).toEqual({})
    first.unmount()
    render(<Harness />)
    // Restore replays onColumnWidthsChange({}) → declared widths, not the 150 seed.
    expect(gridCols()).toContain('120px')
    expect(gridCols()).not.toContain('150px')
  })
})
