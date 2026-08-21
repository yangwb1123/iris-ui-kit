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

function isQueryKeywordAt(input: string, index: number, keyword: 'and' | 'or'): boolean {
  if (input.slice(index, index + keyword.length).toLowerCase() !== keyword) return false
  if (index > 0 && /[A-Za-z0-9_]/.test(input[index - 1]!)) return false
  const after = input[index + keyword.length]
  return after === undefined || !/[A-Za-z0-9_]/.test(after)
}

function pushQueryClause(
  out: ClauseToken[],
  current: string,
  sep: 'and' | 'or' | null,
  force: boolean,
): void {
  const text = current.trim()
  if (text !== '' || sep !== null || force) out.push({ text, sep })
}

function queryStructuralChar(
  ch: string,
  quote: string | null,
  paren: number,
): { quote: string | null; paren: number } | null {
  if (quote) return { quote: ch === quote ? null : quote, paren }
  if (ch === "'" || ch === '"') return { quote: ch, paren }
  if (ch === '(') return { quote: null, paren: paren + 1 }
  if (ch === ')') return { quote: null, paren: Math.max(0, paren - 1) }
  return null
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
  while (i < n) {
    const ch = input[i]!
    const structural = queryStructuralChar(ch, quote, paren)
    if (structural) {
      current += ch
      quote = structural.quote
      paren = structural.paren
      i += 1
      continue
    }
    if (paren === 0 && (ch === 'a' || ch === 'A') && isQueryKeywordAt(input, i, 'and')) {
      pushQueryClause(out, current, sep, current.trim() === '' && sep === null)
      current = ''
      sep = null
      sep = 'and'
      i += 3
      continue
    }
    if (paren === 0 && (ch === 'o' || ch === 'O') && isQueryKeywordAt(input, i, 'or')) {
      pushQueryClause(out, current, sep, current.trim() === '' && sep === null)
      current = ''
      sep = null
      sep = 'or'
      i += 2
      continue
    }
    current += ch
    i += 1
  }
  pushQueryClause(out, current, sep, false)
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
    // A list has exactly one outer pair.  Reject unquoted nested/closing
    // parentheses instead of accepting `in (a) in (b)` as one opaque value.
    if (ch === '(' || ch === ')') {
      return `Invalid in-list value "${current + ch}"`
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

function parseQuerySort(
  sortSpec: string,
  canonical: (name: string) => string | null,
): { sort?: SortState; error?: string } {
  const parts = sortSpec.split(/\s+/)
  const dirRaw = parts.length > 1 ? parts[parts.length - 1]!.toLowerCase() : undefined
  const dir = dirRaw === undefined ? 'asc' : dirRaw
  if (dir !== 'asc' && dir !== 'desc') return { error: `Invalid sort direction "${dirRaw}"` }
  const fieldName = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0]!
  const field = canonical(fieldName)
  if (field === null) return { error: `Unknown field "${fieldName}"` }
  return { sort: { key: field, direction: dir } }
}

function withClauseSort(filter: ParsedFilter, sort: SortState | undefined): ClauseResult {
  return sort ? { filter, sort } : { filter }
}

function parseWordClause(
  text: string,
  sort: SortState | undefined,
  canonical: (name: string) => string | null,
): ClauseResult | null {
  const match = /^(.+?)\s+(contains|in)\s+(.+)$/i.exec(text)
  if (!match) return null
  const fieldName = match[1]!.trim()
  const field = canonical(fieldName)
  if (field === null) return { error: `Unknown field "${fieldName}"` }
  const op = match[2]!.toLowerCase() as 'contains' | 'in'
  if (op === 'in') {
    const values = parseInList(match[3]!)
    if (typeof values === 'string') return { error: values }
    return withClauseSort({ field, op, value: '', values, quoted: false }, sort)
  }
  const value = unquote(match[3]!)
  if (value === null) return { error: `Invalid value for "${fieldName}"` }
  return withClauseSort({ field, op, value: value.value, values: [], quoted: value.quoted }, sort)
}

function parseSymbolClause(
  text: string,
  sort: SortState | undefined,
  canonical: (name: string) => string | null,
): ClauseResult | null {
  const match = /^(.+?)\s*(>=|<=|!=|>|<|=)\s*(.+)$/.exec(text)
  if (!match) return null
  const fieldName = match[1]!.trim()
  const field = canonical(fieldName)
  if (field === null) return { error: `Unknown field "${fieldName}"` }
  const value = unquote(match[3]!)
  if (value === null) return { error: `Invalid value for "${fieldName}"` }
  return withClauseSort(
    { field, op: match[2] as QueryOp, value: value.value, values: [], quoted: value.quoted },
    sort,
  )
}

/** Parse one clause (`field op value`, `field in (…)`, `sort by …`, or a
 * filter clause with a trailing `sort by`). */
function parseClause(text: string, canonical: (name: string) => string | null): ClauseResult {
  const trimmed = text.trim()
  const trailing = extractTrailingSort(trimmed)
  const rest = trailing ? trailing.rest : trimmed
  const sortResult = trailing ? parseQuerySort(trailing.sortSpec, canonical) : {}
  if (sortResult.error) return { error: sortResult.error }
  const sort = sortResult.sort
  if (rest === '') {
    return sort ? { sort } : { error: `Invalid clause "${trimmed}"` }
  }
  return (
    parseWordClause(rest, sort, canonical) ??
    parseSymbolClause(rest, sort, canonical) ?? {
      error: `Invalid clause "${trimmed}"`,
    }
  )
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

function createCanonicalFieldResolver(
  fields: readonly string[] | undefined,
): (name: string) => string | null {
  if (!fields) return (name) => name
  return (name) => {
    const lower = name.toLowerCase()
    return fields.find((field) => field.toLowerCase() === lower) ?? null
  }
}

function applyParsedFilter(out: ParsedTableQuery, filter: ParsedFilter): void {
  if (filter.op === '=' || filter.op === 'contains') {
    out.filters[filter.field] = filter.value
  } else if (filter.op === 'in') {
    out.inValues[filter.field] = filter.values
  } else {
    out.rules.push({
      key: filter.field,
      operator: RELATIONAL_OPS[filter.op]!,
      value: coerceValue(filter.value, filter.quoted),
    })
  }
}

function applyFilterWithOr(
  out: ParsedTableQuery,
  filter: ParsedFilter,
  clause: ClauseToken,
  previous: { field: string; op: QueryOp } | null,
): string | undefined {
  const sameFieldOr = clause.sep === 'or' && previous?.field === filter.field
  if (!sameFieldOr) {
    applyParsedFilter(out, filter)
    return undefined
  }
  const foldable =
    (filter.op === '=' || filter.op === 'in') && (previous!.op === '=' || previous!.op === 'in')
  if (!foldable) return `Cannot OR "${filter.op}" on the same field "${filter.field}"`
  foldIntoInValues(out, filter.field, ...(filter.op === '=' ? [filter.value] : filter.values))
  return undefined
}

function applyParsedClause(
  out: ParsedTableQuery,
  parsed: ClauseResult,
  clause: ClauseToken,
  index: number,
  clauseCount: number,
  previous: { field: string; op: QueryOp } | null,
): { previous: { field: string; op: QueryOp } | null; error?: string } {
  if (parsed.error !== undefined) return { previous, error: parsed.error }
  if (parsed.filter === undefined) {
    if (index !== clauseCount - 1) return { previous, error: 'sort by must be the last clause' }
    out.sort = parsed.sort ?? null
    return { previous }
  }
  if (parsed.sort !== undefined && index !== clauseCount - 1) {
    return { previous, error: 'sort by must be the last clause' }
  }
  if (parsed.sort !== undefined) out.sort = parsed.sort
  const filter = parsed.filter
  const filterError = applyFilterWithOr(out, filter, clause, previous)
  if (filterError) return { previous, error: filterError }
  return { previous: { field: filter.field, op: filter.op } }
}

/**
 * Parse a natural-language table query into the additive filter/sort channels.
 * Never throws: malformed input produces an {@link ParsedTableQuery.error}
 * string while keeping the parse partial-free (all-or-nothing).
 */
export function parseTableQuery(query: string, options?: ParseTableQueryOptions): ParsedTableQuery {
  const canonical = createCanonicalFieldResolver(options?.fields)
  const clauses = splitClauses(query)
  if (clauses.length === 0) return EMPTY

  const out: ParsedTableQuery = { filters: {}, inValues: {}, rules: [], sort: null, error: null }
  let prevFilter: { field: string; op: QueryOp } | null = null
  for (let i = 0; i < clauses.length; i += 1) {
    const clause = clauses[i]!
    const parsed = parseClause(clause.text, canonical)
    const applied = applyParsedClause(out, parsed, clause, i, clauses.length, prevFilter)
    if (applied.error) return { ...EMPTY, error: applied.error }
    prevFilter = applied.previous
  }
  return out
}
