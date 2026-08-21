import * as React from 'react'
import { memoizedFormulaValue, toCsv, type FormulaTables } from '@iris-ui-kit/core'
import type { IrisTableColumn } from './types'
import { LOCKED_CELL_STRIPE, READONLY_CELL_DOTS } from './table-css'

/** Batch AO: a formula column is DISPLAY-ONLY even when `editable` — every
 * editing entry point (inline, row mode, batch panel, data-editable attr,
 * cursor) reads this same condition. */
export function isEditableColumn<Row extends Record<string, unknown>>(
  col: IrisTableColumn<Row>,
): boolean {
  return !!col.editable && !col.formula
}

/** Batch BE: a cell is locked when the column says so — `true` locks the
 * whole column, a predicate locks per-row (a predicate ignoring its column
 * argument is a row-level lock). Module-level so EVERY editing entry point
 * (inline, row mode, batch panel, paste/fill/clear/FNR/Delete funnels) and
 * the cell render (attr + cursor) read the same condition — one truth. */
export function isCellLocked<Row extends Record<string, unknown>>(
  row: Row,
  col: IrisTableColumn<Row>,
): boolean {
  return typeof col.locked === 'function' ? col.locked(row, col) : col.locked === true
}

/** Batch BJ: a cell is permission-readonly when the column predicate says so —
 * `'readonly'` locks editing, absent/`'editable'` → editable (default).
 * DYNAMIC: unlike `locked` (a static declaration), the predicate re-evaluates
 * on every render, so permission follows the current row/column state without
 * a re-mount. Same single-throat contract as isCellLocked — every editing
 * entry point reads this condition. */
export function isCellReadonly<Row extends Record<string, unknown>>(
  row: Row,
  col: IrisTableColumn<Row>,
): boolean {
  return col.cellPermission?.(row, col) === 'readonly'
}

/** Batch BR (iris 独有): does the column participate in the validation-
 *  summary ledger? Only declarative `editRules` columns count (legacy
 *  `validate` columns, paste/fill/FNR/batch bypasses and Escape cancels
 *  never reach it). Single truth shared by the cell and row commit wrappers. */
export function hasEditRules<Row extends Record<string, unknown>>(
  col: IrisTableColumn<Row>,
): boolean {
  return !!col.editRules && col.editRules.length > 0
}

/** Batch BE+BJ: locked/readonly cell render material — the data attrs + the
 * dropped cursor, extracted so renderRow stays under the complexity budget.
 * Locked wins visually when both (stripes + not-allowed, no readonly attr);
 * readonly falls back to the dotted texture + not-allowed (only when the
 * column is editable — a non-editable readonly cell keeps the default).
 * Range cells keep the default cursor. */
export function cellPermissionRender(
  locked: boolean,
  readonly: boolean,
  editable: boolean,
  hasRange: boolean,
): {
  lockedAttr: 'true' | undefined
  readonlyAttr: 'true' | undefined
  cursor: string | undefined
  style: React.CSSProperties
} {
  if (locked) {
    return {
      lockedAttr: 'true',
      readonlyAttr: undefined,
      cursor: 'not-allowed',
      // Spread LAST in the cell style so the stripes survive every
      // background shorthand (range-fill/conditional/user cellStyle) —
      // background-color highlights still show through the transparent gaps.
      style: { backgroundImage: LOCKED_CELL_STRIPE },
    }
  }
  if (readonly) {
    return {
      lockedAttr: undefined,
      readonlyAttr: 'true',
      cursor: editable ? 'not-allowed' : hasRange ? 'default' : undefined,
      style: { backgroundImage: READONLY_CELL_DOTS },
    }
  }
  return {
    lockedAttr: undefined,
    readonlyAttr: undefined,
    cursor: editable ? 'cell' : hasRange ? 'default' : undefined,
    style: {},
  }
}

/** CSV export shadow rows (batch AO): core `toCsv` reads `row[dataIndex]`
 * directly, so formula columns materialize their computed value onto a
 * shallow copy (original rows untouched — immutable contract). No formula
 * columns → the input array is returned as-is (reference-preserving). */
export function withComputedFormulaCells<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  columns: readonly IrisTableColumn<Row>[],
  formulaTables?: FormulaTables,
): Row[] {
  const formulaCols = columns.filter((c) => c.formula)
  if (formulaCols.length === 0) return rows as Row[]
  return rows.map((row) => {
    let shadow: Row | null = null
    for (const col of formulaCols) {
      const key = (col.dataIndex ?? col.key) as keyof Row
      const next: Row = shadow ?? { ...row }
      ;(next as Record<string, unknown>)[key as string] = memoizedFormulaValue(
        col.formula!,
        row,
        formulaTables,
      )
      shadow = next
    }
    return shadow as Row
  })
}

/** Batch AL: structural equality for undo snapshots — same length + same row
 *  references (the table never mutates rows, so content equality reduces to
 *  reference equality on the row objects). Skips no-op pushes (re-commits of
 *  an identical list, and the rowId fallback path where setCellValue cannot
 *  locate the row) so dead undo steps never accumulate. */
export function sameRowList<Row extends Record<string, unknown>>(a: Row[], b: Row[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/** Batch DI (iris 独有): serialize a BARE referenced row set (no column
 * configs — the caller only hands over `Row[]`) by its OWN enumerable keys:
 * the first row's keys (insertion order) become the header, each value read
 * by that key. Same core `toCsv` neutralization/quoting throughout. Empty
 * row set → '' (the multi-export emits only the segment header). */
export function serializeRefRows(rows: readonly Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const keys = Object.keys(rows[0])
  return toCsv(
    rows as readonly Record<string, unknown>[],
    keys.map((key) => ({ key, title: key })),
  )
}

// ── Clipboard batch O (clipConfig): TSV serialization + safe clipboard ──
// Cell text for the copy TSV: null → '', numbers verbatim (a typed number
// cannot carry a formula payload), everything else gets the same OWASP
// formula neutralization as core `toCsv` (a leading = + - @ tab CR is quoted
// so spreadsheets import it as literal text). Cell text containing \t or \n
// is a documented limitation of the newline/tab-delimited TSV shape.
const TSV_FORMULA_LEAD = /^[=+\-@\t\r]/
export function tsvCell(value: unknown): string {
  if (value == null) return ''
  const text = String(value)
  if (typeof value === 'number' && Number.isFinite(value)) return text
  return TSV_FORMULA_LEAD.test(text) ? `'${text}` : text
}

// Range CSV export (batch AH): RFC-4180 field quoting + the same OWASP
// formula neutralization as `tsvCell` / core `toCsv` (a leading = + - @ tab CR
// is prefixed with a quote so spreadsheets import it as literal text). The
// range export is HEADERLESS by design — a range is a rectangle of cells, not
// a table view (baseline fiat).
const CSV_FORMULA_LEAD = /^[=+\-@\t\r]/
export function csvRangeCell(value: unknown): string {
  if (value == null) return ''
  const text = String(value)
  if (typeof value === 'number' && Number.isFinite(value)) return text
  const safe = CSV_FORMULA_LEAD.test(text) ? `'${text}` : text
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
