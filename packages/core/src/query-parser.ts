/**
 * Natural-language table query parser — the C-layer material behind the
 * table's AI query bar (iris 独有; vxe has no built-in query grammar).
 *
 * Grammar (field names are case-insensitive; `and`/`or` connect clauses):
 *
 * ```
 *   field = value | field != value | field > value | field >= value |
 *   field < value | field <= value | field contains value |
 *   field in (a, b, c)  [ sort by field asc|desc ]
 * ```
 *
 * - Values may be single- or double-quoted (`'x'` / `"x"`); an unquoted
 *   value that collides with the `and`/`or` keywords must be quoted.
 * - `sort by` must be the trailing clause (an unquoted value containing
 *   ` sort by ` is quoted to survive the scan).
 * - Unknown fields produce an error STRING (never throws) when
 *   {@link ParseTableQueryOptions.fields} is provided; the matched clause
 *   uses the canonical (matched) key. Without `fields`, any field is
 *   accepted verbatim.
 * - Empty / whitespace-only query → empty result with no error.
 *
 * OR semantics (fail-closed — only what the existing filter channels can
 * express is allowed):
 * - same-field `=` OR folds into {@link ParsedTableQuery.inValues} (OR-match);
 * - same-field `in` OR (and `=` OR `in`) merge the value lists;
 * - same-field `contains` OR (per-value substring OR) → parse error;
 * - any other same-field OR (relational ops) → parse error;
 * - cross-field OR is normalized to AND (both clauses must hold).
 */

import type { FilterOperator, FilterRule, SortState } from './data-view'

export interface ParseTableQueryOptions {
  /**
   * Known field keys, matched case-insensitively. When provided, a clause on
   * an unknown field fails with an error string (never throws) and parsed
   * clauses use the MATCHED canonical key (so adapters pass column keys).
   * When omitted, any field is accepted verbatim. Default: no validation.
   */
  fields?: readonly string[]
}

/** The parsed form of a query string (all channels additive). */
export interface ParsedTableQuery {
  /** `=` / `contains` clauses → key → substring (case-insensitive). */
  filters: Record<string, string>
  /** `in (…)` lists (plus folded same-field `=`/`in` ORs) → key → OR-match values. */
  inValues: Record<string, string[]>
  /** Relational clauses (`!=` `>` `>=` `<` `<=`) → typed rules. */
  rules: FilterRule[]
  /** Trailing `sort by field asc|desc` clause; null when absent. */
  sort: SortState | null
  /** Parse error message; null when the query parsed cleanly. */
  error: string | null
}

const EMPTY: ParsedTableQuery = { filters: {}, inValues: {}, rules: [], sort: null, error: null }

type QueryOp = '=' | 'contains' | 'in' | '!=' | '>' | '>=' | '<' | '<='

const RELATIONAL_OPS: Record<string, FilterOperator> = {
  '!=': 'ne',
  '>': 'gt',
  '>=': 'gte',
  '<': 'lt',
  '<=': 'lte',
}

interface ClauseToken {
  text: string
  /** Separator that PRECEDED this clause (`and`/`or`), or null for the first. */
  sep: 'and' | 'or' | null
}

interface ParsedFilter {
  field: string
  op: QueryOp
  value: string
  values: string[]
  /** Whether the scalar value was quoted (relational coercion keeps it a string). */
  quoted: boolean
}

interface ClauseResult {
  filter?: ParsedFilter
  sort?: SortState
  error?: string
}

/** Split a query into top-level clauses on `and`/`or` keywords, respecting
 * quotes and `in (…)` parentheses. `sort by` is left inside its clause and
 * extracted per-clause (it is not a separator). */
function splitClauses(input: string): ClauseToken[] {
  const out: ClauseToken[] = []
  let current = ''
  let sep: 'and' | 'or' | null = null
  let quote: string | null = null
  let paren = 0
  let i = 0
  const n = input.length
  const flush = (): void => {
    const text = current.trim()
    if (text !== '') out.push({ text, sep })
    current = ''
    sep = null
  }
  const isKeywordAt = (kw: 'and' | 'or'): boolean => {
    if (input.slice(i, i + kw.length).toLowerCase() !== kw) return false
    // word boundaries on BOTH sides: `android` is not an `and`, and a bare
    // `and` after `role =` is a separator (unquoted keyword values must be quoted).
    if (i > 0 && /[A-Za-z0-9_]/.test(input[i - 1]!)) return false
    const after = input[i + kw.length]
    if (after !== undefined && /[A-Za-z0-9_]/.test(after)) return false
    return true
  }
  while (i < n) {
    const ch = input[i]!
    if (quote) {
      current += ch
      if (ch === quote) quote = null
      i += 1
      continue
    }
    if (ch === "'" || ch === '"') {
      quote = ch
      current += ch
      i += 1
      continue
    }
    if (ch === '(') {
      paren += 1
      current += ch
      i += 1
      continue
    }
    if (ch === ')') {
      paren = Math.max(0, paren - 1)
      current += ch
      i += 1
      continue
    }
    if (paren === 0 && (ch === 'a' || ch === 'A') && isKeywordAt('and')) {
      flush()
      sep = 'and'
      i += 3
      continue
    }
    if (paren === 0 && (ch === 'o' || ch === 'O') && isKeywordAt('or')) {
      flush()
      sep = 'or'
      i += 2
      continue
    }
    current += ch
    i += 1
  }
  flush()
  return out
}

/** Find a trailing top-level `sort by <spec>` segment (quote/paren-aware) so a
 * quoted value containing ` sort by ` survives. Returns the filter part and the
 * sort spec, or null when there is no sort clause. */
function extractTrailingSort(text: string): { rest: string; sortSpec: string } | null {
  let quote: string | null = null
  let paren = 0
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!
    if (quote) {
      if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"') {
      quote = ch
      continue
    }
    if (ch === '(') paren += 1
    else if (ch === ')') paren = Math.max(0, paren - 1)
    else if (paren === 0 && ch.toLowerCase() === 's' && /^sort\s+by\b/i.test(text.slice(i))) {
      if (i > 0 && !/\s/.test(text[i - 1]!)) continue
      const spec = text.slice(i + 4)
      const m = /^\s+by\b/i.exec(spec)
      if (!m) continue
      return { rest: text.slice(0, i).trim(), sortSpec: spec.slice(m[0].length).trim() }
    }
  }
  return null
}

/** Unquote a value; `null` signals a malformed quote. Keeps the quoted flag so
 * relational coercion can distinguish `25` (number) from `"25"` (string). */
function unquote(raw: string): { quoted: boolean; value: string } | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const first = trimmed[0]!
  if (first === "'" || first === '"') {
    if (trimmed.length < 2 || trimmed[trimmed.length - 1] !== first) return null
    if (trimmed.slice(1, -1).includes(first)) return null
    return { quoted: true, value: trimmed.slice(1, -1) }
  }
  return { quoted: false, value: trimmed }
}

/** Parse an `in (…)` list; returns the values or an error message. */
function parseInList(raw: string): string[] | string {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) {
    return 'in-list must be parenthesized: field in (a, b, c)'
  }
  const inner = trimmed.slice(1, -1).trim()
  if (inner === '') return 'in-list must not be empty'
  const parts: string[] = []
  let current = ''
  let quote: string | null = null
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i]!
    if (quote) {
      current += ch
      if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"') {
      quote = ch
      current += ch
      continue
    }
    if (ch === ',') {
      parts.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  parts.push(current.trim())
  const out: string[] = []
  for (const part of parts) {
    const u = unquote(part)
    if (u === null) return `Invalid in-list value "${part}"`
    out.push(u.value)
  }
  return out
}

/** Parse one clause (`field op value`, `field in (…)`, `sort by …`, or a
 * filter clause with a trailing `sort by`). */
function parseClause(text: string, canonical: (name: string) => string | null): ClauseResult {
  const trimmed = text.trim()
  const trailing = extractTrailingSort(trimmed)
  const rest = trailing ? trailing.rest : trimmed
  let sort: SortState | undefined
  if (trailing) {
    const parts = trailing.sortSpec.split(/\s+/)
    const dirRaw = parts.length > 1 ? parts[parts.length - 1]!.toLowerCase() : undefined
    const dir = dirRaw === undefined ? 'asc' : dirRaw
    if (dir !== 'asc' && dir !== 'desc') {
      return { error: `Invalid sort direction "${dirRaw}"` }
    }
    const fieldName = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0]!
    const field = canonical(fieldName)
    if (field === null) return { error: `Unknown field "${fieldName}"` }
    sort = { key: field, direction: dir }
  }
  if (rest === '') {
    return sort ? { sort } : { error: `Invalid clause "${trimmed}"` }
  }

  // Word operators first (`contains` / `in`) — a symbol-less clause.
  const wordMatch = /^(.+?)\s+(contains|in)\s+(.+)$/i.exec(rest)
  if (wordMatch) {
    const fieldName = wordMatch[1]!.trim()
    const field = canonical(fieldName)
    if (field === null) return { error: `Unknown field "${fieldName}"` }
    const op = wordMatch[2]!.toLowerCase() as 'contains' | 'in'
    if (op === 'in') {
      const values = parseInList(wordMatch[3]!)
      if (typeof values === 'string') return { error: values }
      return sort
        ? { filter: { field, op, value: '', values, quoted: false }, sort }
        : { filter: { field, op, value: '', values, quoted: false } }
    }
    const u = unquote(wordMatch[3]!)
    if (u === null) return { error: `Invalid value for "${fieldName}"` }
    return sort
      ? { filter: { field, op, value: u.value, values: [], quoted: u.quoted }, sort }
      : { filter: { field, op, value: u.value, values: [], quoted: u.quoted } }
  }

  // Symbol operators (`>= <= != > < =`).
  const symMatch = /^(.+?)\s*(>=|<=|!=|>|<|=)\s*(.+)$/.exec(rest)
  if (symMatch) {
    const fieldName = symMatch[1]!.trim()
    const field = canonical(fieldName)
    if (field === null) return { error: `Unknown field "${fieldName}"` }
    const op = symMatch[2] as QueryOp
    const u = unquote(symMatch[3]!)
    if (u === null) return { error: `Invalid value for "${fieldName}"` }
    return sort
      ? { filter: { field, op, value: u.value, values: [], quoted: u.quoted }, sort }
      : { filter: { field, op, value: u.value, values: [], quoted: u.quoted } }
  }
  return { error: `Invalid clause "${trimmed}"` }
}

/** Fold a scalar/in-list into the inValues channel (used by same-field ORs). */
function foldIntoInValues(out: ParsedTableQuery, field: string, ...values: string[]): void {
  const existing = out.inValues[field] ?? []
  if (out.filters[field] !== undefined) {
    existing.push(out.filters[field])
    delete out.filters[field]
  }
  out.inValues[field] = [...existing, ...values]
}

/** Relational rule value: numeric-looking unquoted → number, else string. */
function coerceValue(raw: string, quoted: boolean): unknown {
  if (quoted) return raw
  const trimmed = raw.trim()
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed)
  return trimmed
}

/**
 * Parse a natural-language table query into the additive filter/sort channels.
 * Never throws: malformed input produces an {@link ParsedTableQuery.error}
 * string while keeping the parse partial-free (all-or-nothing).
 */
export function parseTableQuery(query: string, options?: ParseTableQueryOptions): ParsedTableQuery {
  const fields = options?.fields
  const canonical = (name: string): string | null => {
    if (!fields) return name
    const lower = name.toLowerCase()
    return fields.find((f) => f.toLowerCase() === lower) ?? null
  }
  const clauses = splitClauses(query)
  if (clauses.length === 0) return EMPTY

  const out: ParsedTableQuery = { filters: {}, inValues: {}, rules: [], sort: null, error: null }
  let prevFilter: { field: string; op: QueryOp } | null = null
  for (let i = 0; i < clauses.length; i += 1) {
    const clause = clauses[i]!
    const parsed = parseClause(clause.text, canonical)
    if (parsed.error !== undefined) return { ...EMPTY, error: parsed.error }
    if (parsed.filter === undefined) {
      // sort-only clause
      if (i !== clauses.length - 1) return { ...EMPTY, error: 'sort by must be the last clause' }
      out.sort = parsed.sort ?? null
      continue
    }
    if (parsed.sort !== undefined && i !== clauses.length - 1) {
      return { ...EMPTY, error: 'sort by must be the last clause' }
    }
    if (parsed.sort !== undefined) out.sort = parsed.sort
    const f = parsed.filter
    const sameFieldOr = clause.sep === 'or' && prevFilter !== null && prevFilter.field === f.field
    if (sameFieldOr) {
      // Only `=`/`in` pairs can fold into the OR-match inValues channel; any
      // other same-field OR (contains / relational / mixed) is not expressible.
      const foldable =
        (f.op === '=' || f.op === 'in') && (prevFilter!.op === '=' || prevFilter!.op === 'in')
      if (!foldable) {
        return { ...EMPTY, error: `Cannot OR "${f.op}" on the same field "${f.field}"` }
      }
      foldIntoInValues(out, f.field, ...(f.op === '=' ? [f.value] : f.values))
    } else if (f.op === '=') {
      out.filters[f.field] = f.value
    } else if (f.op === 'contains') {
      out.filters[f.field] = f.value
    } else if (f.op === 'in') {
      out.inValues[f.field] = f.values
    } else {
      // relational: != > >= < <=
      out.rules.push({
        key: f.field,
        operator: RELATIONAL_OPS[f.op]!,
        value: coerceValue(f.value, f.quoted),
      })
    }
    prevFilter = { field: f.field, op: f.op }
  }
  return out
}
