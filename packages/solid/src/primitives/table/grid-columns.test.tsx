import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn, IrisTableColumnWidths } from './types'

afterEach(cleanup)

type Row = { id: number; name: string; age: number; status: string }

const rows: Row[] = [{ id: 1, name: 'Alice', age: 32, status: 'active' }]
const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', width: 200 },
  { key: 'age', title: 'Age', width: '96px' },
  { key: 'status', title: 'Status' },
]

function headerStyle(container: HTMLElement): string {
  return (container.querySelector('[data-iris-table-header-row]') as HTMLElement).style
    .gridTemplateColumns
}

function header(container: HTMLElement, key: string): Element | null {
  return container.querySelector(`[data-iris-table-header="${key}"]`)
}

function resizeHandle(container: HTMLElement, key: string): HTMLElement {
  return container.querySelector(
    `[data-iris-table-resize-handle][data-column-key="${key}"]`,
  ) as HTMLElement
}

describe('IrisTable Solid Grid Core columns bridge', () => {
  it('preserves declared and fallback tracks while using the model for resize', () => {
    const onWidthsChange = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        resizableColumns
        onColumnWidthsChange={onWidthsChange}
      />
    ))

    expect(headerStyle(container)).toContain('200px 96px minmax(0, 1fr)')
    expect(onWidthsChange).not.toHaveBeenCalled()

    fireEvent.keyDown(resizeHandle(container, 'name'), { key: 'ArrowRight' })

    expect(headerStyle(container)).toContain('216px 96px minmax(0, 1fr)')
    expect(onWidthsChange).toHaveBeenCalledWith({ name: 216 })
  })

  it('keeps a default width snapshot across controlled to uncontrolled', async () => {
    const [widths, setWidths] = createSignal<IrisTableColumnWidths | undefined>({ name: 310 })
    const onWidthsChange = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnWidths={widths()}
        defaultColumnWidths={{ name: 220 }}
        onColumnWidthsChange={onWidthsChange}
      />
    ))

    expect(headerStyle(container)).toContain('310px 96px minmax(0, 1fr)')
    setWidths({ name: 310 })
    await waitFor(() => expect(headerStyle(container)).toContain('310px 96px minmax(0, 1fr)'))
    expect(onWidthsChange).not.toHaveBeenCalled()

    setWidths(undefined)
    await waitFor(() => expect(headerStyle(container)).toContain('220px 96px minmax(0, 1fr)'))
    expect(onWidthsChange).not.toHaveBeenCalled()
  })

  it('retains an uncontrolled resize when control is adopted and removed', async () => {
    const [widths, setWidths] = createSignal<IrisTableColumnWidths | undefined>(undefined)
    const onWidthsChange = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        defaultColumnWidths={{ name: 100 }}
        columnWidths={widths()}
        resizableColumns
        onColumnWidthsChange={onWidthsChange}
      />
    ))

    fireEvent.keyDown(resizeHandle(container, 'name'), { key: 'ArrowRight' })
    expect(headerStyle(container)).toContain('116px 96px minmax(0, 1fr)')
    expect(onWidthsChange).toHaveBeenCalledWith({ name: 116 })

    setWidths({ name: 310 })
    await waitFor(() => expect(headerStyle(container)).toContain('310px 96px minmax(0, 1fr)'))
    setWidths(undefined)
    await waitFor(() => expect(headerStyle(container)).toContain('116px 96px minmax(0, 1fr)'))
  })

  it('does not optimistically render a rejected controlled resize, then accepts a replacement', async () => {
    const [widths, setWidths] = createSignal<IrisTableColumnWidths>({ name: 150, age: 80 })
    const proposals: IrisTableColumnWidths[] = []
    const onWidthsChange = vi.fn((next: IrisTableColumnWidths) => proposals.push(next))
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnWidths={widths()}
        resizableColumns
        onColumnWidthsChange={onWidthsChange}
      />
    ))

    fireEvent.keyDown(resizeHandle(container, 'name'), { key: 'ArrowRight' })
    expect(proposals).toEqual([{ name: 166, age: 80 }])
    expect(headerStyle(container)).toContain('150px 80px')

    setWidths(proposals[0]!)
    await waitFor(() => expect(headerStyle(container)).toContain('166px 80px'))
    expect(onWidthsChange).toHaveBeenCalledTimes(1)
  })

  it('renders visibility replacements and restores all columns when removed', async () => {
    const [visibility, setVisibility] = createSignal<Record<string, boolean> | undefined>({
      age: false,
    })
    const onVisibilityChange = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnVisibility={visibility()}
        onColumnVisibilityChange={onVisibilityChange}
      />
    ))

    expect(header(container, 'name')).not.toBeNull()
    expect(header(container, 'age')).toBeNull()
    setVisibility({ name: false })
    await waitFor(() => {
      expect(header(container, 'name')).toBeNull()
      expect(header(container, 'age')).not.toBeNull()
    })
    expect(onVisibilityChange).not.toHaveBeenCalled()

    setVisibility(undefined)
    await waitFor(() => {
      expect(header(container, 'name')).not.toBeNull()
      expect(header(container, 'age')).not.toBeNull()
      expect(header(container, 'status')).not.toBeNull()
    })
    expect(onVisibilityChange).not.toHaveBeenCalled()
  })
})
