import { describe, expect, it } from 'vitest'
import {
  columnLetter,
  evaluateFormula,
  FORMULA_MAX_DEPTH,
  FORMULA_MAX_LENGTH,
  memoizedFormulaValue,
} from './formula'

type Row = Record<string, unknown>

const row: Row = {
  price: 10,
  qty: 3,
  name: 'Alice',
  empty: null,
  zero: 0,
  score: 5,
}

describe('@iris-ui-kit/core evaluateFormula (batch AO, iris 独有)', () => {
  it('basic arithmetic with field refs, optional leading =', () => {
    expect(evaluateFormula('price * qty', row)).toBe(30)
    expect(evaluateFormula('=price * qty', row)).toBe(30)
    expect(evaluateFormula('= price * qty', row)).toBe(30)
    expect(evaluateFormula('price + qty', row)).toBe(13)
    expect(evaluateFormula('price - qty', row)).toBe(7)
    expect(evaluateFormula('price / qty', row)).toBeCloseTo(10 / 3)
    expect(evaluateFormula('price % qty', row)).toBe(1)
  })

  it('operator precedence and parentheses', () => {
    expect(evaluateFormula('1 + 2 * 3', row)).toBe(7)
    expect(evaluateFormula('(1 + 2) * 3', row)).toBe(9)
    expect(evaluateFormula('2 * 3 + 4 * 5', row)).toBe(26)
    expect(evaluateFormula('((1 + 2) * (3 + 4)) / 3', row)).toBeCloseTo(7)
    expect(evaluateFormula('10 - 2 - 3', row)).toBe(5) // left-associative
    expect(evaluateFormula('100 / 5 / 2', row)).toBe(10)
  })

  it('decimal numbers', () => {
    expect(evaluateFormula('1.5 + 2.25', row)).toBe(3.75)
    expect(evaluateFormula('0.1 * 0.2', row)).toBeCloseTo(0.02)
    expect(evaluateFormula('1.5 * qty', row)).toBe(4.5)
  })

  it('unknown field → null (fail-closed, whole formula)', () => {
    expect(evaluateFormula('missing', row)).toBeNull()
    expect(evaluateFormula('missing + 1', row)).toBeNull()
    expect(evaluateFormula('price + missing', row)).toBeNull()
    expect(evaluateFormula('SUM(missing, 1)', row)).toBeNull()
    expect(evaluateFormula('SUM(1, missing)', row)).toBeNull()
  })

  it('known-but-null field coerces to 0 (Excel empty-cell-as-zero)', () => {
    expect(evaluateFormula('empty + 5', row)).toBe(5)
    expect(evaluateFormula('empty * 5', row)).toBe(0)
    expect(evaluateFormula('price + empty', row)).toBe(10)
    expect(evaluateFormula('SUM(empty, price)', row)).toBe(10)
  })

  it('+ with either side a string concatenates; nullish → empty string', () => {
    // No string-literal tokens exist — string operands come from field values.
    expect(evaluateFormula('name + 1', row)).toBe('Alice1')
    expect(evaluateFormula('name + zero', row)).toBe('Alice0')
    expect(evaluateFormula('1 + name', row)).toBe('1Alice')
    expect(evaluateFormula('name + empty', row)).toBe('Alice')
    expect(evaluateFormula('empty + name', row)).toBe('Alice')
    expect(evaluateFormula('price + name', row)).toBe('10Alice')
  })

  it('- * / % are numeric only (string operand → null)', () => {
    expect(evaluateFormula('name - 1', row)).toBeNull()
    expect(evaluateFormula('1 - name', row)).toBeNull()
    expect(evaluateFormula('name * 2', row)).toBeNull()
    expect(evaluateFormula('name / 2', row)).toBeNull()
  })

  it('division / modulo by zero → null; non-finite arithmetic → null', () => {
    expect(evaluateFormula('1 / 0', row)).toBeNull()
    expect(evaluateFormula('price / (qty - qty)', row)).toBeNull()
    expect(evaluateFormula('1 % 0', row)).toBeNull()
    expect(evaluateFormula('price % (qty - qty)', row)).toBeNull()
    expect(evaluateFormula('0 / 0', row)).toBeNull()
  })

  it('SUM / AVG / MIN / MAX / COUNT over comma-separated args', () => {
    expect(evaluateFormula('SUM(1, 2, 3)', row)).toBe(6)
    expect(evaluateFormula('SUM(price, qty)', row)).toBe(13)
    expect(evaluateFormula('SUM(price * qty, 5)', row)).toBe(35)
    expect(evaluateFormula('AVG(2, 4, 6)', row)).toBe(4)
    expect(evaluateFormula('AVG(price, qty)', row)).toBeCloseTo(6.5)
    expect(evaluateFormula('MIN(3, 1, 2)', row)).toBe(1)
    expect(evaluateFormula('MAX(3, 1, 2)', row)).toBe(3)
    expect(evaluateFormula('MAX(price, qty, 100)', row)).toBe(100)
    expect(evaluateFormula('COUNT(1, 2, 3)', row)).toBe(3)
    expect(evaluateFormula('COUNT(1, empty, 3)', row)).toBe(2) // nullish arg skipped
    expect(evaluateFormula('COUNT(price, qty)', row)).toBe(2)
  })

  it('empty function arg lists → null (or 0 for the empty-sum/empty-count cases)', () => {
    expect(evaluateFormula('SUM()', row)).toBe(0) // empty sum = 0 (Excel parity)
    expect(evaluateFormula('AVG()', row)).toBeNull()
    expect(evaluateFormula('MIN()', row)).toBeNull()
    expect(evaluateFormula('MAX()', row)).toBeNull()
    expect(evaluateFormula('COUNT()', row)).toBe(0)
  })

  it('function names are case-insensitive (Excel parity)', () => {
    expect(evaluateFormula('sum(1, 2)', row)).toBe(3)
    expect(evaluateFormula('Sum(1, 2)', row)).toBe(3)
    expect(evaluateFormula('Avg(2, 4)', row)).toBe(3)
  })

  it('non-whitelisted function → null (no eval escape hatch)', () => {
    expect(evaluateFormula('POW(2, 3)', row)).toBeNull()
    expect(evaluateFormula('IF(1, 2, 3)', row)).toBeNull()
    expect(evaluateFormula('CONCAT(a, b)', row)).toBeNull()
  })

  it('no unary minus: a bare - number is a parse error → null', () => {
    expect(evaluateFormula('-5', row)).toBeNull()
    expect(evaluateFormula('5 + -3', row)).toBeNull()
    expect(evaluateFormula('5 - -3', row)).toBeNull()
    expect(evaluateFormula('--5', row)).toBeNull()
  })

  it('syntax errors → null, never throws', () => {
    expect(evaluateFormula('', row)).toBeNull()
    expect(evaluateFormula('=', row)).toBeNull()
    expect(evaluateFormula('   ', row)).toBeNull()
    expect(evaluateFormula('1 +', row)).toBeNull()
    expect(evaluateFormula('+ 1', row)).toBeNull()
    expect(evaluateFormula('(1 + 2', row)).toBeNull()
    expect(evaluateFormula('1 + 2)', row)).toBeNull()
    expect(evaluateFormula('1 2', row)).toBeNull()
    expect(evaluateFormula('1 $ 2', row)).toBeNull() // bad char
    expect(evaluateFormula('a b', row)).toBeNull()
    expect(evaluateFormula('1,2', row)).toBeNull() // bare comma
    expect(evaluateFormula('SUM(1,, 2)', row)).toBeNull()
    expect(evaluateFormula('SUM(1, 2', row)).toBeNull()
  })

  it('bounds: 512-char input and 32 nesting depth', () => {
    const long = '1 + ' + '1 + '.repeat(FORMULA_MAX_LENGTH)
    expect(evaluateFormula(long, row)).toBeNull()
    const ok = '1 + 1'
    expect(evaluateFormula(ok, row)).toBe(2)
    // 33 nested parens exceeds the depth bound.
    const deep = '('.repeat(FORMULA_MAX_DEPTH + 1) + '1' + ')'.repeat(FORMULA_MAX_DEPTH + 1)
    expect(evaluateFormula(deep, row)).toBeNull()
    const deepOk = '('.repeat(FORMULA_MAX_DEPTH) + '1' + ')'.repeat(FORMULA_MAX_DEPTH)
    expect(evaluateFormula(deepOk, row)).toBe(1)
    // Function-call nesting counts toward the same bound.
    const fnDeep = 'SUM('.repeat(FORMULA_MAX_DEPTH) + '1' + ')'.repeat(FORMULA_MAX_DEPTH)
    expect(evaluateFormula(fnDeep, row)).toBe(1)
    const fnTooDeep = 'SUM('.repeat(FORMULA_MAX_DEPTH + 1) + '1' + ')'.repeat(FORMULA_MAX_DEPTH + 1)
    expect(evaluateFormula(fnTooDeep, row)).toBeNull()
  })

  it('non-string / non-object input is safe', () => {
    expect(evaluateFormula(null as unknown as string, {} as Row)).toBeNull()
    expect(evaluateFormula(42 as unknown as string, {} as Row)).toBeNull()
    expect(evaluateFormula('price', {})).toBeNull()
  })

  it('pure: row values of any type flow through (numbers, strings, nullish)', () => {
    expect(evaluateFormula('score * 2', row)).toBe(10)
    expect(evaluateFormula('score + score', row)).toBe(10)
    expect(evaluateFormula('zero + 0', row)).toBe(0)
    expect(evaluateFormula('empty + empty', row)).toBe(0)
    expect(evaluateFormula('empty * empty', row)).toBe(0)
  })
})

describe('@iris-ui-kit/core memoizedFormulaValue (batch AO)', () => {
  it('caches per (row, formula); same value as evaluateFormula', () => {
    const r1: Row = { a: 2, b: 3 }
    const first = memoizedFormulaValue('a * b', r1)
    expect(first).toBe(6)
    expect(memoizedFormulaValue('a * b', r1)).toBe(first)
    expect(evaluateFormula('a * b', r1)).toBe(6)
  })

  it('a NEW row reference recomputes (immutable-row contract)', () => {
    const r1: Row = { a: 2 }
    expect(memoizedFormulaValue('a * 10', r1)).toBe(20)
    const r2: Row = { a: 5 }
    expect(memoizedFormulaValue('a * 10', r2)).toBe(50)
  })

  it('null results are cached too (Map.has semantics)', () => {
    const r1: Row = { a: 1 }
    expect(memoizedFormulaValue('ghost + 1', r1)).toBeNull()
    expect(memoizedFormulaValue('ghost + 1', r1)).toBeNull()
  })

  it('different formulas on the same row are independent', () => {
    const r1: Row = { a: 2, b: 3 }
    expect(memoizedFormulaValue('a + b', r1)).toBe(5)
    expect(memoizedFormulaValue('a * b', r1)).toBe(6)
  })
})

describe('@iris-ui-kit/core columnLetter (batch AO)', () => {
  it('single letters A..Z', () => {
    expect(columnLetter(0)).toBe('A')
    expect(columnLetter(1)).toBe('B')
    expect(columnLetter(2)).toBe('C')
    expect(columnLetter(24)).toBe('Y')
    expect(columnLetter(25)).toBe('Z')
  })

  it('bijective rollover: AA, AB, AZ, BA, ZZ, AAA', () => {
    expect(columnLetter(26)).toBe('AA')
    expect(columnLetter(27)).toBe('AB')
    expect(columnLetter(51)).toBe('AZ')
    expect(columnLetter(52)).toBe('BA')
    expect(columnLetter(701)).toBe('ZZ')
    expect(columnLetter(702)).toBe('AAA')
  })

  it('invalid index → empty string', () => {
    expect(columnLetter(-1)).toBe('')
    expect(columnLetter(1.5)).toBe('')
    expect(columnLetter(NaN)).toBe('')
  })
})
