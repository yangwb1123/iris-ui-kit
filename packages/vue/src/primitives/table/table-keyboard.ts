import {
  nextGridCell,
  serializeTableRange,
  writeClipboardText,
  type CellRangeController,
  type CellRangeState,
  type GridNavKey,
} from '@iris-ui-kit/core'
import type { IrisTableClipConfig, IrisTableColumn } from './types'

type Cell = { row: number; col: number }
type Range = { start: Cell; end: Cell }

export function createTableKeyboard(options: {
  keyboardNavigation: () => boolean
  cellRange: () => boolean
  clipConfig: () => IrisTableClipConfig | undefined
  rows: () => Array<Record<string, unknown>>
  columns: () => IrisTableColumn[]
  root: () => HTMLElement | null
  focused: { value: Cell | null }
  range: CellRangeController
  rangeState: { value: CellRangeState }
}): {
  handleRootKeyDown: (event: KeyboardEvent) => void
  isInRange: (row: number, col: number) => boolean
  activeCellRange: () => Range | null
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
    const next = nextGridCell(
      options.focused.value ?? { row: 0, col: 0 },
      event.key as GridNavKey,
      { rowCount: options.rows().length, colCount: options.columns().length, pageSize: 10 },
    )
    options.focused.value = next
    options
      .root()
      ?.querySelector<HTMLElement>(`[data-grid-row="${next.row}"][data-grid-col="${next.col}"]`)
      ?.focus()
  }
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
  const isInRange = (row: number, col: number): boolean => {
    const { anchor, active } = options.rangeState.value
    return Boolean(
      anchor &&
      active &&
      row >= Math.min(anchor.row, active.row) &&
      row <= Math.max(anchor.row, active.row) &&
      col >= Math.min(anchor.col, active.col) &&
      col <= Math.max(anchor.col, active.col),
    )
  }
  const activeCellRange = (): Range | null => {
    const { anchor, active } = options.rangeState.value
    if (!anchor || !active) return null
    return {
      start: { row: Math.min(anchor.row, active.row), col: Math.min(anchor.col, active.col) },
      end: { row: Math.max(anchor.row, active.row), col: Math.max(anchor.col, active.col) },
    }
  }
  const copyActiveRange = (): void => {
    const range = activeCellRange()
    const clip = options.clipConfig()
    if (!range || clip?.copy === false) return
    void writeClipboardText(
      serializeTableRange(
        options.rows(),
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
  return {
    handleRootKeyDown: (event) => {
      handleGridKey(event)
      handleCellRangeKey(event)
      handleClipboardKey(event)
    },
    isInRange,
    activeCellRange,
    copyActiveRange,
  }
}
