import * as React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'

/**
 * Batch DY (iris 独有 — raw vxe columnConfig.visible toggles snap): columnFade
 * animates column show/hide — a hiding column stays mounted while its track
 * collapses Wpx→0px and opacity fades to 0 (then commits away), a showing
 * column mounts at 0px / opacity 0 and restores both. Two-phase machine:
 * 'pending' = first paint, 'run' = transition target, double-rAF flip, ONE
 * 200ms commit timer. Test surface: root data-iris-column-fade-active, per-
 * cell data-iris-column-fade="in|out" + inline opacity 0, track '0px',
 * token-driven stylesheet + reduced-motion freeze gate.
 */

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Alice', age: 25 },
  { id: 2, name: 'Bob', age: 32 },
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', width: 100 },
  { key: 'age', title: 'Age', width: 120 },
]

/** Controlled harness: the TEST owns the visibility map (parent-owned prop). */
function FadeApp({
  vis,
  columns = cols,
  fade = true,
  extras,
}: {
  vis: Record<string, boolean>
  columns?: IrisTableColumn<Row>[]
  fade?: boolean
  extras?: Record<string, unknown>
}): React.ReactElement {
  return (
    <IrisTable
      columns={columns}
      data={rows}
      columnVisibility={vis}
      onColumnVisibilityChange={() => {}}
      columnFade={fade}
      {...(extras ?? {})}
    />
  )
}

function rootEl(): HTMLElement {
  return document.querySelector('[data-iris-table]') as HTMLElement
}

function bodyRow(key: string | number = 1): HTMLElement {
  return document.querySelector(`[data-iris-table-row="${key}"]`) as HTMLElement
}

function bodyCell(row: string | number, columnKey: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${row}"] [data-iris-table-cell="${columnKey}"]`,
  ) as HTMLElement
}

function headerCell(columnKey: string): HTMLElement {
  return document.querySelector(`[data-iris-table-header="${columnKey}"]`) as HTMLElement
}

function summaryCell(columnKey: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="summary"] [data-iris-table-cell="${columnKey}"]`,
  ) as HTMLElement
}

function totalsCell(columnKey: string): HTMLElement {
  return document.querySelector(`[data-iris-column-totals-cell="${columnKey}"]`) as HTMLElement
}

function rowTemplate(): string {
  return bodyRow().style.gridTemplateColumns
}

function stepFrames(n = 2): void {
  // One rAF per 16ms fake-timer tick; the double-rAF flip needs two.
  for (let i = 0; i < n; i += 1) act(() => vi.advanceTimersByTime(16))
}

// ── 属性/样式 axes: fail-closed + mount invariants ────────────────────────
describe('IrisTable columnFade (batch DY, iris 独有)', () => {
  it('① fail-closed: no prop → hide is instant (zero fade attrs, no root flag)', () => {
    const { rerender } = render(<FadeApp vis={{}} fade={false} />)
    expect(bodyCell(1, 'age')).not.toBeNull()
    rerender(<FadeApp vis={{ age: false }} fade={false} />)
    // No fade surface anywhere, and the column is gone immediately.
    expect(rootEl().getAttribute('data-iris-column-fade-active')).toBeNull()
    expect(document.querySelector('[data-iris-column-fade]')).toBeNull()
    expect(bodyCell(1, 'age')).toBeNull()
    expect(bodyCell(1, 'name')).not.toBeNull()
  })

  it('② fail-closed: mount-hidden columns never animate (and 0-cell invariant holds)', () => {
    render(<FadeApp vis={{ age: false }} />)
    // Hidden from mount: never mounted, never fades, no machine armed.
    expect(bodyCell(1, 'age')).toBeNull()
    expect(document.querySelector('[data-iris-column-fade]')).toBeNull()
    expect(rootEl().getAttribute('data-iris-column-fade-active')).toBeNull()
    expect(rowTemplate()).toBe('100px')
  })

  it('③ hide phase walk: pending → run → commit', () => {
    vi.useFakeTimers()
    const { rerender } = render(<FadeApp vis={{}} />)
    expect(rowTemplate()).toBe('100px 120px')
    rerender(<FadeApp vis={{ age: false }} />)
    // pending: mounted, attr out, NO inline opacity yet, full track.
    const cell = bodyCell(1, 'age')
    expect(cell).not.toBeNull()
    expect(rootEl().getAttribute('data-iris-column-fade-active')).toBe('true')
    expect(cell.getAttribute('data-iris-column-fade')).toBe('out')
    expect(cell.style.opacity).toBe('')
    expect(rowTemplate()).toBe('100px 120px')
    // run (double rAF): opacity 0 + collapsed 0px track — still mounted.
    stepFrames()
    expect(bodyCell(1, 'age').style.opacity).toBe('0')
    expect(rowTemplate()).toBe('100px 0px')
    expect(bodyCell(1, 'age').getAttribute('data-iris-column-fade')).toBe('out')
    // commit (200ms): cell unmounts, root flag drops, template sheds the track.
    act(() => vi.advanceTimersByTime(200))
    expect(bodyCell(1, 'age')).toBeNull()
    expect(rootEl().getAttribute('data-iris-column-fade-active')).toBeNull()
    expect(document.querySelector('[data-iris-column-fade]')).toBeNull()
    expect(rowTemplate()).toBe('100px')
  })

  it('④ show phase walk: pending → run → commit', () => {
    vi.useFakeTimers()
    const { rerender } = render(<FadeApp vis={{ age: false }} />)
    rerender(<FadeApp vis={{ age: true }} />)
    // pending: mounted at 0px + opacity 0, attr in.
    const cell = bodyCell(1, 'age')
    expect(cell).not.toBeNull()
    expect(rootEl().getAttribute('data-iris-column-fade-active')).toBe('true')
    expect(cell.getAttribute('data-iris-column-fade')).toBe('in')
    expect(cell.style.opacity).toBe('0')
    expect(rowTemplate()).toBe('100px 0px')
    // run: opacity restored + track restored — still fading.
    stepFrames()
    expect(bodyCell(1, 'age').style.opacity).toBe('')
    expect(rowTemplate()).toBe('100px 120px')
    expect(bodyCell(1, 'age').getAttribute('data-iris-column-fade')).toBe('in')
    // commit: attr drops, column stays rendered.
    act(() => vi.advanceTimersByTime(200))
    expect(bodyCell(1, 'age')).not.toBeNull()
    expect(bodyCell(1, 'age').getAttribute('data-iris-column-fade')).toBeNull()
    expect(rootEl().getAttribute('data-iris-column-fade-active')).toBeNull()
    expect(rowTemplate()).toBe('100px 120px')
  })

  it('⑤ two columns toggle together under ONE commit window', () => {
    vi.useFakeTimers()
    const { rerender } = render(<FadeApp vis={{}} />)
    rerender(<FadeApp vis={{ name: false, age: false }} />)
    for (const key of ['name', 'age']) {
      expect(bodyCell(1, key).getAttribute('data-iris-column-fade')).toBe('out')
    }
    stepFrames()
    expect(bodyCell(1, 'name').style.opacity).toBe('0')
    expect(bodyCell(1, 'age').style.opacity).toBe('0')
    expect(rowTemplate()).toBe('0px 0px')
    act(() => vi.advanceTimersByTime(200))
    expect(bodyCell(1, 'name')).toBeNull()
    expect(bodyCell(1, 'age')).toBeNull()
    expect(rowTemplate()).toBe('')
  })

  it('⑥ reversal: hide → show mid-run restarts the fade in (column never unmounts)', () => {
    vi.useFakeTimers()
    const { rerender } = render(<FadeApp vis={{}} />)
    rerender(<FadeApp vis={{ age: false }} />)
    stepFrames()
    expect(bodyCell(1, 'age').style.opacity).toBe('0') // mid-run
    rerender(<FadeApp vis={{ age: true }} />)
    // Same frame state (0px + opacity 0 is also the 'in' pending), new attr.
    expect(bodyCell(1, 'age')).not.toBeNull()
    expect(bodyCell(1, 'age').getAttribute('data-iris-column-fade')).toBe('in')
    expect(bodyCell(1, 'age').style.opacity).toBe('0')
    expect(rowTemplate()).toBe('100px 0px')
    stepFrames()
    expect(bodyCell(1, 'age').style.opacity).toBe('')
    expect(rowTemplate()).toBe('100px 120px')
    act(() => vi.advanceTimersByTime(200))
    expect(bodyCell(1, 'age').getAttribute('data-iris-column-fade')).toBeNull()
    expect(bodyCell(1, 'age')).not.toBeNull()
  })

  it('⑦ reversal: show → hide mid-run collapses again', () => {
    vi.useFakeTimers()
    const { rerender } = render(<FadeApp vis={{ age: false }} />)
    rerender(<FadeApp vis={{ age: true }} />)
    stepFrames()
    expect(rowTemplate()).toBe('100px 120px') // in-run: restored
    rerender(<FadeApp vis={{ age: false }} />)
    expect(bodyCell(1, 'age').getAttribute('data-iris-column-fade')).toBe('out')
    stepFrames()
    expect(bodyCell(1, 'age').style.opacity).toBe('0')
    expect(rowTemplate()).toBe('100px 0px')
    act(() => vi.advanceTimersByTime(200))
    expect(bodyCell(1, 'age')).toBeNull()
  })

  it('⑧ opacity key absence when not fading (attr undefined, no inline opacity)', () => {
    render(<FadeApp vis={{}} />)
    expect(bodyCell(1, 'name').style.opacity).toBe('')
    expect(bodyCell(1, 'age').style.opacity).toBe('')
    expect(bodyCell(1, 'age').getAttribute('data-iris-column-fade')).toBeNull()
    expect(rootEl().getAttribute('data-iris-column-fade-active')).toBeNull()
  })

  it('⑨ template restores by string identity after commit (equals a never-shown table)', () => {
    vi.useFakeTimers()
    const { rerender } = render(<FadeApp vis={{}} />)
    rerender(<FadeApp vis={{ age: false }} />)
    stepFrames()
    expect(rowTemplate()).toBe('100px 0px')
    act(() => vi.advanceTimersByTime(200))
    const after = rowTemplate()
    expect(after).toBe('100px')
    // A table that NEVER had the column renders the exact same template string.
    const { container } = render(<FadeApp vis={{ age: false }} />)
    const other = (container.querySelector('[data-iris-table-row="1"]') as HTMLElement).style
      .gridTemplateColumns
    expect(after).toBe(other)
  })

  it('⑩ non-numeric default tracks degrade gracefully (1fr columns still fade)', () => {
    vi.useFakeTimers()
    const frCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age' },
    ]
    const { rerender } = render(<FadeApp vis={{}} columns={frCols} />)
    expect(rowTemplate()).toBe('minmax(0, 1fr) minmax(0, 1fr)')
    rerender(<FadeApp vis={{ age: false }} columns={frCols} />)
    const cell = bodyCell(1, 'age')
    expect(cell.getAttribute('data-iris-column-fade')).toBe('out')
    stepFrames()
    // The machine still drives the track to 0px + opacity 0 (interpolation of
    // minmax is a CSS-level matter — gracefully hops back at commit).
    expect(cell.style.opacity).toBe('0')
    expect(rowTemplate()).toBe('minmax(0, 1fr) 0px')
    act(() => vi.advanceTimersByTime(200))
    expect(bodyCell(1, 'age')).toBeNull()
    expect(rowTemplate()).toBe('minmax(0, 1fr)')
  })

  it('⑪ header cells carry the same fade surface (attr, opacity, unmount)', () => {
    vi.useFakeTimers()
    const { rerender } = render(<FadeApp vis={{}} />)
    rerender(<FadeApp vis={{ age: false }} />)
    expect(headerCell('age').getAttribute('data-iris-column-fade')).toBe('out')
    expect(headerCell('age').style.opacity).toBe('')
    stepFrames()
    expect(headerCell('age').style.opacity).toBe('0')
    act(() => vi.advanceTimersByTime(200))
    expect(headerCell('age')).toBeNull()
    expect(headerCell('name')).not.toBeNull()
  })

  it('⑫ summary-row cells carry the fade surface (global summary path)', () => {
    vi.useFakeTimers()
    const sumCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', width: 100 },
      { key: 'age', title: 'Age', width: 120, summary: 'sum' },
    ]
    const { rerender } = render(<FadeApp vis={{}} columns={sumCols} />)
    expect(summaryCell('age')).not.toBeNull()
    rerender(<FadeApp vis={{ age: false }} columns={sumCols} />)
    expect(summaryCell('age').getAttribute('data-iris-column-fade')).toBe('out')
    stepFrames()
    expect(summaryCell('age').style.opacity).toBe('0')
    act(() => vi.advanceTimersByTime(200))
    // Committed: age (the ONLY summary column) is gone; with no summary op
    // left in leafColumns the whole global summary row drops out.
    expect(summaryCell('age')).toBeNull()
    expect(document.querySelector('[data-iris-table-row="summary"]')).toBeNull()
  })

  it('⑬ column-totals cells carry the fade surface', () => {
    vi.useFakeTimers()
    const sumCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', width: 100 },
      { key: 'age', title: 'Age', width: 120, summary: 'sum' },
    ]
    const { rerender } = render(
      <FadeApp vis={{}} columns={sumCols} extras={{ columnTotals: true }} />,
    )
    expect(totalsCell('age')).not.toBeNull()
    rerender(<FadeApp vis={{ age: false }} columns={sumCols} extras={{ columnTotals: true }} />)
    expect(totalsCell('age').getAttribute('data-iris-column-fade')).toBe('out')
    stepFrames()
    expect(totalsCell('age').style.opacity).toBe('0')
    act(() => vi.advanceTimersByTime(200))
    expect(totalsCell('age')).toBeNull()
  })

  it('⑭ grouped parent: overlay expands to every leaf cell + leaf track', () => {
    vi.useFakeTimers()
    const grouped: IrisTableColumn<Row>[] = [
      {
        key: 'personal',
        title: 'Personal',
        children: [
          { key: 'name', title: 'Name', width: 100 },
          { key: 'age', title: 'Age', width: 120 },
        ],
      },
      { key: 'extra', title: 'Extra', width: 80 },
    ]
    const { rerender } = render(<FadeApp vis={{}} columns={grouped} />)
    expect(rowTemplate()).toBe('100px 120px 80px')
    // The group-parent header fades via its own key; leaves via the expansion.
    rerender(<FadeApp vis={{ personal: false }} columns={grouped} />)
    expect(headerCell('personal').getAttribute('data-iris-column-fade')).toBe('out')
    expect(bodyCell(1, 'name').getAttribute('data-iris-column-fade')).toBe('out')
    expect(bodyCell(1, 'age').getAttribute('data-iris-column-fade')).toBe('out')
    stepFrames()
    expect(bodyCell(1, 'name').style.opacity).toBe('0')
    expect(bodyCell(1, 'age').style.opacity).toBe('0')
    expect(rowTemplate()).toBe('0px 0px 80px')
    act(() => vi.advanceTimersByTime(200))
    expect(bodyCell(1, 'name')).toBeNull()
    expect(bodyCell(1, 'age')).toBeNull()
    expect(bodyCell(1, 'extra')).not.toBeNull()
    expect(rowTemplate()).toBe('80px')
  })

  it('⑮ stylesheet: token-driven opacity + grid-template transitions + freeze gate', () => {
    render(<FadeApp vis={{}} />)
    const css = (document.getElementById('iris-table-row-styles') as HTMLElement).textContent ?? ''
    expect(css).toContain(
      '[data-iris-column-fade-active] [data-iris-column-fade] {\n  transition: opacity var(--iris-duration-md, 200ms) ease;',
    )
    expect(css).toContain(
      '[data-iris-column-fade-active] [role="row"] {\n  transition: grid-template-columns var(--iris-duration-md, 200ms) ease;',
    )
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('transition: none !important;')
    // No hardcoded non-token duration.
    expect(css).not.toContain('transition-duration: 200ms')
  })

  it('⑯ reduced motion: JS skip → instant show/hide (no fade surface, zero timers)', () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    const { rerender } = render(<FadeApp vis={{}} />)
    rerender(<FadeApp vis={{ age: false }} />)
    // Instant: the column unmounts with no attr, no root flag, no timers.
    expect(bodyCell(1, 'age')).toBeNull()
    expect(document.querySelector('[data-iris-column-fade]')).toBeNull()
    expect(rootEl().getAttribute('data-iris-column-fade-active')).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    // re-show is instant too.
    rerender(<FadeApp vis={{ age: true }} />)
    expect(bodyCell(1, 'age')).not.toBeNull()
    expect(bodyCell(1, 'age').getAttribute('data-iris-column-fade')).toBeNull()
  })

  it('⑰ settle invariants: full cycle leaves zero timers; a later toggle re-bases', () => {
    vi.useFakeTimers()
    const { rerender } = render(<FadeApp vis={{}} />)
    rerender(<FadeApp vis={{ age: false }} />)
    stepFrames()
    // Exactly ONE commit timer is pending during the run (single timer design).
    expect(vi.getTimerCount()).toBe(1)
    act(() => vi.advanceTimersByTime(200))
    expect(vi.getTimerCount()).toBe(0)
    expect(rootEl().getAttribute('data-iris-column-fade-active')).toBeNull()
    // A later show works after the completed cycle (machine re-based).
    rerender(<FadeApp vis={{ age: true }} />)
    expect(bodyCell(1, 'age').getAttribute('data-iris-column-fade')).toBe('in')
    stepFrames()
    act(() => vi.advanceTimersByTime(200))
    expect(vi.getTimerCount()).toBe(0)
    expect(bodyCell(1, 'age').getAttribute('data-iris-column-fade')).toBeNull()
    expect(rowTemplate()).toBe('100px 120px')
  })
})
