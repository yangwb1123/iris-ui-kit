import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import React from 'react'
import { IrisTable } from '../Table'
import type { IrisTableColumn, IrisTableHandle } from '../types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number | string
  name: string
}

const rows: Row[] = [
  { id: 1, name: 'A' },
  { id: 2, name: 'B' },
  { id: 3, name: 'C' },
]

const columns: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]

/** Locate a row by its string key (the data attr the goToRow highlight sets).
 * Attribute iteration (never selector interpolation) so quoted keys work. */
function rowEl(key: string | number): HTMLElement | null {
  const keyStr = String(key)
  return (
    Array.from(document.querySelectorAll<HTMLElement>('[data-iris-table-row]')).find(
      (n) => n.getAttribute('data-iris-table-row') === keyStr,
    ) ?? null
  )
}

function anyTarget(): HTMLElement | null {
  return document.querySelector('[data-iris-row-target="true"]')
}

describe('@iris-ui-kit/react goToRow (batch CZ, iris 独有)', () => {
  let scrollSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // jsdom does not implement scrollIntoView (the table guards with ?.), so
    // install a counting mock so the goToRow/scrollToRow scroll contract is
    // observable; restored per test so other suites keep the native absence.
    scrollSpy = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollSpy,
    })
  })

  afterEach(() => {
    delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView
  })

  it('① scrolls the target row into view with block nearest', () => {
    const ref = React.createRef<IrisTableHandle<Row>>()
    render(<IrisTable columns={columns} data={rows} rowKey="id" tableRef={ref} />)
    act(() => ref.current?.goToRow(2))
    expect(scrollSpy).toHaveBeenCalledTimes(1)
    expect(scrollSpy).toHaveBeenLastCalledWith({ block: 'nearest' })
  })

  it('② sets the transient data-iris-row-target attribute on the target row', () => {
    const ref = React.createRef<IrisTableHandle<Row>>()
    render(<IrisTable columns={columns} data={rows} rowKey="id" tableRef={ref} />)
    act(() => ref.current?.goToRow(2))
    expect(rowEl(2)?.getAttribute('data-iris-row-target')).toBe('true')
    expect(rowEl(1)?.getAttribute('data-iris-row-target')).toBeNull()
    expect(rowEl(3)?.getAttribute('data-iris-row-target')).toBeNull()
  })

  it('③ the highlight is removed after ROW_TARGET_MS (2s)', () => {
    vi.useFakeTimers()
    try {
      const ref = React.createRef<IrisTableHandle<Row>>()
      render(<IrisTable columns={columns} data={rows} rowKey="id" tableRef={ref} />)
      act(() => ref.current?.goToRow(2))
      expect(rowEl(2)?.getAttribute('data-iris-row-target')).toBe('true')
      act(() => vi.advanceTimersByTime(1999))
      expect(rowEl(2)?.getAttribute('data-iris-row-target')).toBe('true')
      act(() => vi.advanceTimersByTime(1))
      expect(rowEl(2)?.getAttribute('data-iris-row-target')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('④ a re-call restarts the 2s clock before the original deadline', () => {
    vi.useFakeTimers()
    try {
      const ref = React.createRef<IrisTableHandle<Row>>()
      render(<IrisTable columns={columns} data={rows} rowKey="id" tableRef={ref} />)
      act(() => ref.current?.goToRow(2))
      act(() => vi.advanceTimersByTime(1500))
      expect(rowEl(2)?.getAttribute('data-iris-row-target')).toBe('true')
      // Re-call at t=1500: the highlight must survive past the original t=2000.
      act(() => ref.current?.goToRow(2))
      act(() => vi.advanceTimersByTime(1500)) // now t=3000 — past original deadline
      expect(rowEl(2)?.getAttribute('data-iris-row-target')).toBe('true')
      act(() => vi.advanceTimersByTime(500)) // t=3500 — past the restarted deadline
      expect(rowEl(2)?.getAttribute('data-iris-row-target')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('⑤ single-target semantics: targeting a new row clears the previous one', () => {
    vi.useFakeTimers()
    try {
      const ref = React.createRef<IrisTableHandle<Row>>()
      render(<IrisTable columns={columns} data={rows} rowKey="id" tableRef={ref} />)
      act(() => ref.current?.goToRow(1))
      expect(rowEl(1)?.getAttribute('data-iris-row-target')).toBe('true')
      act(() => ref.current?.goToRow(3))
      expect(rowEl(1)?.getAttribute('data-iris-row-target')).toBeNull()
      expect(rowEl(3)?.getAttribute('data-iris-row-target')).toBe('true')
      // The first call's timer was cancelled — only one outstanding target.
      act(() => vi.advanceTimersByTime(2100))
      expect(rowEl(3)?.getAttribute('data-iris-row-target')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('⑥ an unknown / unrendered key is a silent no-op', () => {
    const ref = React.createRef<IrisTableHandle<Row>>()
    render(<IrisTable columns={columns} data={rows} rowKey="id" tableRef={ref} />)
    act(() => ref.current?.goToRow(999))
    expect(scrollSpy).not.toHaveBeenCalled()
    expect(anyTarget()).toBeNull()
  })

  it('⑦ a key containing a double-quote resolves via the safe locator', () => {
    const quoted: Row[] = [
      { id: 'a"b', name: 'Q' },
      { id: 1, name: 'A' },
    ]
    const ref = React.createRef<IrisTableHandle<Row>>()
    render(<IrisTable columns={columns} data={quoted} rowKey="id" tableRef={ref} />)
    act(() => ref.current?.goToRow('a"b'))
    expect(rowEl('a"b')?.getAttribute('data-iris-row-target')).toBe('true')
    expect(scrollSpy).toHaveBeenCalledTimes(1)
  })

  it('⑧ unmount cleanup cancels the timer (no mutation on the detached row)', () => {
    vi.useFakeTimers()
    try {
      const ref = React.createRef<IrisTableHandle<Row>>()
      const { unmount } = render(
        <IrisTable columns={columns} data={rows} rowKey="id" tableRef={ref} />,
      )
      act(() => ref.current?.goToRow(2))
      const el = rowEl(2)
      expect(el?.getAttribute('data-iris-row-target')).toBe('true')
      unmount()
      // el is detached but retains attributes; if the cleanup cleared the
      // timer, advancing past ROW_TARGET_MS leaves the attribute untouched.
      act(() => vi.advanceTimersByTime(3000))
      expect(el?.getAttribute('data-iris-row-target')).toBe('true')
    } finally {
      vi.useRealTimers()
    }
  })

  it('⑨ needs no handlers and fires no events of its own', () => {
    const onCurrentRowChange = vi.fn()
    const ref = React.createRef<IrisTableHandle<Row>>()
    // No onCurrentRowChange handler → goToRow still scrolls + highlights.
    render(<IrisTable columns={columns} data={rows} rowKey="id" tableRef={ref} />)
    act(() => ref.current?.goToRow(2))
    expect(scrollSpy).toHaveBeenCalledTimes(1)
    expect(rowEl(2)?.getAttribute('data-iris-row-target')).toBe('true')
    cleanup()
    // With a handler provided, goToRow still does NOT invoke it.
    const ref2 = React.createRef<IrisTableHandle<Row>>()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        tableRef={ref2}
        onCurrentRowChange={onCurrentRowChange}
      />,
    )
    act(() => ref2.current?.goToRow(3))
    expect(onCurrentRowChange).not.toHaveBeenCalled()
    expect(rowEl(3)?.getAttribute('data-iris-row-target')).toBe('true')
  })

  it('⑩ scrollToRow byte-regression: scrolls but sets no row-target highlight', () => {
    const ref = React.createRef<IrisTableHandle<Row>>()
    render(<IrisTable columns={columns} data={rows} rowKey="id" tableRef={ref} />)
    act(() => ref.current?.scrollToRow(2))
    expect(scrollSpy).toHaveBeenCalledTimes(1)
    expect(scrollSpy).toHaveBeenLastCalledWith({ block: 'nearest' })
    expect(anyTarget()).toBeNull()
  })

  it('⑪ setCurrentRow orthogonality: no target highlight, fires only its own channel', () => {
    const onCurrentRowChange = vi.fn()
    const ref = React.createRef<IrisTableHandle<Row>>()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        tableRef={ref}
        onCurrentRowChange={onCurrentRowChange}
      />,
    )
    act(() => ref.current?.setCurrentRow(2))
    expect(onCurrentRowChange).toHaveBeenCalledTimes(1)
    expect(anyTarget()).toBeNull()
    expect(scrollSpy).not.toHaveBeenCalled()
  })
})
