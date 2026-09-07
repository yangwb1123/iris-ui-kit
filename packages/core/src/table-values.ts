/**
 * Shared table value projection.
 *
 * Formula evaluation is framework-free in Core. Adapters only provide their
 * typed column shape and, when needed, the current external table snapshot;
 * this module owns formula-over-dataIndex precedence and immutable CSV/range
 * shadow-row materialization.
 */

import { memoizedFormulaValue, type FormulaTables } from './formula'

/** Minimal column contract needed to resolve a table cell value. */
export interface TableValueColumn<Row extends Record<string, unknown>> {
  readonly key: string
  readonly dataIndex?: keyof Row | string
  readonly formula?: string
  readonly editable?: boolean
}

/**
 * Resolve the edit capability shared by every table editing entry point.
 * Formula columns are display-only even when an adapter receives
 * `editable: true`; an empty/absent formula keeps the authored editable flag.
 */
export function isTableColumnEditable<
  Column extends Pick<TableValueColumn<Record<string, unknown>>, 'editable' | 'formula'>,
>(column: Column): boolean {
  return Boolean(column.editable) && !column.formula
}

/**
 * Resolve the raw value consumed by table rendering, sorting, filtering and
 * summaries. A non-empty formula takes precedence over `dataIndex`/`key`.
 */
export function resolveTableColumnValue<
  Row extends Record<string, unknown>,
  Column extends TableValueColumn<Row> = TableValueColumn<Row>,
>(row: Row, column: Column, formulaTables?: FormulaTables): unknown {
  if (column.formula) return memoizedFormulaValue(column.formula, row, formulaTables)
  return row[(column.dataIndex ?? column.key) as keyof Row]
}

/**
 * Materialize formula columns onto immutable shallow shadow rows for serializers
 * whose generic column contract reads `row[dataIndex]` directly. No formula
 * column returns the original array by identity; source rows are never mutated.
 */
export function materializeTableFormulaValues<
  Row extends Record<string, unknown>,
  Column extends TableValueColumn<Row> = TableValueColumn<Row>,
>(rows: readonly Row[], columns: readonly Column[], formulaTables?: FormulaTables): Row[] {
  const formulaColumns = columns.filter((column) => column.formula)
  if (formulaColumns.length === 0) return rows as Row[]
  return rows.map((row) => {
    let shadow: Row | null = null
    for (const column of formulaColumns) {
      const key = (column.dataIndex ?? column.key) as keyof Row
      const next: Row = shadow ?? { ...row }
      ;(next as Record<string, unknown>)[key as string] = resolveTableColumnValue(
        row,
        column,
        formulaTables,
      )
      shadow = next
    }
    return shadow as Row
  })
}
