import {
  nextGridCell,
  writeClipboardText,
  type CellRangeController,
  type CellRangeState,
  type GridNavKey,
} from '@iris-ui-kit/core'
import type { TableCopyFormat } from '@iris-ui-kit/core'
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
  serializeRange: (format?: TableCopyFormat, copyWithFormat?: boolean) => string | null
  pasteRange: (range: Range) => void
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
    const state = options.range.getState()
    const current = state.anchor
      ? (state.active ?? { row: Number(row), col: Number(col) })
      : { row: Number(row), col: Number(col) }
    const next = nextGridCell(current, event.key as GridNavKey, {
      rowCount: options.rows().length,
      colCount: options.columns().length,
    })
    options.range.extendRange(next.row, next.col)
  }
  const isInRange = (row: number, col: number): boolean => {
    // Touch the reactive snapshot so Core remains the source of containment
    // semantics without making Vue render depend on a stale closure.
    void options.rangeState.value
    return options.range.isInRange(row, col)
  }
  const activeCellRange = (): Range | null => {
    void options.rangeState.value
    return options.range.getRange()
  }
  const copyActiveRange = (): void => {
    const range = activeCellRange()
    const clip = options.clipConfig()
    if (!range || clip?.copy === false) return
    const text = options.serializeRange(clip?.copyFormat, clip?.copyWithFormat === true)
    if (text !== null) void writeClipboardText(text)
  }
  const handleClipboardKey = (event: KeyboardEvent): void => {
    const clip = options.clipConfig()
    if (!options.cellRange() || !clip || event.defaultPrevented) return
    if (!event.ctrlKey && !event.metaKey) return
    const key = event.key.toLowerCase()
    const range = activeCellRange()
    if (!range) return
    if (key === 'c') {
      if (clip.copy === false) return
      event.preventDefault()
      copyActiveRange()
    } else if (key === 'v') {
      if (clip.paste === false) return
      event.preventDefault()
      options.pasteRange(range)
    }
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
