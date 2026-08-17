import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  city: string
  score: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', city: 'Paris', score: 25 },
  { id: 2, name: 'Alice', city: 'Berlin', score: 32 },
  { id: 3, name: 'Bob', city: 'Paris', score: 25 },
  { id: 4, name: 'Dana', city: 'Lyon', score: 41 },
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'city', title: 'City', editable: true },
  { key: 'score', title: 'Score', editable: true, editor: 'number' },
]

function cell(rowId: string | number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}

function editor(): HTMLInputElement {
  return document.querySelector('[data-iris-table-editor]') as HTMLInputElement
}

function hintAttr(c: HTMLElement): boolean {
  return c.getAttribute('data-iris-input-hint') === 'true'
}

function hintBg(c: HTMLElement): string {
  return c.style.backgroundImage || ''
}

function openEdit(rowId: string | number, colKey: string): void {
  act(() => {
    fireEvent.doubleClick(cell(rowId, colKey))
  })
}

function type(value: string): void {
  act(() => {
    fireEvent.change(editor(), { target: { value } })
  })
}

function commit(): void {
  act(() => {
    fireEvent.keyDown(editor(), { key: 'Enter' })
  })
}

// ── Batch DH (iris 独有): pattern edit — while an inline editor is open, every
// other cell in the SAME column whose committed RAW value matches the current
// draft renders a light hint (data-iris-input-hint + token background). Pure
// visual + attribute; zero state/business logic; realtime per keystroke.
describe('IrisTable pattern (batch DH, iris 独有)', () => {
  it('gating: no hint attributes when pattern is off (default)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    openEdit(1, 'city')
    // All cells in the city column stay unhinted while editing.
    for (const id of [1, 2, 3, 4]) expect(hintAttr(cell(id, 'city'))).toBe(false)
    expect(hintBg(cell(3, 'city'))).toBe('')
  })

  it('gating: no hints outside an active edit session', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" pattern />)
    expect(hintAttr(cell(1, 'city'))).toBe(false)
    expect(hintBg(cell(3, 'city'))).toBe('')
  })

  it('happy path: matching RAW values in the edited column highlight', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" pattern />)
    openEdit(1, 'city')
    // Editing the Paris cell — draft seeds to 'Paris'; other Paris rows light up.
    expect(hintAttr(cell(3, 'city'))).toBe(true)
    expect(hintBg(cell(3, 'city'))).toContain('var(--iris-input-hint')
    expect(hintBg(cell(3, 'city'))).toContain('linear-gradient')
    // Non-matching rows do not highlight.
    expect(hintAttr(cell(2, 'city'))).toBe(false)
    expect(hintAttr(cell(4, 'city'))).toBe(false)
  })

  it('realtime: hints update live per keystroke (no commit needed)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" pattern />)
    openEdit(1, 'city') // draft = 'Paris'
    expect(hintAttr(cell(3, 'city'))).toBe(true)
    // Type 'Berlin' → row 2 (Berlin) highlights, row 3 (Paris) no longer does.
    type('Berlin')
    expect(hintAttr(cell(2, 'city'))).toBe(true)
    expect(hintAttr(cell(3, 'city'))).toBe(false)
  })

  it('raw matching: compares RAW committed values, not the display value', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" pattern />)
    // score 25 appears in rows 1 and 3; editor is number → draft raw string '25'.
    openEdit(1, 'score')
    expect(hintAttr(cell(3, 'score'))).toBe(true)
    expect(hintAttr(cell(2, 'score'))).toBe(false)
  })

  it('fail-closed: an empty draft never floods the whole column', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" pattern />)
    openEdit(1, 'name')
    type('')
    for (const id of [2, 3, 4]) expect(hintAttr(cell(id, 'name'))).toBe(false)
    expect(hintBg(cell(2, 'name'))).toBe('')
  })

  it('only the edited column highlights — other columns stay untouched', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" pattern />)
    openEdit(1, 'city')
    // The name/score columns never receive hints.
    for (const id of [1, 2, 3, 4]) {
      expect(hintAttr(cell(id, 'name'))).toBe(false)
      expect(hintAttr(cell(id, 'score'))).toBe(false)
    }
  })

  it('the editing cell itself is exempt from the hint', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" pattern />)
    openEdit(1, 'city')
    expect(hintAttr(cell(1, 'city'))).toBe(false)
    expect(hintBg(cell(1, 'city'))).toBe('')
  })

  it('locked cells keep their attributes alongside the hint', () => {
    const withLocked: IrisTableColumn<Row>[] = [{ ...cols[0]!, locked: true }, cols[1]!, cols[2]!]
    render(<IrisTable columns={withLocked} data={rows} rowKey="id" pattern />)
    openEdit(1, 'city')
    expect(hintAttr(cell(3, 'city'))).toBe(true)
    expect(cell(1, 'name').getAttribute('data-iris-cell-locked')).not.toBeNull()
  })

  it('row-edit mode does not participate (documented fiat)', () => {
    render(
      <IrisTable columns={cols} data={rows} rowKey="id" pattern editConfig={{ mode: 'row' }} />,
    )
    openEdit(1, 'city')
    // Row mode drafts live in per-column sessions — no shared-store hint.
    for (const id of [1, 2, 3, 4]) expect(hintAttr(cell(id, 'city'))).toBe(false)
  })

  it('coexists with cellRange (selection markers unaffected)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" pattern cellRange />)
    openEdit(1, 'city')
    expect(hintAttr(cell(3, 'city'))).toBe(true)
    // A range on another column does not disturb hints on the edited one.
    expect(hintAttr(cell(2, 'city'))).toBe(false)
  })

  it('commit clears the hints', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" pattern />)
    openEdit(1, 'city')
    expect(hintAttr(cell(3, 'city'))).toBe(true)
    commit()
    // Session closed → no active draft → no hints anywhere.
    for (const id of [1, 2, 3, 4]) {
      expect(hintAttr(cell(id, 'city'))).toBe(false)
    }
  })
})
