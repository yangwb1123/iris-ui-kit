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
 * - Cross-table references (batch BC, iris 独有): `table!field` — reads
 *   `formulaTables[table][0][field]` (the FIRST row of the named external
 *   table; `formulaTables` is the optional 3rd argument of `evaluateFormula`).
 *   Missing tables arg / unknown table / EMPTY table / unknown field → the
 *   whole formula is null (fail-closed, same contract as unknown fields); a
 *   KNOWN nullish field value still coerces (Excel parity).
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

/**
 * External table data for cross-table formula references (batch BC):
 * `formulaTables[table][0][field]` — a table name maps to its rows, and a
 * `table!field` reference reads the FIRST row's field. Row objects are
 * treated as IMMUTABLE (same contract as the formula row); pass a NEW
 * tables object when any referenced table changes.
 */
export type FormulaTables = Record<string, readonly Record<string, unknown>[]>

/** Internal error sentinel: distinct from a legit nullish field value. */
const ERROR = Symbol('formula-error')

type FormulaToken =
  | { type: 'num'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'bang' }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '%' }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' }
  | { type: 'eof' }

const TOKEN_RE = /[0-9]+(?:\.[0-9]+)?|[A-Za-z_][A-Za-z0-9_]*|[+\-*/%(),!]/g

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
    else if (tok === '!') tokens.push({ type: 'bang' })
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
/**
 * Batch BC: resolve a `table!field` cross-table reference, fail-closed —
 * missing tables arg / unknown table / EMPTY table / unknown field all
 * poison the whole formula (ERROR → null). Own-property lookups only (a
 * prototype hit such as `toString` must NOT read Object.prototype). A
 * KNOWN nullish field value is returned as-is and coerces downstream
 * (Excel empty-cell-as-zero parity).
 */
function resolveTableField(
  table: string,
  field: string,
  tables: FormulaTables | undefined,
): unknown {
  if (tables === undefined) return ERROR
  if (!Object.prototype.hasOwnProperty.call(tables, table)) return ERROR
  const rows = tables[table]
  if (rows == null || rows.length === 0) return ERROR
  const first: unknown = rows[0]
  if (typeof first !== 'object' || first === null) return ERROR
  if (!Object.prototype.hasOwnProperty.call(first, field)) return ERROR
  return (first as Record<string, unknown>)[field]
}

function addSubOperator(token: FormulaToken): '+' | '-' | null {
  return token.type === 'op' && (token.value === '+' || token.value === '-') ? token.value : null
}

function mulDivOperator(token: FormulaToken): '*' | '/' | '%' | null {
  return token.type === 'op' && (token.value === '*' || token.value === '/' || token.value === '%')
    ? token.value
    : null
}

function applyAddSub(left: unknown, right: unknown, op: '+' | '-'): unknown {
  if (typeof left === 'string' || typeof right === 'string') {
    return op === '-' ? ERROR : String(left ?? '') + String(right ?? '')
  }
  const na = toNumber(left)
  const nb = toNumber(right)
  if (na === ERROR || nb === ERROR) return ERROR
  const result = op === '+' ? na + nb : na - nb
  return Number.isFinite(result) ? result : ERROR
}

function applyMulDiv(left: unknown, right: unknown, op: '*' | '/' | '%'): unknown {
  const na = toNumber(left)
  const nb = toNumber(right)
  if (na === ERROR || nb === ERROR) return ERROR
  if ((op === '/' || op === '%') && nb === 0) return ERROR
  const result = op === '*' ? na * nb : op === '/' ? na / nb : na % nb
  return Number.isFinite(result) ? result : ERROR
}

function aggregateNumeric(args: unknown[], mode: 'sum' | 'avg' | 'min' | 'max'): unknown {
  if ((mode === 'avg' || mode === 'min' || mode === 'max') && args.length === 0) return ERROR
  let result = mode === 'min' ? Infinity : mode === 'max' ? -Infinity : 0
  for (const arg of args) {
    const number = toNumber(arg)
    if (number === ERROR) return ERROR
    if (mode === 'min') result = Math.min(result, number)
    else if (mode === 'max') result = Math.max(result, number)
    else result += number
  }
  return mode === 'avg' ? result / args.length : result
}

function evaluateAggregate(name: string, args: unknown[]): unknown {
  if (name === 'COUNT') return args.filter((arg) => arg != null).length
  if (name === 'SUM') return aggregateNumeric(args, 'sum')
  if (name === 'AVG') return aggregateNumeric(args, 'avg')
  if (name === 'MIN') return aggregateNumeric(args, 'min')
  return aggregateNumeric(args, 'max')
}

class FormulaParser {
  private pos = 0
  private readonly tokens: FormulaToken[]
  private readonly row: Record<string, unknown>
  private readonly tables: FormulaTables | undefined

  constructor(tokens: FormulaToken[], row: Record<string, unknown>, tables?: FormulaTables) {
    this.tokens = tokens
    this.row = row
    this.tables = tables
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
      const op = addSubOperator(this.peek())
      if (op === null) return left
      this.next()
      const right = this.parseMulDiv(level)
      if (right === ERROR) return ERROR
      left = applyAddSub(left, right, op)
      if (left === ERROR) return ERROR
    }
  }

  /** Multiplicative level: `a (*|/|%) b`. */
  private parseMulDiv(level: number): unknown {
    let left = this.parsePrimary(level)
    if (left === ERROR) return ERROR
    for (;;) {
      const op = mulDivOperator(this.peek())
      if (op === null) return left
      this.next()
      const right = this.parsePrimary(level)
      if (right === ERROR) return ERROR
      left = applyMulDiv(left, right, op)
      if (left === ERROR) return ERROR
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
      // Batch BC: `table!field` cross-table reference (fail-closed via
      // resolveTableField — a bare `!` in any other position is an error).
      if (this.peek().type === 'bang') {
        this.next()
        const fieldTok = this.peek()
        if (fieldTok.type !== 'ident') return ERROR
        this.next()
        return resolveTableField(t.value, fieldTok.value, this.tables)
      }
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

  private parseFunctionArgs(level: number): unknown[] | typeof ERROR {
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
    return args
  }

  private callFunction(name: string, level: number): unknown {
    const args = this.parseFunctionArgs(level)
    return args === ERROR ? ERROR : evaluateAggregate(name, args)
  }
}

/**
 * Evaluate a single-line cell formula against a row (see module docs for the
 * full syntax/value contract). Returns the computed value — `null` on ANY
 * error (unknown field, syntax error, div/mod by 0, non-finite arithmetic,
 * bounds exceeded) — and NEVER throws. The optional 3rd argument supplies
 * external table data for `table!field` cross-table references (batch BC).
 */
export function evaluateFormula(
  formula: string,
  row: Record<string, unknown>,
  formulaTables?: FormulaTables,
): unknown {
  if (typeof formula !== 'string') return null
  let src = formula.trim()
  if (src.startsWith('=')) src = src.slice(1).trim()
  if (src.length === 0 || src.length > FORMULA_MAX_LENGTH) return null
  const tokens = tokenize(src)
  if (tokens === null) return null
  const parser = new FormulaParser(tokens, row, formulaTables)
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
export function memoizedFormulaValue(
  formula: string,
  row: object,
  formulaTables?: FormulaTables,
): unknown {
  // Cache key = (row identity, tables identity, formula): nested WeakMaps so
  // the tables object participates in the key without ever being retained.
  // 2-arg calls share a module sentinel slot — byte-compatible with the
  // pre-BC behavior (no tables → cross-table refs evaluate to null either way).
  let byTables = formulaMemo.get(row)
  if (byTables === undefined) {
    byTables = new WeakMap<object, Map<string, unknown>>()
    formulaMemo.set(row, byTables)
  }
  const tablesKey: object = formulaTables ?? NO_TABLES
  let byFormula = byTables.get(tablesKey)
  if (byFormula === undefined) {
    byFormula = new Map<string, unknown>()
    byTables.set(tablesKey, byFormula)
  }
  if (byFormula.has(formula)) return byFormula.get(formula)
  const value = evaluateFormula(formula, row as Record<string, unknown>, formulaTables)
  byFormula.set(formula, value)
  return value
}

const formulaMemo = new WeakMap<object, WeakMap<object, Map<string, unknown>>>()
/** Module sentinel: 2-arg memoizedFormulaValue calls share one "no tables" slot. */
const NO_TABLES: FormulaTables = {}

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
