import type { IrisTableProxyQueryParams } from './base'

export interface IrisTableHandle<Row extends Record<string, unknown> = Record<string, unknown>> {
  /** Insert a row at `index` (default: end). A missing `rowKeyField` value gets an auto id. */
  insertRow: (row: Row, index?: number) => void
  /** Clone the row with `key` (iris 独有): all field values shallow-copied onto a fresh auto id, inserted right after the source (or at `index`); missing key is a silent no-op. */
  cloneRow: (key: string | number, index?: number) => void
  /** Remove the row with `key`; its selection is pruned. */
  removeRow: (key: string | number) => void
  /** Batch-remove several rows by key (vxe removeRows parity): missing keys are silent no-ops, selection is pruned, one onDataChange fires. */
  removeRows: (keys: Array<string | number>) => void
  /** Patch the row with `key` ({ ...row, ...patch }). */
  updateRow: (key: string | number, patch: Partial<Row>) => void
  /** Re-fetch the current page (proxy mode). */
  refetch: () => void
  /** Replace the live row list (vxe loadData parity, batch V): fires onDataChange; in proxy mode the proxy state total stays unchanged until the next query (the core remote source has no setData — documented). */
  loadData: (rows: Row[]) => void
  /** Re-fetch the current page (vxe reloadData parity, batch V — alias of refetch). */
  reloadData: () => void
  /** Merge params into the proxy query and fire the request (vxe commitProxy parity, batch V). */
  commitProxy: (overrides: Partial<IrisTableProxyQueryParams>) => void
  /** Proxy state snapshot (vxe getProxyInfo parity, batch V): page/pageSize/total; null without a proxy. */
  getProxyInfo: () => { page: number; pageSize: number; total: number } | null
  /** Snapshot (copy) of the current live row list (vxe getTableData parity). */
  getData: () => Row[]
  /** Snapshot (copy) of the currently filtered + sorted rows (vxe getFilteredData parity, batch W): the filteredData memo value — the loaded page after local filters/sort (proxy mode: page after the prop `filters` merge), remoteFilter passes rows through unchanged. The handle object is re-created every render, so this always closes over the latest memo. */
  getFilteredData: () => Row[]
  /** Serialize the CURRENT filtered view as CSV (batch W): `exportCsv(getFilteredData(), displayColumns)` — hidden columns excluded (displayColumns drops columnVisibility/visibleMethod hides), formula injection neutralized; returns a plain string without BOM (caller downloads via `downloadCsv`). */
  exportCurrentViewCsv: () => string
  /** Serialize the SELECTED rows as CSV (batch AP, iris 独有): selected rows
   * in bodyData order (filtered + sorted + tree-flattened) → the same
   * `exportCsv` shape as `exportCurrentViewCsv` (formula columns materialized
   * on shadow rows, hidden columns excluded); empty selection → `''` (caller
   * detects via `getSelection()`). */
  exportSelectionCsv: () => string
  /** Serialize rows whose keys are explicitly supplied, preserving current
   * body/view order and the same formula/mask/hidden-column pipeline. */
  exportRowsCsv: (keys: Array<string | number>) => string
  /** Multi-segment CSV export (batch DI, iris 独有): ONE file — the current
   * table block (`# current` + `exportCurrentViewCsv()` byte-for-byte) followed
   * by one `# <key>` + ref block per `exportNames` entry IN ORDER; segments
   * joined by a blank line (`\n\n`), no trailing newline. Each ref block is
   * serialized by its OWN keys (first row's keys as header) — NOT this table's
   * columns; empty ref rows → just the segment header; a `''` key skips that
   * segment (even its header). Empty/absent `exportNames` → the bare
   * current-table CSV (byte-identical to `exportCurrentViewCsv()`, zero
   * regression). Caller downloads via `downloadCsv`. */
  exportMultiCsv: () => string
  /** Current selection keys (vxe getCheckboxRecords parity). */
  getSelection: () => Array<string | number>
  /** Clear every selected row (vxe clearCheckboxRow parity). */
  clearSelection: () => void
  /** Select every checkMethod-eligible row of the current page (vxe
   * setAllCheckboxRow(true) parity — `checkMethod` rows are skipped). */
  selectAll: () => void
  /** Toggle a single row's selection by key (vxe toggleCheckboxRow parity —
   * a direct toggle that bypasses `checkMethod`). */
  toggleRowSelection: (key: string | number) => void
  /** Scroll the row with `key` into view (vxe scrollToRow parity); no-op when the row is not rendered. */
  scrollToRow: (key: string | number) => void
  /** Scroll the row with `key` into view AND flash a transient row highlight (`data-iris-row-target`, cleared after 2s — batch CZ, iris 独有: vxe has no locate flash); a later goToRow replaces the previous target; unknown/unrendered key → no-op (scrollToRow precedent); fires no events and needs no `onCurrentRowChange`. */
  goToRow: (key: string | number) => void
  /** Toggle a row's expand state (vxe toggleRowExpand parity): tree mode toggles the caret, detail mode the panel; no-op for plain tables. */
  toggleRowExpand: (key: string | number) => void
  /** Clear the active sort (vxe clearSort parity) — single and multi channels. */
  clearSort: () => void
  /** Clear every filter channel (vxe clearFilter parity): text filters + checked sets. */
  clearFilter: () => void
  /** Set the current (highlighted) row (vxe setCurrentRow parity); no-op without onCurrentRowChange (or an unknown key). */
  setCurrentRow: (key: string | number) => void
  /** Set the current (highlighted) column (vxe setCurrentColumn parity); no-op without onCurrentColumnChange (or an unknown key). */
  setCurrentColumn: (key: string) => void
  /** Audit trail snapshot (batch AT, iris 独有): newest-first entries (seq/at/type/rowKey/column/old→new) — an empty array when `auditLog` is off or nothing was committed yet. */
  getAuditLog: () => ReadonlyArray<IrisTableAuditEntry>
  /** Wipe every audit entry (batch AT, iris 独有): the seq counter never resets — audit integrity. No-op without `auditLog`. */
  clearAuditLog: () => void
  /** Version-history snapshot (batch BA, iris 独有): newest-first LIGHTWEIGHT entries (index/at/type — deliberately WITHOUT rows, so the snapshot stays cheap; `restoreVersion` fetches the rows from the controller) — an empty array when `versionHistory` is off or nothing was committed yet. */
  getVersions: () => ReadonlyArray<IrisTableVersionEntry>
  /** Restore the rows captured before the commit with `index` (batch BA, iris 独有): applies them through the normal write-back channel (`commitRowList`, type `'undo'` — auditable and undoable) WITHOUT pushing a new version; no-op for an unknown index (trimmed/cleared) or without `versionHistory`. */
  restoreVersion: (index: number) => void
  /** Export the rows captured BEFORE the commit with `index` as CSV (batch BF, iris 独有): the same `exportCsv` shape as `exportCurrentViewCsv` (formula columns materialized on shadow rows, masks applied, hidden columns excluded) — the PRE-change snapshot, NOT the live view; an unknown index (trimmed/cleared) or no `versionHistory` → `''` (caller detects via `getVersions()`). */
  exportVersionCsv: (index: number) => string
  /** Export the compare-view DIFF rows as CSV (batch BV, iris 独有): current-view rows marked `removed`/`changed` in VIEW order + `compareWith`-only `added` rows in SNAPSHOT order, each prefixed with a marker column (`__iris_diff`, header = i18n `table.compare.diff`); changed cells export a `maskedOld → maskedNew` composite (mask before composition; `exportRaw` keeps both sides bare; formula columns do not self-composite) — same serializer shape as `exportCurrentViewCsv` (formula materialized, masks applied, hidden columns excluded); no `compareWith`/`rowKey` → `''`, identical snapshots → header only. */
  exportComparisonCsv: () => string
  /** Export the audit trail as CSV (batch CO, iris 独有): spec-literal 6 columns `time,type,rowKey,column,old,new` — `time` = `formatClock(new Date(at))` (HH:MM:SS local — byte-identical to the audit panel's time cell, display/export consistency), the rest verbatim (undefined → '', typed numbers bare, strings RFC-4180-quoted + OWASP formula-neutralized via core `toCsv` — audit content is untrusted data); newest-first (ring order — the same view as `getAuditLog`); `auditLog` off → `''`, on but empty ring → header only (two states, caller distinguishes via `getAuditLog()`). */
  exportTimelineCsv: () => string
  /** Export the CURRENT view state as JSON (batch BZ, iris 独有): all 9 spec
   * blocks — sort / filters / filterValues / columnVisibility / columnOrder /
   * columnWidths / pageSize / expandedKeys / query — captured by the SAME
   * collector as `persistState` (multiSortState deliberately excluded — not
   * in the spec; `importStateJson` accepts supersets). A piece appears only
   * when restorable (owning callback present; `pageSize` only with a proxy;
   * `expandedKeys` only when expandable AND restorable; `query` only when
   * set) — a bare table exports `'{}'`. Round-trips byte-identically through
   * `importStateJson`. */
  exportStateJson: () => string
  /** Apply a previously exported state JSON (batch BZ, iris 独有): parses and
   * replays every present piece through the owning change callbacks (the same
   * per-piece gating as a view apply — `query` restores FIRST via
   * `onQueryChange`, `pageSize` reproduces `onPageChange(1, size)` + exactly
   * one request, `expandedKeys` replaces the whole set via the expansion
   * model). Invalid JSON or a non-object value → `false` with NOTHING applied;
   * valid JSON applies piece-by-piece lazily and returns `true` (ineligible
   * pieces — missing callback / wrong type — are skipped). */
  importStateJson: (json: string) => boolean
  /** Compare two exported-state JSONs (batch DE, iris 独有): field-level diff text (`+` added / `-` removed / `~ changed old → new`), deterministic by sorted keys + structural deep-equal (order-independent); identical → `''`; invalid JSON → `! compareStates: invalid JSON` (never throws). Pairs with `exportStateJson`/`importStateJson` — `a` = before, `b` = after. */
  compareStates: (a: string, b: string) => string
}

/**
 * Audit-trail entry shape (batch AT, iris 独有) — mirrors the core
 * `AuditLogEntry` contract (the handle returns a snapshot of the controller
 * ring). Row-level structural changes (insert/remove) carry only `rowKey`.
 */
export interface IrisTableAuditEntry {
  /** Monotonic sequence number (never resets on clear — audit integrity). */
  seq: number
  /** Epoch ms when the entry was pushed. */
  at: number
  /** Commit kind: edit / insert / remove / paste / batch / fill / undo / redo. */
  type: 'edit' | 'insert' | 'remove' | 'paste' | 'batch' | 'fill' | 'undo' | 'redo'
  /** Key of the first changed row (undefined when none could be resolved). */
  rowKey?: string | number
  /** Column key of the first changed cell (undefined for row-level ops). */
  column?: string
  /** Value before the change. */
  oldValue?: unknown
  /** Value after the change. */
  newValue?: unknown
}

/**
 * Version-history entry shape (batch BA, iris 独有) — a LIGHTWEIGHT mirror of
 * the core `VersionHistoryEntry` WITHOUT the rows (the handle snapshot stays
 * cheap; `restoreVersion(index)` fetches the rows from the controller).
 */
export interface IrisTableVersionEntry {
  /** Monotonic version index (never resets on clear). */
  index: number
  /** Epoch ms when the version was pushed. */
  at: number
  /** Commit-kind hint: edit / insert / remove / paste / batch / fill / undo / redo. */
  type: 'edit' | 'insert' | 'remove' | 'paste' | 'batch' | 'fill' | 'undo' | 'redo'
}

/**
 * Collaborative-presence cursor entry (batch BD, iris 独有 — vxe has no
 * cursor sharing): one remote participant's cursor on a selected cell. Pure
 * display — the table renders the entry verbatim and owns no collaboration
 * state or logic. `cellKey` uses the canonical `${rowKeyVal}::${colKey}`
 * delimiter (the same as `cellId` and the `annotations` map keys).
 */
export interface IrisTablePresenceEntry {
  /** Stable participant id (also surfaced as `data-iris-presence-id`). */
  id: string
  /** Participant display name — the text of the cell's corner label. */
  name: string
  /** Cursor color, used verbatim: the cell outline + the label background. */
  color: string
  /** Target cell: `${rowKeyVal}::${colKey}` (same delimiter as `cellId`). */
  cellKey: string
}

/** Pager configuration (vxe-grid pagerConfig parity). */
