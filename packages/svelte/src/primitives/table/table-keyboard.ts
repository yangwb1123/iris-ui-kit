import {
  nextGridCell,
  serializeTableRange,
  writeClipboardText,
  type CellRange,
  type CellRangeController,
  type GridNavKey,
} from '@iris-ui-kit/core'
import type { IrisTableClipConfig, IrisTableColumn } from './types'
import { withComputedFormulaCells } from './tableUtils'

type CellAddress = { row: number; col: number }
type TableRange = CellRange

export function createTableKeyboard(options: {
  keyboardNavigation: () => boolean
  cellRange: () => boolean
  clipConfig: () => IrisTableClipConfig | undefined
  rows: () => Array<Record<string, unknown>>
  columns: () => IrisTableColumn[]
  root: () => HTMLElement | null
  getFocused: () => CellAddress | null
  setFocused: (cell: CellAddress) => void
  range: CellRangeController
  getRange: () => CellRange | null
}): {
  handleRootKeyDown: (event: KeyboardEvent) => void
  handleGridKey: (event: KeyboardEvent) => void
  handleCellRangeKey: (event: KeyboardEvent) => void
  handleClipboardKey: (event: KeyboardEvent) => void
  cellTabIndex: (row: number, col: number) => number
  isInRange: (row: number, col: number) => boolean
  activeCellRange: () => TableRange | null
  copyActiveRange: () => void
} {
  const gridKeys = new Set([
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
    'PageUp',
    'PageDown',
  ])
  const handleGridKey = (event: KeyboardEvent): void => {
    if (!options.keyboardNavigation() || !gridKeys.has(event.key)) return
    const target = event.target as HTMLElement
    if (target.dataset.gridRow === undefined) return
    event.preventDefault()
    const next = nextGridCell(options.getFocused() ?? { row: 0, col: 0 }, event.key as GridNavKey, {
      rowCount: options.rows().length,
      colCount: options.columns().length,
      pageSize: 10,
    })
    options.setFocused(next)
    options
      .root()
      ?.querySelector<HTMLElement>(`[data-grid-row="${next.row}"][data-grid-col="${next.col}"]`)
      ?.focus()
  }
  const cellTabIndex = (row: number, col: number): number => {
    const focused = options.getFocused()
    return focused
      ? focused.row === row && focused.col === col
        ? 0
        : -1
      : row === 0 && col === 0
        ? 0
        : -1
  }
  const isInRange = (row: number, col: number): boolean =>
    options.range.isInRange(row, col) && options.getRange() !== null
  const handleCellRangeKey = (event: KeyboardEvent): void => {
    if (!options.cellRange()) return
    if (event.key === 'Escape') {
      options.range.clearRange()
      return
    }
    const arrows = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
    if (!event.shiftKey || !arrows.has(event.key)) return
    const target = event.target as HTMLElement
    const row = target.dataset.irisCellRow
    const col = target.dataset.irisCellCol
    if (row === undefined || col === undefined) return
    event.preventDefault()
    const current = options.range.getState().active ?? { row: Number(row), col: Number(col) }
    const nextRow =
      event.key === 'ArrowUp'
        ? Math.max(0, current.row - 1)
        : event.key === 'ArrowDown'
          ? Math.min(options.rows().length - 1, current.row + 1)
          : current.row
    const nextCol =
      event.key === 'ArrowLeft'
        ? Math.max(0, current.col - 1)
        : event.key === 'ArrowRight'
          ? Math.min(options.columns().length - 1, current.col + 1)
          : current.col
    options.range.extendRange(nextRow, nextCol)
  }
  const activeCellRange = (): TableRange | null => options.getRange()
  const copyActiveRange = (): void => {
    const range = activeCellRange()
    const clip = options.clipConfig()
    if (!range || clip?.copy === false) return
    // Batch EM: formula columns are display-only — the range copy carries the
    // COMPUTED value, materialized onto shadow rows (the core serializer reads
    // `row[dataIndex]` directly; originals stay untouched).
    const rows = withComputedFormulaCells(options.rows(), options.columns())
    void writeClipboardText(
      serializeTableRange(
        rows,
        options.columns(),
        range,
        clip?.copyFormat,
        clip?.copyWithFormat === true,
      ),
    )
  }
  const handleClipboardKey = (event: KeyboardEvent): void => {
    const clip = options.clipConfig()
    if (!options.cellRange() || !clip || event.defaultPrevented) return
    if (event.key.toLowerCase() !== 'c' || (!event.ctrlKey && !event.metaKey)) return
    if (clip.copy === false || !activeCellRange()) return
    event.preventDefault()
    copyActiveRange()
  }
  const handleRootKeyDown = (event: KeyboardEvent): void => {
    handleGridKey(event)
    handleCellRangeKey(event)
    handleClipboardKey(event)
  }
  return {
    handleRootKeyDown,
    handleGridKey,
    handleCellRangeKey,
    handleClipboardKey,
    cellTabIndex,
    isInRange,
    activeCellRange,
    copyActiveRange,
  }
}
