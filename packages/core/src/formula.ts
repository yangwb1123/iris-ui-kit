/**
 * Formula evaluation for computed table columns (batch AO, iris 独有 — vxe
 * has no computed-column concept; the closest is a manual formatter, which
 * can only shape DISPLAY, not feed sort/filter/summary/export).
 *
 * `evaluateFormula` is a tiny Excel-like cell-formula engine, FRAMEWORK-FREE
 * (pure TypeScript, zero imports): a regex-driven token scan + recursive
 * descent parser — NEVER `eval`/`Function`/`new Function`.
 *
 * Syntax (documented contract):
 * - An optional leading `=` is stripped (both `=SUM(a,b)` and `SUM(a,b)`).
 * - Field references: `[A-Za-z_]\w*` — read from the row object.
 * - Numbers: `\d+(\.\d+)?`. Operators: `+ - * / %` (`%` = modulo; there is
 *   NO unary minus — `-5` is a parse error). Grouping `( )`, arg list `,`.
 * - Functions: whitelist SUM / AVG / MIN / MAX / COUNT, comma-separated
 *   expressions as arguments (names are case-insensitive, Excel parity; a
 *   name that is not a whitelisted function is treated as a FIELD).
 *
 * Value semantics:
 * - A field that is ABSENT from the row poisons the whole formula → `null`
 *   (fail-closed: an unknown field must not silently read as 0 — the cell
 *   renders empty, see the react bridge).
 * - A field that EXISTS but holds `null`/`undefined` coerces to 0 in
 *   arithmetic (Excel empty-cell-as-zero); in `+` concatenation it coerces
 *   to ''.
 * - `+` with either side a STRING concatenates (String coercion, null → ''),
 *   otherwise numeric addition. `- * / %` are numeric only.
 * - Division / modulo by zero → `null`. Any non-finite arithmetic result
 *   (NaN/Infinity, e.g. Number('abc') in a numeric op) → `null`.
 * - COUNT = number of arguments evaluating to a non-null value (nullish
 *   arguments are skipped, Excel-ish). AVG divides the numeric sum by the
 *   argument COUNT (empty arg list → `null`). MIN/MAX skip nothing (nullish
 *   coerces to 0), empty arg list → `null`.
 * - Bounds: input trimmed length ≤ 512 chars; nesting depth ≤ 32.
 *
 * Errors NEVER throw — every failure path returns `null`.
 */

export const FORMULA_MAX_LENGTH = 512
export const FORMULA_MAX_DEPTH = 32

/** Internal error sentinel: distinct from a legit nullish field value. */
const ERROR = Symbol('formula-error')

type FormulaToken =
  | { type: 'num'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '%' }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' }
  | { type: 'eof' }

const TOKEN_RE = /[0-9]+(?:\.[0-9]+)?|[A-Za-z_][A-Za-z0-9_]*|[+\-*/%(),]/g

/** Whitelist of callable aggregate functions (case-insensitive lookup). */
const FUNCTION_NAMES = new Set(['SUM', 'AVG', 'MIN', 'MAX', 'COUNT'])

/** Tokenize a formula body; `null` on any unexpected character. */
function tokenize(src: string): FormulaToken[] | null {
  const tokens: FormulaToken[] = []
  let last = 0
  let m: RegExpExecArray | null
  TOKEN_RE.lastIndex = 0
  while ((m = TOKEN_RE.exec(src)) !== null) {
    if (/\S/.test(src.slice(last, m.index))) return null
    const tok = m[0]
    if (tok[0]! >= '0' && tok[0]! <= '9') tokens.push({ type: 'num', value: Number(tok) })
    else if (
      (tok[0]! >= 'A' && tok[0]! <= 'Z') ||
      (tok[0]! >= 'a' && tok[0]! <= 'z') ||
      tok[0] === '_'
    )
      tokens.push({ type: 'ident', value: tok })
    else if (tok === '(') tokens.push({ type: 'lparen' })
    else if (tok === ')') tokens.push({ type: 'rparen' })
    else if (tok === ',') tokens.push({ type: 'comma' })
    else tokens.push({ type: 'op', value: tok as '+' | '-' | '*' | '/' | '%' })
    last = m.index + tok.length
  }
  if (/\S/.test(src.slice(last))) return null
  tokens.push({ type: 'eof' })
  return tokens
}

/** Numeric coercion: nullish → 0 (empty-cell-as-zero); NaN → error. */
function toNumber(v: unknown): number | typeof ERROR {
  if (v === ERROR) return ERROR
  if (v == null) return 0
  const n = Number(v)
  return Number.isNaN(n) ? ERROR : n
}

/**
 * Recursive-descent parser over the token stream. The row provides field
 * values; any error (unknown field, bad token, depth/length bound, div-by-0,
 * NaN arithmetic) produces the ERROR sentinel which the caller maps to null.
 */
class FormulaParser {
  private pos = 0
  private readonly tokens: FormulaToken[]
  private readonly row: Record<string, unknown>

  constructor(tokens: FormulaToken[], row: Record<string, unknown>) {
    this.tokens = tokens
    this.row = row
  }

  peek(): FormulaToken {
    return this.tokens[this.pos] ?? { type: 'eof' }
  }

  private next(): FormulaToken {
    const t = this.peek()
    this.pos += 1
    return t
  }

  /** Additive level: `a (+|-) b`. */
  parseAddSub(level: number): unknown {
    if (level > FORMULA_MAX_DEPTH) return ERROR
    let left = this.parseMulDiv(level)
    if (left === ERROR) return ERROR
    for (;;) {
      const t = this.peek()
      if (t.type !== 'op' || (t.value !== '+' && t.value !== '-')) return left
      this.next()
      const right = this.parseMulDiv(level)
      if (right === ERROR) return ERROR
      const op = t.value
      // `+` with either side a string concatenates (nullish → ''), else numeric.
      if (typeof left === 'string' || typeof right === 'string') {
        if (op === '-') return ERROR
        left = String(left ?? '') + String(right ?? '')
      } else {
        const na = toNumber(left)
        const nb = toNumber(right)
        if (na === ERROR || nb === ERROR) return ERROR
        left = op === '+' ? na + nb : na - nb
        if (!Number.isFinite(left as number)) return ERROR
      }
    }
  }

  /** Multiplicative level: `a (*|/|%) b`. */
  private parseMulDiv(level: number): unknown {
    let left = this.parsePrimary(level)
    if (left === ERROR) return ERROR
    for (;;) {
      const t = this.peek()
      if (t.type !== 'op' || (t.value !== '*' && t.value !== '/' && t.value !== '%')) return left
      this.next()
      const right = this.parsePrimary(level)
      if (right === ERROR) return ERROR
      const na = toNumber(left)
      const nb = toNumber(right)
      if (na === ERROR || nb === ERROR) return ERROR
      if ((t.value === '/' || t.value === '%') && nb === 0) return ERROR
      const r = t.value === '*' ? na * nb : t.value === '/' ? na / nb : na % nb
      if (!Number.isFinite(r)) return ERROR
      left = r
    }
  }

  /** Primary: number, field ref, function call, or a parenthesized group. */
  private parsePrimary(level: number): unknown {
    const t = this.peek()
    if (t.type === 'num') {
      this.next()
      return t.value
    }
    if (t.type === 'ident') {
      this.next()
      if (this.peek().type === 'lparen') {
        if (!FUNCTION_NAMES.has(t.value.toUpperCase())) return ERROR
        return this.callFunction(t.value.toUpperCase(), level)
      }
      // Field reference — an ABSENT field poisons the whole formula (fail-closed).
      if (!(t.value in this.row)) return ERROR
      return this.row[t.value]
    }
    if (t.type === 'lparen') {
      this.next()
      const v = this.parseAddSub(level + 1)
      if (v === ERROR) return ERROR
      if (this.peek().type !== 'rparen') return ERROR
      this.next()
      return v
    }
    return ERROR
  }

  private callFunction(name: string, level: number): unknown {
    this.next() // consume '('
    const args: unknown[] = []
    if (this.peek().type !== 'rparen') {
      for (;;) {
        const arg = this.parseAddSub(level + 1)
        if (arg === ERROR) return ERROR
        args.push(arg)
        if (this.peek().type === 'comma') {
          this.next()
          continue
        }
        break
      }
    }
    if (this.peek().type !== 'rparen') return ERROR
    this.next()

    switch (name) {
      case 'SUM': {
        let sum = 0
        for (const a of args) {
          const n = toNumber(a)
          if (n === ERROR) return ERROR
          sum += n
        }
        return sum
      }
      case 'AVG': {
        if (args.length === 0) return ERROR
        let sum = 0
        for (const a of args) {
          const n = toNumber(a)
          if (n === ERROR) return ERROR
          sum += n
        }
        return sum / args.length
      }
      case 'MIN': {
        if (args.length === 0) return ERROR
        let min = Infinity
        for (const a of args) {
          const n = toNumber(a)
          if (n === ERROR) return ERROR
          if (n < min) min = n
        }
        return min
      }
      case 'MAX': {
        if (args.length === 0) return ERROR
        let max = -Infinity
        for (const a of args) {
          const n = toNumber(a)
          if (n === ERROR) return ERROR
          if (n > max) max = n
        }
        return max
      }
      default: {
        // COUNT: arguments evaluating to a non-null value (nullish skipped).
        let count = 0
        for (const a of args) if (a != null) count += 1
        return count
      }
    }
  }
}

/**
 * Evaluate a single-line cell formula against a row (see module docs for the
 * full syntax/value contract). Returns the computed value — `null` on ANY
 * error (unknown field, syntax error, div/mod by 0, non-finite arithmetic,
 * bounds exceeded) — and NEVER throws.
 */
export function evaluateFormula(formula: string, row: Record<string, unknown>): unknown {
  if (typeof formula !== 'string') return null
  let src = formula.trim()
  if (src.startsWith('=')) src = src.slice(1).trim()
  if (src.length === 0 || src.length > FORMULA_MAX_LENGTH) return null
  const tokens = tokenize(src)
  if (tokens === null) return null
  const parser = new FormulaParser(tokens, row)
  const value = parser.parseAddSub(0)
  if (value === ERROR || parser.peek().type !== 'eof') return null
  return value
}

/**
 * Memoized variant of {@link evaluateFormula}: values are cached per
 * (row-object identity, formula string) in a module-level WeakMap, so the
 * render path, sort comparators and export serializers evaluate each formula
 * at most once per row.
 *
 * CONTRACT (documented): the row is treated as IMMUTABLE — callers must pass
 * a NEW row reference when a field feeding a formula changes (the table's
 * documented immutable-row contract; its own write paths always produce new
 * row objects). In-place mutation of an already-cached row object would serve
 * stale computed values.
 */
export function memoizedFormulaValue(formula: string, row: object): unknown {
  let byFormula = formulaMemo.get(row)
  if (byFormula === undefined) {
    byFormula = new Map<string, unknown>()
    formulaMemo.set(row, byFormula)
  }
  if (byFormula.has(formula)) return byFormula.get(formula)
  const value = evaluateFormula(formula, row as Record<string, unknown>)
  byFormula.set(formula, value)
  return value
}

const formulaMemo = new WeakMap<object, Map<string, unknown>>()

/**
 * Excel-style bijective column letter for a 0-based column index:
 * 0 → 'A', 25 → 'Z', 26 → 'AA', 27 → 'AB', 51 → 'AZ', 52 → 'BA' …
 * Returns '' for a non-integer or negative index.
 */
export function columnLetter(index: number): string {
  if (!Number.isInteger(index) || index < 0) return ''
  let n = index + 1
  let out = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}
