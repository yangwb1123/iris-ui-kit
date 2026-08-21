import * as React from 'react'
import { memoizedFormulaValue, type FormulaTables, type ParsedTableQuery } from '@iris-ui-kit/core'
import type { IrisTableColumn } from './types'

/** Shared table layout constants and render-time formula/value helpers. */
export const SEQ_COL_WIDTH = 60
export const DRAG_COL_WIDTH = 40
export const COPY_FLASH_MS = 600
export const ROW_TARGET_MS = 2000

export const DISTRIBUTION_MENU_KEY = '__iris_distribution'
export const SUMMARY_MENU_KEY = '__iris-summary'
export const ANNOTATE_MENU_KEY = '__iris-annotate'
export const ANNOTATE_EDIT_MENU_KEY = '__iris-annotate-edit'
export const ANNOTATE_REMOVE_MENU_KEY = '__iris-annotate-remove'
export const COPY_VALUE_MENU_KEY = '__iris-copy-value'
export const CLEAR_CELL_MENU_KEY = '__iris-clear-cell'
export const FORMAT_NUMBER_MENU_KEY = '__iris-format-number'
export const FORMAT_UPPER_MENU_KEY = '__iris-format-upper'
export const PIN_LEFT_MENU_KEY = '__iris-pin-left'
export const UNPIN_MENU_KEY = '__iris-unpin'

export const EMPTY_QUERY_PARSE: ParsedTableQuery = {
  filters: {},
  inValues: {},
  rules: [],
  sort: null,
  error: null,
}

export const FNR_BUTTON_STYLE: React.CSSProperties = {
  border: '1px solid var(--iris-border)',
  borderRadius: 'var(--iris-radius-md, 6px)',
  background: 'var(--iris-surface)',
  color: 'var(--iris-foreground)',
  cursor: 'pointer',
  padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
  fontSize: 'var(--iris-font-size-sm, 13px)',
  fontFamily: 'inherit',
}

// Formula evaluation is render-scoped to preserve the existing cross-table
// reference semantics while keeping the hot-path value lookup in one module.
let currentFormulaTables: FormulaTables | undefined

export function setCurrentFormulaTables(formulaTables: FormulaTables | undefined): void {
  currentFormulaTables = formulaTables
}

export function getFormulaValue<Row extends Record<string, unknown>>(
  formula: string,
  row: Row,
): unknown {
  return memoizedFormulaValue(formula, row, currentFormulaTables)
}

export function getCellValue<Row extends Record<string, unknown>>(
  row: Row,
  column: IrisTableColumn<Row>,
): unknown {
  if (column.formula) return getFormulaValue(column.formula, row)
  const key = (column.dataIndex ?? column.key) as keyof Row
  return row[key]
}

export function coerceEditDraft<Row extends Record<string, unknown>>(
  row: Row,
  col: IrisTableColumn<Row>,
  draft: unknown,
): unknown {
  if (col.editor === 'select') {
    if (!col.editOptions) return String(draft)
    if (typeof draft !== 'string') return draft
    const opt = col.editOptions.find((o) => String(o.value) === draft)
    return opt ? opt.value : draft
  }
  const value = String(draft)
  if (col.editor !== 'number') return value
  return value === '' || Number.isNaN(Number(value)) ? getCellValue(row, col) : Number(value)
}
