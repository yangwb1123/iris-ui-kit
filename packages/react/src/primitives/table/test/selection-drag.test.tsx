import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IrisTable } from '../index'
import type { IrisTableColumn } from '../types'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  // jsdom has no document.elementFromPoint — the stub added per-test is
  // removed so a later test never sees a stale hit-test.
  delete (document as { elementFromPoint?: unknown }).elementFromPoint
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  children?: Row[]
}

const rows: Row[] = [
  { id: 1, name: 'A' },
  { id: 2, name: 'B' },
  { id: 3, name: 'C' },
  { id: 4, name: 'D' },
]

const cols: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]

const treeRows: Row[] = [
  {
    id: 1,
    name: 'P1',
    children: [
      { id: 2, name: 'C1' },
      { id: 3, name: 'C2' },
    ],
  },
  { id: 4, name: 'P2', children: [{ id: 5, name: 'C3' }] },
]

function root(): HTMLElement {
  return document.querySelector('[data-iris-table]') as HTMLElement
}

function rowEl(key: string): HTMLElement {
  return document.querySelector(`[data-iris-table-row="${key}"]`) as HTMLElement
}

function selCell(key: string): HTMLElement {
  return rowEl(key).querySelector('[data-iris-table-cell="__selection"]') as HTMLElement
}

function rowCheckbox(key: string): HTMLInputElement {
  return rowEl(key).querySelector('input[type=checkbox]') as HTMLInputElement
}

/** Row checkboxes in body order (the first checkbox is the header select-all). */
function checkedKeys(): string[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[type=checkbox]'))
    .slice(1)
    .filter((c) => c.checked)
    .map((c) => c.closest('[data-iris-table-row]')!.getAttribute('data-iris-table-row')!)
    .sort()
}

function checkedRadios(): number {
  return document.querySelectorAll('input[type=radio]:checked').length
}

function stubPointerAt(target: Element | null): void {
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: () => target,
  })
}

// jsdom has no PointerEvent — dispatch plain Events with pointer fields (the
// vxe-parity rowDrag pattern). act() flushes the React state updates between
// events, so the move handler sees the pointerdown-set pending press.
function pointerEvent(type: string, init: Record<string, unknown> = {}): Event {
  const ev = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(ev, init)
  return ev
}

function firePointer(el: Element, type: string, init: Record<string, unknown> = {}): void {
  act(() => {
    el.dispatchEvent(pointerEvent(type, init))
  })
}

/** Press the selection cell of `fromKey` (no move yet). */
function press(key: string, x = 10, y = 10): HTMLElement {
  const cell = selCell(key)
  firePointer(cell, 'pointerdown', { button: 0, clientX: x, clientY: y, pointerId: 1 })
  return cell
}

/** Move the pointer (past the 4px threshold) onto the row `key`. */
function moveTo(key: string | Element | null, x = 200, y = 200): void {
  stubPointerAt(typeof key === 'string' ? rowEl(key) : key)
  firePointer(root(), 'pointermove', { clientX: x, clientY: y, pointerId: 1 })
}

function release(x = 200, y = 200): void {
  firePointer(root(), 'pointerup', { clientX: x, clientY: y, pointerId: 1 })
}

/** Full drag from `fromKey` to `toKey` + the trailing click (suppressed). */
function dragRange(fromKey: string, toKey: string): void {
  const cell = press(fromKey)
  moveTo(toKey)
  release()
  fireEvent.click(cell)
}

describe('@iris-ui-kit/react IrisTable selectionDrag (batch BT, iris 独有)', () => {
  it('① drags from row 1 to row 4 and checks the whole closed interval', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" selectable="multi" selectionDrag />)
    dragRange('1', '4')
    expect(checkedKeys()).toEqual(['1', '2', '3', '4'])
  })

  it('② skips checkMethod-disabled rows during the drag (not checked AND disabled)', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        selectable="multi"
        selectionDrag
        checkMethod={(row) => (row.id as number) % 2 === 1}
      />,
    )
    dragRange('1', '4')
    // Even ids (2, 4) are vetoed; odd ids (1, 3) are checked.
    expect(checkedKeys()).toEqual(['1', '3'])
    expect(rowCheckbox('2').disabled).toBe(true)
    expect(rowCheckbox('4').disabled).toBe(true)
  })

  it('③ a plain click still toggles a single row (no drag, no capture, no suppression)', () => {
    const capture = vi.fn()
    const proto = HTMLElement.prototype as { setPointerCapture?: (...args: unknown[]) => void }
    proto.setPointerCapture = capture
    try {
      render(<IrisTable columns={cols} data={rows} rowKey="id" selectable="multi" selectionDrag />)
      // Press + sub-threshold move + release — no drag starts, nothing checked,
      // and (batch-BT review HIGH) NO pointer capture on the bare press.
      press('1')
      expect(capture).not.toHaveBeenCalled()
      moveTo('2', 12, 12) // within the 4px threshold
      release(12, 12)
      expect(checkedKeys()).toEqual([])
      // The bare click reaches the checkbox LABEL (the only click surface —
      // the input is pointerEvents:none) and toggles exactly one row.
      const label = rowEl('1').querySelector('[data-iris-checkbox]') as HTMLElement
      fireEvent.click(label)
      expect(checkedKeys()).toEqual(['1'])
      expect(capture).not.toHaveBeenCalled()
    } finally {
      delete proto.setPointerCapture
    }
  })

  it('④ pointer capture is deferred to the drag start — never on a bare press', () => {
    const capture = vi.fn()
    const proto = HTMLElement.prototype as { setPointerCapture?: (...args: unknown[]) => void }
    proto.setPointerCapture = capture
    try {
      render(<IrisTable columns={cols} data={rows} rowKey="id" selectable="multi" selectionDrag />)
      const cell = press('1')
      expect(capture).not.toHaveBeenCalled() // bare press: no capture
      moveTo('3') // threshold crossed → drag starts → capture the press cell
      expect(capture).toHaveBeenCalledTimes(1)
      expect(capture.mock.calls[0]![0]).toBe(1) // pointerId
      release()
      fireEvent.click(cell)
      expect(checkedKeys()).toEqual(['1', '2', '3'])
    } finally {
      delete proto.setPointerCapture
    }
  })

  it('④ the trailing click after a drag is suppressed (no double-toggle of the anchor)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" selectable="multi" selectionDrag />)
    dragRange('1', '2')
    expect(checkedKeys()).toEqual(['1', '2'])
    // A second bare click on the anchor cell must NOT toggle it off.
    fireEvent.click(selCell('1'))
    expect(checkedKeys()).toEqual(['1', '2'])
  })

  it('⑤ pointercancel clears the suppression arm — the next click still toggles', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" selectable="multi" selectionDrag />)
    press('1')
    moveTo('3') // threshold crossed → drag starts → arm set
    expect(checkedKeys()).toEqual(['1', '2', '3'])
    // Abort the drag — no trailing click follows a cancel (batch-BT review
    // LOW: the stale arm must not swallow the next click).
    firePointer(root(), 'pointercancel', { pointerId: 1 })
    const label4 = rowEl('4').querySelector('[data-iris-checkbox]') as HTMLElement
    fireEvent.click(label4)
    expect(checkedKeys()).toEqual(['1', '2', '3', '4'])
  })

  it('⑥ reverse drag (anchor at row 4, dragging up) checks rows 1–4', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" selectable="multi" selectionDrag />)
    dragRange('4', '1')
    expect(checkedKeys()).toEqual(['1', '2', '3', '4'])
  })

  it('⑦ drag is additive — pre-existing selections are retained', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" selectable="multi" selectionDrag />)
    fireEvent.click(rowCheckbox('1'))
    expect(checkedKeys()).toEqual(['1'])
    dragRange('3', '4')
    expect(checkedKeys()).toEqual(['1', '3', '4'])
  })

  it('⑧ shrinking the interval mid-drag never unchecks (monotonic union)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" selectable="multi" selectionDrag />)
    const cell = press('1')
    moveTo('3') // interval [1,3] → 1,2,3
    moveTo('1') // interval [1,1] — subset, nothing new, nothing lost
    moveTo('2') // interval [1,2] — still a subset
    release()
    fireEvent.click(cell)
    expect(checkedKeys()).toEqual(['1', '2', '3'])
  })

  it('⑨ without the prop the drag is inert (no press handler, nothing checked)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" selectable="multi" />)
    press('1')
    moveTo('4')
    release()
    fireEvent.click(selCell('1'))
    expect(checkedKeys()).toEqual([])
  })

  it('⑩ single mode is a no-op — dragging never checks a range', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" selectable="single" selectionDrag />)
    press('1')
    moveTo('3')
    release()
    fireEvent.click(selCell('1'))
    expect(checkedRadios()).toBe(0)
  })

  it('⑪ controlled mode has no optimistic flip — parent rejects, UI stays empty', () => {
    const onChange = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        selectable="multi"
        selectionDrag
        selection={[]}
        onSelectionChange={onChange}
      />,
    )
    press('1')
    moveTo('3')
    release()
    fireEvent.click(selCell('1'))
    // The parent received the whole union…
    expect(onChange).toHaveBeenLastCalledWith([1, 2, 3])
    // …but never applied it — the rendered checkboxes stay unchecked.
    expect(checkedKeys()).toEqual([])
  })

  it('⑫ tree mode drags across the flattened visible rows', () => {
    render(
      <IrisTable
        columns={cols}
        data={treeRows}
        rowKey="id"
        selectable="multi"
        selectionDrag
        getSubRows={(row) => row.children}
        expandAll
      />,
    )
    // Flattened order: P1(1), C1(2), C2(3), P2(4), C3(5).
    dragRange('1', '4')
    expect(checkedKeys()).toEqual(['1', '2', '3', '4'])
  })

  it('⑬ a checkMethod-disabled anchor can still start the drag', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        selectable="multi"
        selectionDrag
        checkMethod={(row) => (row.id as number) !== 1}
      />,
    )
    // Anchor row 1 is disabled — the drag still checks rows 2–3.
    dragRange('1', '3')
    expect(checkedKeys()).toEqual(['2', '3'])
  })

  it('⑭ hovering a non-row area keeps the last applied range', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" selectable="multi" selectionDrag />)
    const cell = press('1')
    moveTo('2')
    expect(checkedKeys()).toEqual(['1', '2'])
    // The header row carries data-iris-table-row="header" — unresolvable as a
    // body index → ignored.
    const header = document.querySelector<HTMLElement>('[data-iris-table-row="header"]')
    if (header) moveTo(header, 300, 40)
    // The table root itself has no data-iris-table-row at all → ignored.
    moveTo(root(), 300, 40)
    release(300, 40)
    fireEvent.click(cell)
    expect(checkedKeys()).toEqual(['1', '2'])
  })
})
