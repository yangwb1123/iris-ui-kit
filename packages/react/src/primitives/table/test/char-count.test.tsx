import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import * as React from 'react'
import { IrisTable } from '../Table'
import { IrisI18nProvider } from '../../../i18n'
import type { IrisTableColumn } from '../types'

afterEach(() => {
  cleanup()
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
  city: string
  note: string
  val: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25, city: 'Rome', note: 'alpha', val: 1.234 },
  { id: 2, name: 'Alice', age: 32, city: 'Oslo', note: 'beta', val: 2.345 },
  { id: 3, name: 'Bob', age: 28, city: 'Lyon', note: 'gamma', val: 3.456 },
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'age', title: 'Age', editable: true, editor: 'number' },
  { key: 'city', title: 'City' },
]

function cell(row: number, col: number): HTMLElement {
  return document.querySelector(
    `[data-iris-cell-row="${row}"][data-iris-cell-col="${col}"]`,
  ) as HTMLElement
}

/** The editing tests run without `cellRange`, so cells are addressed by row
 *  key + column key (the `data-iris-cell-row` attrs only exist with cellRange). */
function editCell(rowId: number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}

function editor(): HTMLInputElement | null {
  return document.querySelector('[data-iris-table-editor]')
}

function editBadge(): HTMLElement | null {
  return document.querySelector('[data-iris-char-count-edit]')
}

function rangeBadge(): HTMLElement | null {
  return document.querySelector('[data-iris-char-count-range]')
}

function openEditor(rowId: number, key: string): void {
  fireEvent.doubleClick(editCell(rowId, key))
}

function selectRange(r0: number, c0: number, r1: number, c1: number): void {
  fireEvent.click(cell(r0, c0))
  if (r1 !== r0 || c1 !== c0) fireEvent.click(cell(r1, c1), { shiftKey: true })
}

describe('IrisTable charCount — 编辑计数 (live character count)', () => {
  it('shows the live count and grows as the draft grows', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" charCount />)
    openEditor(1, 'name')
    expect(editBadge()!.textContent).toBe('7 chars') // 'Charlie'
    fireEvent.change(editor()!, { target: { value: 'Charlie Edited' } })
    expect(editBadge()!.textContent).toBe('14 chars')
  })

  it('counts DOWN when the draft shrinks (deletion)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" charCount />)
    openEditor(1, 'name')
    fireEvent.change(editor()!, { target: { value: 'Charli' } })
    expect(editBadge()!.textContent).toBe('6 chars')
    fireEvent.change(editor()!, { target: { value: '' } })
    expect(editBadge()!.textContent).toBe('0 chars')
  })

  it('textarea editor counts newline characters too', () => {
    const textareaCols: IrisTableColumn<Row>[] = [
      { key: 'note', title: 'Note', editable: true, editor: 'textarea' },
    ]
    render(<IrisTable columns={textareaCols} data={rows} rowKey="id" charCount />)
    openEditor(1, 'note')
    expect(editBadge()!.textContent).toBe('5 chars') // 'alpha'
    fireEvent.change(editor()!, { target: { value: 'a\nb\nc' } })
    expect(editBadge()!.textContent).toBe('5 chars') // each \n counts as 1 char
  })

  it('row edit mode shows a per-column count on every open editor', () => {
    render(
      <IrisTable columns={cols} data={rows} rowKey="id" charCount editConfig={{ mode: 'row' }} />,
    )
    openEditor(1, 'name')
    const badges = [...document.querySelectorAll('[data-iris-char-count-edit]')]
    expect(badges.length).toBe(2) // name + age (editable columns)
    expect(badges[0]!.textContent).toBe('7 chars')
    expect(badges[1]!.textContent).toBe('2 chars') // 25
  })

  it('fail-closed: no badge without the charCount prop', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    openEditor(1, 'name')
    expect(editor()).not.toBeNull()
    expect(editBadge()).toBeNull()
  })

  it('i18n: zh locale renders the localized count (5 字)', () => {
    render(
      <IrisI18nProvider messages={{ 'table.charCount': '{count} 字' }}>
        <IrisTable columns={cols} data={rows} rowKey="id" charCount />
      </IrisI18nProvider>,
    )
    openEditor(1, 'age') // '25'
    expect(editBadge()!.textContent).toBe('2 字')
    fireEvent.change(editor()!, { target: { value: '12345' } })
    expect(editBadge()!.textContent).toBe('5 字')
  })
})

describe('IrisTable charCount — 选区计数 (range cell-count/sum badge)', () => {
  function tableWithCharCount(): void {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange charCount />)
  }

  it('text-only range shows the cell count with no sum', () => {
    const textCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'city', title: 'City' },
    ]
    render(<IrisTable columns={textCols} data={rows} rowKey="id" cellRange charCount />)
    selectRange(0, 0, 1, 1) // name+city × 2 rows — no numeric column in range
    expect(rangeBadge()!.textContent).toBe('4 cells')
  })

  it('numeric range sums the column values', () => {
    tableWithCharCount()
    selectRange(0, 1, 2, 1) // age column, 3 rows → 25+32+28
    expect(rangeBadge()!.textContent).toBe('3 cells · sum 85')
  })

  it('mixed text+numeric range counts all cells and sums the numeric ones', () => {
    tableWithCharCount()
    selectRange(0, 0, 1, 1) // name+age × 2 rows → count 4, sum 25+32
    expect(rangeBadge()!.textContent).toBe('4 cells · sum 57')
  })

  it('Escape clears the range and removes the badge', () => {
    tableWithCharCount()
    selectRange(0, 0, 1, 1)
    expect(rangeBadge()).not.toBeNull()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(rangeBadge()).toBeNull()
  })

  it('fail-closed: no selection badge without the charCount prop', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange />)
    selectRange(0, 0, 1, 1)
    expect(rangeBadge()).toBeNull()
  })

  it('fill-handle coexistence: the badge shifts up (bottom 10px) in the handle host cell', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" cellRange charCount rangeFill />)
    selectRange(0, 0, 1, 1) // end cell (1,1) is also the fill-handle host
    expect(rangeBadge()).not.toBeNull()
    expect(rangeBadge()!.style.bottom).toBe('10px')
    // The fill handle sits in the range's bottom-right cell — EVERY range end
    // cell is the handle host while rangeFill is on, so the badge stays
    // shifted for the new selection too.
    fireEvent.keyDown(document.body, { key: 'Escape' })
    selectRange(0, 0, 1, 0)
    expect(rangeBadge()!.style.bottom).toBe('10px')
  })

  it('without rangeFill the badge sits at the default 2px corner', () => {
    tableWithCharCount()
    selectRange(0, 0, 1, 1)
    expect(rangeBadge()!.style.bottom).toBe('2px')
  })

  it('aggregateAccuracy rounds the sum (same gate as the summary row)', () => {
    const valRows: Row[] = [
      { id: 1, name: 'A', age: 1, city: 'x', note: '', val: 1.234 },
      { id: 2, name: 'B', age: 1, city: 'y', note: '', val: 2.345 },
    ]
    const valCols: IrisTableColumn<Row>[] = [{ key: 'val', title: 'Val' }]
    render(
      <IrisTable
        columns={valCols}
        data={valRows}
        rowKey="id"
        cellRange
        charCount
        aggregateAccuracy={2}
      />,
    )
    selectRange(0, 0, 1, 0)
    expect(rangeBadge()!.textContent).toBe('2 cells · sum 3.58') // 3.579 → 3.58
  })
})
