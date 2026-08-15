import { describe, expect, it } from 'vitest'
import { evaluateFormula, memoizedFormulaValue, type FormulaTables } from './formula'

type Row = Record<string, unknown>

/** Rates table: the cross-table reference target used across tests. */
const rates: Row[] = [{ rate: 1.1, label: 'standard', empty: null, zero: 0 }]
const tax: Row[] = [{ taxRate: 0.2, name: 'VAT' }]

const tables: FormulaTables = { rates, tax }

describe('@iris-ui-kit/core evaluateFormula cross-table refs (batch BC, iris 独有)', () => {
  it('reads the FIRST row of the named table (`other!col`)', () => {
    expect(evaluateFormula('rates!rate', {} as Row, tables)).toBe(1.1)
    expect(evaluateFormula('=rates!rate', {} as Row, tables)).toBe(1.1)
    expect(evaluateFormula('= rates!rate', {} as Row, tables)).toBe(1.1)
    expect(evaluateFormula('tax!name', {} as Row, tables)).toBe('VAT')
    // Only the first row is consulted (documented contract).
    expect(
      evaluateFormula('rates!rate', {} as Row, { rates: [{ rate: 1.1 }, { rate: 9.9 }] }),
    ).toBe(1.1)
  })

  it('composes with local fields and arithmetic', () => {
    const row: Row = { price: 100, qty: 2 }
    expect(evaluateFormula('price * rates!rate', row, tables)).toBeCloseTo(110)
    expect(evaluateFormula('=price + price * tax!taxRate', row, tables)).toBe(120)
    expect(evaluateFormula('(price * rates!rate) + qty', row, tables)).toBeCloseTo(112)
    expect(evaluateFormula('rates!rate + tax!taxRate', {} as Row, tables)).toBeCloseTo(1.3)
  })

  it('works as function arguments and inside groups', () => {
    expect(evaluateFormula('SUM(rates!rate, tax!taxRate, 1)', {} as Row, tables)).toBeCloseTo(2.3)
    expect(evaluateFormula('AVG(rates!rate, tax!taxRate)', {} as Row, tables)).toBeCloseTo(0.65)
    expect(evaluateFormula('MAX(rates!rate, tax!taxRate)', {} as Row, tables)).toBe(1.1)
    expect(evaluateFormula('COUNT(rates!rate, tax!taxRate)', {} as Row, tables)).toBe(2)
    // Fail-closed still applies inside functions: an unknown LOCAL field
    // argument poisons the whole formula just like an unknown cross-table one.
    expect(evaluateFormula('COUNT(rates!rate, missingLocal)', {} as Row, tables)).toBeNull()
  })

  it('string field values flow through; + concatenates when both sides are strings', () => {
    expect(evaluateFormula('tax!name', {} as Row, tables)).toBe('VAT')
    expect(evaluateFormula('rates!label', {} as Row, tables)).toBe('standard')
    expect(evaluateFormula('tax!name + tax!name', {} as Row, tables)).toBe('VATVAT')
    // A non-numeric string in a numeric op → NaN → whole formula null.
    expect(evaluateFormula('SUM(tax!name)', {} as Row, tables)).toBeNull()
  })

  it('MISSING table → whole formula null (fail-closed)', () => {
    expect(evaluateFormula('ghost!rate', {} as Row, tables)).toBeNull()
    expect(evaluateFormula('rates!rate + ghost!rate', {} as Row, tables)).toBeNull()
    expect(evaluateFormula('SUM(ghost!rate, 1)', {} as Row, tables)).toBeNull()
  })

  it('MISSING field → whole formula null (fail-closed)', () => {
    expect(evaluateFormula('rates!nope', {} as Row, tables)).toBeNull()
    expect(evaluateFormula('rates!rate + rates!nope', {} as Row, tables)).toBeNull()
    expect(evaluateFormula('SUM(rates!nope, 1)', {} as Row, tables)).toBeNull()
  })

  it('EMPTY table → whole formula null (fail-closed)', () => {
    expect(evaluateFormula('rates!rate', {} as Row, { rates: [] })).toBeNull()
    expect(evaluateFormula('rates!rate + 1', {} as Row, { rates: [] })).toBeNull()
  })

  it('missing tables ARGUMENT (2-arg call) → null, feature-off safe', () => {
    expect(evaluateFormula('rates!rate', {} as Row)).toBeNull()
    expect(evaluateFormula('=SUM(rates!rate, 1)', {} as Row)).toBeNull()
    // Passing an empty object behaves exactly like no tables at all.
    expect(evaluateFormula('rates!rate', {} as Row, {})).toBeNull()
    // Row-local formulas are untouched by the tables argument.
    expect(evaluateFormula('price * 2', { price: 5 })).toBe(10)
    expect(evaluateFormula('price * 2', { price: 5 }, tables)).toBe(10)
  })

  it('KNOWN nullish field value coerces (Excel empty-cell-as-zero parity)', () => {
    expect(evaluateFormula('rates!empty + 5', {} as Row, tables)).toBe(5)
    expect(evaluateFormula('rates!zero * 5', {} as Row, tables)).toBe(0)
    expect(evaluateFormula('SUM(rates!empty, tax!taxRate)', {} as Row, tables)).toBeCloseTo(0.2)
  })

  it('illegal bang positions → null (never throws)', () => {
    expect(evaluateFormula('rates!', {} as Row, tables)).toBeNull()
    expect(evaluateFormula('!rates', {} as Row, tables)).toBeNull()
    expect(evaluateFormula('rates!!rate', {} as Row, tables)).toBeNull()
    expect(evaluateFormula('rates!1', {} as Row, tables)).toBeNull()
    expect(evaluateFormula('rates! ', {} as Row, tables)).toBeNull()
    expect(evaluateFormula('rates!+1', {} as Row, tables)).toBeNull()
    expect(evaluateFormula('1 + !', {} as Row, tables)).toBeNull()
    expect(evaluateFormula('SUM(rates!rate,)', {} as Row, tables)).toBeNull()
  })

  it('whitespace around the bang is tolerated (tokenizer skips spaces)', () => {
    expect(evaluateFormula('rates ! rate', {} as Row, tables)).toBe(1.1)
  })

  it('prototype names never resolve as table/field (own-property only)', () => {
    expect(evaluateFormula('toString!length', {} as Row, tables)).toBeNull()
    expect(evaluateFormula('rates!toString', {} as Row, tables)).toBeNull()
    expect(evaluateFormula('constructor!name', {} as Row, tables)).toBeNull()
  })

  it('malformed table payloads are safe (null rows, primitives)', () => {
    expect(evaluateFormula('rates!rate', {} as Row, { rates: [null as unknown as Row] })).toBeNull()
    expect(evaluateFormula('rates!rate', {} as Row, { rates: [42 as unknown as Row] })).toBeNull()
    expect(evaluateFormula('rates!rate', {} as Row, { rates: [{} as Row] })).toBeNull()
    // A sparse first slot is treated like an empty table.
    expect(evaluateFormula('rates!rate', {} as Row, { rates: [] as unknown as Row[] })).toBeNull()
  })

  it('unknown table name with a REAL local field of the same name still poisons (no fallback)', () => {
    // The row has a `rates` field but `tables` does NOT contain that table —
    // the table lookup fails and the whole formula is null; no silent fallback.
    expect(evaluateFormula('rates!rate + 1', { rates: 5 }, { tax })).toBeNull()
  })
})

describe('@iris-ui-kit/core memoizedFormulaValue cross-table (batch BC)', () => {
  it('caches per (row, TABLES OBJECT, formula)', () => {
    const row: Row = { price: 10 }
    const first = memoizedFormulaValue('price * rates!rate', row, tables)
    expect(first).toBeCloseTo(11)
    expect(memoizedFormulaValue('price * rates!rate', row, tables)).toBe(first)
    expect(memoizedFormulaValue('price * rates!rate', row, tables)).toBeCloseTo(11)
  })

  it('a NEW tables object recomputes (immutable contract)', () => {
    const row: Row = { price: 10 }
    expect(memoizedFormulaValue('price * rates!rate', row, tables)).toBeCloseTo(11)
    const updated: FormulaTables = { rates: [{ rate: 2 }] }
    expect(memoizedFormulaValue('price * rates!rate', row, updated)).toBe(20)
    // The old object's cache is still intact (WeakMap slots are independent).
    expect(memoizedFormulaValue('price * rates!rate', row, tables)).toBeCloseTo(11)
  })

  it('2-arg and 3-arg calls use distinct slots (feature-off stays null)', () => {
    const row: Row = { price: 10 }
    expect(memoizedFormulaValue('rates!rate', row)).toBeNull()
    expect(memoizedFormulaValue('rates!rate', row, tables)).toBe(1.1)
    // And the 2-arg result stays cached as null.
    expect(memoizedFormulaValue('rates!rate', row)).toBeNull()
  })

  it('row-local formulas are unaffected by the tables argument', () => {
    const row: Row = { a: 2, b: 3 }
    expect(memoizedFormulaValue('a * b', row, tables)).toBe(6)
    expect(memoizedFormulaValue('a * b', row, tables)).toBe(6)
    expect(evaluateFormula('a * b', row, tables)).toBe(6)
  })

  it('a NEW row reference recomputes with the same tables object', () => {
    expect(memoizedFormulaValue('price * rates!rate', { price: 1 } as Row, tables)).toBeCloseTo(1.1)
    expect(memoizedFormulaValue('price * rates!rate', { price: 2 } as Row, tables)).toBeCloseTo(2.2)
  })
})
