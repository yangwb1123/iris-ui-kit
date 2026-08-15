import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => {
  cleanup()
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Alexandra', age: 25 },
  { id: 2, name: 'Bob', age: 32 },
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

function cell(rowId: number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}

function popover(): HTMLElement | null {
  return document.querySelector('[data-iris-note-popover]')
}

function hover(rowId: number, key: string): void {
  act(() => fireEvent.mouseEnter(cell(rowId, key)))
}

function leave(rowId: number, key: string): void {
  act(() => fireEvent.mouseLeave(cell(rowId, key)))
}

// ── Hover note preview (batch BM, iris 独有) ─────────────────────────────
describe('IrisTable notePopover hover preview (batch BM, iris 独有)', () => {
  it('hovering a noted cell shows the popover with the note (title replaced, badge intact)', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        annotations={{ '1::name': 'VIP customer' }}
        notePopover
      />,
    )
    const c = cell(1, 'name')
    // Badge stays; the native title is replaced by the popover (undefined).
    expect(c.getAttribute('data-iris-cell-note')).toBe('true')
    expect(c.querySelector('[data-iris-cell-note-badge]')).not.toBeNull()
    expect(c.getAttribute('title')).toBeNull()
    expect(popover()).toBeNull()

    hover(1, 'name')
    const p = popover()
    expect(p).not.toBeNull()
    expect(p!.textContent).toBe('VIP customer')
    expect(p!.getAttribute('data-iris-note-cell')).toBe('1::name')
    expect(p!.getAttribute('role')).toBe('tooltip')
  })

  it('mouseleave closes the popover (native-title semantics)', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        annotations={{ '1::name': 'VIP customer' }}
        notePopover
      />,
    )
    hover(1, 'name')
    expect(popover()).not.toBeNull()
    leave(1, 'name')
    expect(popover()).toBeNull()
  })

  it('Escape closes the popover', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        annotations={{ '1::name': 'VIP customer' }}
        notePopover
      />,
    )
    hover(1, 'name')
    expect(popover()).not.toBeNull()
    act(() => fireEvent.keyDown(document, { key: 'Escape' }))
    expect(popover()).toBeNull()
  })

  it('outside pointer-down closes the popover', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        annotations={{ '1::name': 'VIP customer' }}
        notePopover
      />,
    )
    hover(1, 'name')
    expect(popover()).not.toBeNull()
    act(() => fireEvent.pointerDown(document.body))
    expect(popover()).toBeNull()
  })

  it('any scroll closes the popover (capture phase — nested scrollers count)', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        annotations={{ '1::name': 'VIP customer' }}
        notePopover
      />,
    )
    hover(1, 'name')
    expect(popover()).not.toBeNull()
    act(() => fireEvent.scroll(document))
    expect(popover()).toBeNull()
  })

  it('without notePopover the native title stays and no popover ever mounts', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        annotations={{ '1::name': 'VIP customer' }}
      />,
    )
    const c = cell(1, 'name')
    expect(c.getAttribute('title')).toBe('VIP customer')
    hover(1, 'name')
    expect(popover()).toBeNull()
  })

  it('the dynamic cellNote callback feeds the popover (wins over the map)', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        annotations={{ '1::name': 'map note', '2::name': 'map note 2' }}
        cellNote={(row) => (row.id === 1 ? `dynamic ${row.name}` : null)}
        notePopover
      />,
    )
    hover(1, 'name')
    const p = popover()
    expect(p).not.toBeNull()
    expect(p!.textContent).toBe('dynamic Alexandra')
    // The map-only note on 2::name (dynamic returns null) still previews.
    hover(2, 'name')
    expect(popover()!.textContent).toBe('map note 2')
  })

  it('hovering a second noted cell moves the popover content (A→B follow)', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        annotations={{ '1::name': 'VIP customer', '2::age': 'retiring soon' }}
        notePopover
      />,
    )
    hover(1, 'name')
    expect(popover()!.textContent).toBe('VIP customer')
    hover(2, 'age')
    const p = popover()
    expect(p).not.toBeNull()
    expect(p!.textContent).toBe('retiring soon')
    expect(p!.getAttribute('data-iris-note-cell')).toBe('2::age')
  })

  it('multi-line notes keep their line breaks (pre-wrap)', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        annotations={{ '1::name': 'line one\nline two' }}
        notePopover
      />,
    )
    hover(1, 'name')
    const p = popover()!
    expect(p.textContent).toBe('line one\nline two')
    expect(p.style.whiteSpace).toBe('pre-wrap')
  })

  it('compare-priority: noted cells drop the title for the popover (compare branch untouched)', () => {
    const snapshot: Row[] = [
      { id: 1, name: 'Alexandra X', age: 99 },
      { id: 2, name: 'Bob', age: 32 },
    ]
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        compareWith={snapshot}
        annotations={{ '1::age': 'check this' }}
        notePopover
      />,
    )
    // Noted + changed: the note branch is replaced by the popover
    // (undefined) — no native title on this cell (documented).
    expect(cell(1, 'age').getAttribute('data-iris-cell-changed')).toBe('true')
    expect(cell(1, 'age').getAttribute('title')).toBeNull()
    hover(1, 'age')
    expect(popover()!.textContent).toBe('check this')
    leave(1, 'age')
    // Changed + un-noted: the compare branch is untouched by notePopover.
    expect(cell(1, 'name').getAttribute('data-iris-cell-changed')).toBe('true')
    expect(cell(1, 'name').getAttribute('title')).toBe('Old: Alexandra → New: Alexandra X')
    // And an un-noted changed cell never opens the popover.
    hover(1, 'name')
    expect(popover()).toBeNull()
  })

  it('tooltipConfig still applies to non-noted cells when notePopover is on', () => {
    const withTip: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age' },
    ]
    render(
      <IrisTable
        columns={withTip}
        data={rows}
        rowKey="id"
        tooltipConfig={{
          content: (row: Row, col: IrisTableColumn<Row>) =>
            col.key === 'name' ? 'name tooltip' : '',
        }}
        annotations={{ '1::age': 'check this' }}
        notePopover
      />,
    )
    // Noted cell: popover, no native title.
    expect(cell(1, 'age').getAttribute('title')).toBeNull()
    hover(1, 'age')
    expect(popover()!.textContent).toBe('check this')
    leave(1, 'age')
    // Non-noted cell keeps the tooltipConfig title.
    expect(cell(1, 'name').getAttribute('title')).toBe('name tooltip')
  })

  it('editing cells still preview (native-title exemption unchanged)', () => {
    const editableCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true },
      { key: 'age', title: 'Age' },
    ]
    render(
      <IrisTable
        columns={editableCols}
        data={rows}
        rowKey="id"
        editConfig={{ trigger: 'click' }}
        annotations={{ '1::name': 'VIP customer' }}
        notePopover
      />,
    )
    act(() => fireEvent.click(cell(1, 'name')))
    // Editing cell: title stays exempt (undefined regardless).
    expect(cell(1, 'name').getAttribute('title')).toBeNull()
    hover(1, 'name')
    expect(popover()!.textContent).toBe('VIP customer')
  })

  it('a cell without a note never opens the popover (zero handlers)', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        annotations={{ '1::name': 'VIP customer' }}
        notePopover
      />,
    )
    hover(1, 'age')
    expect(popover()).toBeNull()
    hover(2, 'name')
    expect(popover()).toBeNull()
  })
})
