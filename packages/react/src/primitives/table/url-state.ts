import type { IrisTableFilterValues, IrisTableSortState } from './types'

// ── Batch DV: URL state deep-link (iris 独有 — vxe has no URL-state) ────
// `urlState` serializes the view state into ONE `_table` query param. The wire
// format is a versioned JSON object (`{v:1, sort?, sorts?, filters?,
// filterValues?, page?, pageSize?}`) — `sorts` is the multiSort channel
// (multiSort mode only); `page`/`pageSize` are proxy-only. Decode is
// WHOLE-STATE fail-closed: schema version + per-piece type guards — any
// violation → null, never a partial restore. Encoding uses URLSearchParams
// (set/get are symmetric, exactly-once percent-decoding), preserving every
// other param.
//
// This is pure view-state serialisation with no React and no table instance, so
// it lives apart from the component: it can be reasoned about and tested on its
// own, and it keeps the 9k-line component focused on rendering.

/** URL-state snapshot (batch DV): the pieces `urlState` reads/writes in the
 * `_table` query param. Mirror of `IrisTablePersistedState` minus the
 * layout/expansion pieces — a deep link carries what affects served rows. */
export interface IrisTableUrlState {
  /** Wire schema version — decode rejects anything else (forward-compat). */
  v: 1
  /** Single-column sort (omitted when inactive; null never encoded). */
  sort?: IrisTableSortState | null
  /** Multi-column sort list (multiSort mode only, non-empty). */
  sorts?: IrisTableSortState[]
  /** Text filters (column key → filter text, non-empty map only). */
  filters?: Record<string, string>
  /** Checked filter sets (column key → values, non-empty map only). */
  filterValues?: IrisTableFilterValues
  /** 1-based page (proxy only; omitted when 1). */
  page?: number
  /** Rows per page (proxy only). */
  pageSize?: number
}

/** Query-param key that carries the whole payload. */
export const IRIS_URL_STATE_KEY = '_table'

function isUrlSortState(v: unknown): v is IrisTableSortState {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false
  const s = v as Record<string, unknown>
  return (
    typeof s.key === 'string' && s.key !== '' && (s.direction === 'asc' || s.direction === 'desc')
  )
}

function isUrlStringMap(v: unknown): v is Record<string, string> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false
  for (const value of Object.values(v)) {
    if (typeof value !== 'string') return false
  }
  return true
}

function isUrlStringArrayMap(v: unknown): v is IrisTableFilterValues {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false
  for (const value of Object.values(v)) {
    if (!Array.isArray(value)) return false
    for (const item of value) {
      if (typeof item !== 'string') return false
    }
  }
  return true
}

/** Whole-state fail-closed decode of a `_table` payload: corrupt JSON, wrong
 * schema version, or ANY invalid piece → null (never a partial restore). */
export function decodeUrlTableState(raw: string): IrisTableUrlState | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  const record = parsed as Record<string, unknown>
  if (record.v !== 1) return null
  const out: IrisTableUrlState = { v: 1 }
  if (record.sort !== undefined) {
    if (record.sort !== null && !isUrlSortState(record.sort)) return null
    out.sort = record.sort as IrisTableSortState | null
  }
  if (record.sorts !== undefined) {
    if (!Array.isArray(record.sorts) || !record.sorts.every(isUrlSortState)) return null
    out.sorts = record.sorts as IrisTableSortState[]
  }
  if (record.filters !== undefined) {
    if (!isUrlStringMap(record.filters)) return null
    out.filters = record.filters as Record<string, string>
  }
  if (record.filterValues !== undefined) {
    if (!isUrlStringArrayMap(record.filterValues)) return null
    out.filterValues = record.filterValues as IrisTableFilterValues
  }
  if (record.page !== undefined) {
    if (typeof record.page !== 'number' || !Number.isInteger(record.page) || record.page < 1) {
      return null
    }
    out.page = record.page
  }
  if (record.pageSize !== undefined) {
    if (
      typeof record.pageSize !== 'number' ||
      !Number.isInteger(record.pageSize) ||
      record.pageSize < 1
    ) {
      return null
    }
    out.pageSize = record.pageSize
  }
  return out
}

/** Read + decode the current URL's `_table` param. SSR-guarded: no window →
 * null. Returns null when the param is absent OR the payload is invalid. */
export function readUrlTableState(): IrisTableUrlState | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get(IRIS_URL_STATE_KEY)
  if (raw === null) return null
  return decodeUrlTableState(raw)
}

/** Current raw `_table` param value (the same exactly-once-decoded value the
 * writer serializes — used for idempotent write-skip comparison). */
function readUrlTableParam(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(IRIS_URL_STATE_KEY)
}

/** Replace the `_table` param (preserving every other param) via
 * `history.replaceState` — never pushes history entries. `null` removes it. */
export function writeUrlTableState(value: string | null): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (value === null) url.searchParams.delete(IRIS_URL_STATE_KEY)
  else url.searchParams.set(IRIS_URL_STATE_KEY, value)
  window.history.replaceState(null, '', url.toString())
}

/** Canonical JSON of a payload (fixed field order, so equal states compare
 * byte-equal). A payload with no pieces serializes to null — the URL's
 * `_table` is then removed. */
export function serializeUrlTableState(state: IrisTableUrlState | null): string | null {
  if (!state) return null
  const hasPiece =
    state.sort !== undefined ||
    state.sorts !== undefined ||
    state.filters !== undefined ||
    state.filterValues !== undefined ||
    state.page !== undefined ||
    state.pageSize !== undefined
  if (!hasPiece) return null
  return JSON.stringify(state)
}

/** Current raw `_table` param, exported for the component's write-skip check. */
export { readUrlTableParam }
