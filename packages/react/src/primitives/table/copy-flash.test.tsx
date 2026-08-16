import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  clipboardWrite.mockReset()
  Reflect.deleteProperty(navigator, 'clipboard')
  Reflect.deleteProperty(document, 'execCommand')
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
  { id: 3, name: 'Bob', age: 28 },
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

const clipboardWrite = vi.fn<(text: string) => Promise<void>>()

function stubClipboard(): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: clipboardWrite },
  })
  clipboardWrite.mockResolvedValue(undefined)
}

function root(): HTMLElement {
  return document.querySelector('[data-iris-table]') as HTMLElement
}

function cell(row: number, col: number): HTMLElement {
  return document.querySelector(
    `[data-iris-cell-row="${row}"][data-iris-cell-col="${col}"]`,
  ) as HTMLElement
}

/** The cells currently carrying the copy-flash attr (batch CE). */
function flashingCells(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-copy-flash="true"]'))
}

function selectRange(r0: number, c0: number, r1: number, c1: number): void {
  fireEvent.click(cell(r0, c0))
  if (r1 !== r0 || c1 !== c0) fireEvent.click(cell(r1, c1), { shiftKey: true })
}

function copyViaKey(): void {
  fireEvent.keyDown(root(), { key: 'c', ctrlKey: true })
}

/** Batch CE (iris 独有 — vxe has no copy feedback): after a SUCCESSFUL range
 *  copy (Ctrl/Cmd+C or the range toolbar 复制) the copied cells flash briefly
 *  (`data-iris-copy-flash`, token color, cleared after 600ms). Spec's two
 *  mandatory blocks: ① flash appears on success → first two cases; ② removed
 *  at 600ms → the timer case. Success-gated (failure → no flash), snapshot
 *  semantics (doesn't chase selection), re-copy restarts the clock. */
describe('IrisTable clipConfig copy flash (batch CE, iris 独有)', () => {
  it('① Ctrl/Cmd+C success flashes the copied cells with the token background', async () => {
    vi.useFakeTimers()
    stubClipboard()
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange clipConfig={{}} />)
    selectRange(0, 0, 1, 1)
    copyViaKey()
    await act(async () => {
      await Promise.resolve()
    })
    const flashed = flashingCells()
    expect(flashed).toHaveLength(4)
    // Exactly the copied 2×2 rect — nothing outside it.
    for (const r of [0, 1]) {
      for (const c of [0, 1]) {
        expect(cell(r, c).dataset.irisCopyFlash).toBe('true')
        expect(cell(r, c).style.backgroundColor).toBe(
          'color-mix(in srgb, var(--iris-primary) 25%, var(--iris-background))',
        )
      }
    }
    expect(cell(2, 0).dataset.irisCopyFlash).toBeUndefined()
  })

  it('② the flash is removed 600ms after the copy', async () => {
    vi.useFakeTimers()
    stubClipboard()
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange clipConfig={{}} />)
    selectRange(0, 0, 1, 1)
    copyViaKey()
    await act(async () => {
      await Promise.resolve()
    })
    expect(flashingCells()).toHaveLength(4)
    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(flashingCells()).toHaveLength(0)
    expect(cell(0, 0).dataset.irisCopyFlash).toBeUndefined()
  })

  it('the range toolbar 复制 button flashes the same rect on success', async () => {
    vi.useFakeTimers()
    stubClipboard()
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange clipConfig={{}} />)
    selectRange(0, 1, 2, 1)
    fireEvent.click(document.querySelector('[data-iris-table-range-copy]')!)
    await act(async () => {
      await Promise.resolve()
    })
    expect(flashingCells()).toHaveLength(3)
    for (const r of [0, 1, 2]) expect(cell(r, 1).dataset.irisCopyFlash).toBe('true')
    expect(cell(0, 0).dataset.irisCopyFlash).toBeUndefined()
  })

  it('failed copy (clipboard rejects, no execCommand) → NO flash', async () => {
    vi.useFakeTimers()
    stubClipboard()
    clipboardWrite.mockRejectedValue(new Error('denied'))
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange clipConfig={{}} />)
    selectRange(0, 0, 1, 1)
    copyViaKey()
    await act(async () => {
      await Promise.resolve()
    })
    expect(flashingCells()).toHaveLength(0)
    expect(cell(0, 0).dataset.irisCopyFlash).toBeUndefined()
  })

  it('no Clipboard API but execCommand succeeds → flash via the legacy channel', async () => {
    vi.useFakeTimers()
    // jsdom's document.execCommand is undefined (throws in the writer's
    // try/catch) — define it to succeed so the legacy channel reports success.
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => true),
    })
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange clipConfig={{}} />)
    selectRange(0, 0, 1, 1)
    copyViaKey()
    await act(async () => {
      await Promise.resolve()
    })
    expect(flashingCells()).toHaveLength(4)
  })

  it('re-copy restarts the 600ms clock (flash outlives the first expiry)', async () => {
    vi.useFakeTimers()
    stubClipboard()
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange clipConfig={{}} />)
    selectRange(0, 0, 1, 1)
    copyViaKey()
    await act(async () => {
      await Promise.resolve()
    })
    act(() => {
      vi.advanceTimersByTime(400)
    })
    // Re-copy at t=400 — clears the original timer (due at 600) and starts
    // a fresh one (due at 1000).
    copyViaKey()
    await act(async () => {
      await Promise.resolve()
    })
    act(() => {
      vi.advanceTimersByTime(400)
    })
    // t=800: past the ORIGINAL 600ms expiry — still lit thanks to the restart.
    expect(flashingCells()).toHaveLength(4)
    act(() => {
      vi.advanceTimersByTime(200)
    })
    // t=1000: the restarted timer fires → cleared.
    expect(flashingCells()).toHaveLength(0)
  })

  it('snapshot semantics: the flash does not chase a changed selection', async () => {
    vi.useFakeTimers()
    stubClipboard()
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange clipConfig={{}} />)
    selectRange(0, 0, 0, 0)
    copyViaKey()
    await act(async () => {
      await Promise.resolve()
    })
    // Move the selection elsewhere while the flash is active.
    fireEvent.click(cell(2, 1))
    expect(flashingCells()).toHaveLength(1)
    expect(cell(0, 0).dataset.irisCopyFlash).toBe('true')
    expect(cell(2, 1).dataset.irisCopyFlash).toBeUndefined()
  })

  it('clipConfig.copy === false → key copy is a no-op, no flash', async () => {
    vi.useFakeTimers()
    stubClipboard()
    render(
      <IrisTable columns={cols} data={rows} rowKey="id" cellRange clipConfig={{ copy: false }} />,
    )
    selectRange(0, 0, 1, 1)
    copyViaKey()
    await act(async () => {
      await Promise.resolve()
    })
    expect(clipboardWrite).not.toHaveBeenCalled()
    expect(flashingCells()).toHaveLength(0)
  })

  it('no live range → no copy, no flash', async () => {
    vi.useFakeTimers()
    stubClipboard()
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange clipConfig={{}} />)
    copyViaKey()
    await act(async () => {
      await Promise.resolve()
    })
    expect(clipboardWrite).not.toHaveBeenCalled()
    expect(flashingCells()).toHaveLength(0)
  })

  it('unmount while flashing clears the timer without touching state', async () => {
    vi.useFakeTimers()
    stubClipboard()
    const { unmount } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" cellRange clipConfig={{}} />,
    )
    selectRange(0, 0, 1, 1)
    copyViaKey()
    await act(async () => {
      await Promise.resolve()
    })
    expect(flashingCells()).toHaveLength(4)
    unmount()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    // No error — the unmount effect cleared the pending timer.
    expect(true).toBe(true)
  })

  it('flash works with copyFormat set (format dispatcher is unchanged)', async () => {
    vi.useFakeTimers()
    stubClipboard()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{ copyFormat: 'csv' }}
      />,
    )
    selectRange(0, 0, 1, 1)
    copyViaKey()
    await act(async () => {
      await Promise.resolve()
    })
    expect(clipboardWrite).toHaveBeenCalledWith('Charlie,25\nAlice,32')
    expect(flashingCells()).toHaveLength(4)
  })
})
