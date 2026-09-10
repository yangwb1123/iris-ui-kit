import { describe, expect, it } from 'vitest'
import {
  isTableColumnEditable,
  materializeTableFormulaValues,
  resolveTableColumnValue,
} from './table-values'

type Row = { id: number; amount: number; total?: unknown; label?: unknown }
type Column = { key: string; dataIndex?: keyof Row | string; formula?: string }

const row: Row = { id: 1, amount: 4, total: 'source' }

describe('table value projection', () => {
  it('uses formula values before dataIndex and reads cross-table references', () => {
    expect(
      resolveTableColumnValue(row, { key: 'total', dataIndex: 'amount', formula: 'amount * 2' }),
    ).toBe(8)
    expect(
      resolveTableColumnValue(
        row,
        { key: 'total', formula: 'amount * rates!rate' },
        { rates: [{ rate: 3 }] },
      ),
    ).toBe(12)
  })

  it('falls back to the declared dataIndex/key and fails closed for bad formulas', () => {
    expect(resolveTableColumnValue(row, { key: 'amount' })).toBe(4)
    expect(resolveTableColumnValue(row, { key: 'value', dataIndex: 'amount' })).toBe(4)
    expect(resolveTableColumnValue(row, { key: 'total', formula: 'missing + 1' })).toBeNull()
  })

  it('preserves identity when no formula column is present', () => {
    const rows = [row]
    const columns: Column[] = [{ key: 'amount' }]
    expect(materializeTableFormulaValues(rows, columns)).toBe(rows)
  })

  it('materializes multiple formula columns without mutating source rows', () => {
    const rows = [row]
    const columns: Column[] = [
      { key: 'total', formula: 'amount * 2' },
      { key: 'label', formula: 'amount + 1' },
    ]
    const result = materializeTableFormulaValues(rows, columns)
    expect(result).not.toBe(rows)
    expect(result[0]).not.toBe(row)
    expect(result[0]).toMatchObject({ id: 1, amount: 4, total: 8, label: 5 })
    expect(row).toEqual({ id: 1, amount: 4, total: 'source' })
  })

  it('writes formula output at dataIndex when one is provided', () => {
    const result = materializeTableFormulaValues(
      [row],
      [{ key: 'computed', dataIndex: 'total', formula: 'amount * 3' }],
    )
    expect(result[0]?.total).toBe(12)
    expect(result[0]?.computed).toBeUndefined()
  })

  it('keeps formula columns display-only even when authored editable', () => {
    expect(isTableColumnEditable({ key: 'total', editable: true, formula: 'amount * 2' })).toBe(
      false,
    )
    expect(isTableColumnEditable({ key: 'amount', editable: true })).toBe(true)
    expect(isTableColumnEditable({ key: 'amount', editable: false, formula: 'amount * 2' })).toBe(
      false,
    )
    expect(isTableColumnEditable({ key: 'amount', editable: true, formula: '' })).toBe(true)
  })
})
