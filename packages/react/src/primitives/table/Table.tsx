import * as React from 'react'
import {
  aggregate,
  buildFormValues,
  buildHeaderMatrix,
  computeVirtualRange,
  createCellRange,
  createExpansion,
  createSelectionModel,
  flattenLeafColumns,
  flattenTree,
  mergeFormFilters,
  seedFormValues,
  withSortedChildren,
  nextGridCell,
  type CellRangeController,
  type ExpansionModel,
  type GridNavKey,
  type SelectionModel,
  type TreeRow,
} from '@iris-ui-kit/core'
import { IrisCheckbox } from '../checkbox/Checkbox'
import { IrisInput } from '../input/Input'
import { IrisSelect } from '../select/Select'
import { IrisFormField } from '../form-field/FormField'
import { IrisButton } from '../button/Button'
import { useStore } from '../../useStore'
import {
  createCellEdit,
  createRemoteTableSource,
  createSortable,
  insertRowInList,
  parseCsv,
  removeRowFromList,
  setCellValue,
  updateRowInList,
  validateEditRulesAsync,
  type RemoteTableSource,
  type RemoteTableSourceState,
  type SortableRect,
} from '@iris-ui-kit/core'
import { useI18n } from '../../i18n'
import { useDrag } from '../drag/useDrag'
import { IrisPagination } from '../pagination'
import { IrisVirtualScroll } from '../virtual-scroll/VirtualScroll'
import type { IrisTableHandle, IrisTableProps, IrisTableProxyConfig } from './props'

const TABLE_ROW_CSS = `
[data-iris-table] [role="row"]:hover {
  --iris-cell-bg: var(--iris-surface-hover);
}
[data-iris-table-row-selected="true"] {
  --iris-cell-bg: var(--iris-surface-selected);
}
[data-iris-table-context-menu] [role="menuitem"]:hover:not(:disabled) {
  background: var(--iris-surface-hover);
}
/* Lazy tree loading caret (batch J): keyframes can't be inline, so they live
   in the singleton stylesheet; opacity + spin use token-driven values. */
@keyframes iris-table-caret-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
[data-iris-table-tree-toggle][data-iris-tree-loading] {
  opacity: 0.55;
  animation: iris-table-caret-spin 900ms linear infinite;
}
@media print {
  [data-iris-table-toolbar] {
    display: none !important;
  }
  [data-iris-table-form] {
    display: none !important;
  }
  [data-iris-table][data-printable="true"] {
    border: none !important;
    box-shadow: var(--iris-shadow-none, none) !important;
  }
}
`
import { useTableSort } from './useTableSort'
import { TableContextMenu } from './ContextMenu'
import { TableFilterPanel } from './FilterPanel'
import type {
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableContextMenuParams,
  IrisTableSortDirection,
} from './types'

export type { IrisTableProps, IrisTableProxyConfig } from './props'

const RESIZE_STEP = 16
const SELECTION_COL_WIDTH = 40
const EXPAND_COL_WIDTH = 40
const DEFAULT_PINNED_WIDTH = 140

/** Shared style for the full-width empty / loading / error state rows. */
const STATE_ROW_STYLE: React.CSSProperties = {
  padding: '32px 12px',
  textAlign: 'center',
  color: 'var(--iris-muted)',
}

/** Null-proxy snapshot for useSyncExternalStore (a STABLE reference is required). */
const EMPTY_PROXY_STATE: RemoteTableSourceState<never> = {
  data: [],
  total: 0,
  loading: false,
  error: null,
  params: { page: 1, pageSize: 10, sort: null, filters: {} },
}
const noopProxySubscribe = (): (() => void) => () => {}

/**
 * Focusable resize grip at a column header's trailing edge. Pointer drag (via
 * `useDrag`) or Arrow-Left/Right adjusts the column's pixel width. `role=
 * "separator"` + `aria-orientation` follow the WAI-ARIA window-splitter pattern.
 */
function ColumnResizeHandle({
  colKey,
  label,
  width,
  minWidth,
  maxWidth,
  onResize,
}: {
  colKey: string
  label: string
  width: number | undefined
  minWidth: number
  maxWidth: number
  onResize: (key: string, width: number) => void
}): React.ReactElement {
  const ref = React.useRef<HTMLSpanElement | null>(null)
  const startRef = React.useRef(0)
  const clamp = (w: number): number => Math.max(minWidth, Math.min(maxWidth, Math.round(w)))
  // Prefer the explicit override; fall back to the rendered header width.
  const measure = (): number =>
    width ?? ref.current?.parentElement?.getBoundingClientRect().width ?? minWidth

  useDrag({
    handle: ref,
    onStart: () => {
      startRef.current = measure()
    },
    onDrag: ({ dx }) => onResize(colKey, clamp(startRef.current + dx)),
  })

  return (
    <span
      ref={ref}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label}`}
      tabIndex={0}
      data-iris-table-resize-handle=""
      data-column-key={colKey}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          e.stopPropagation()
          onResize(colKey, clamp(measure() - RESIZE_STEP))
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          e.stopPropagation()
          onResize(colKey, clamp(measure() + RESIZE_STEP))
        }
      }}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 8,
        cursor: 'col-resize',
        touchAction: 'none',
        userSelect: 'none',
      }}
    />
  )
}

function getCellValue<Row extends Record<string, unknown>>(
  row: Row,
  column: IrisTableColumn<Row>,
): unknown {
  const key = (column.dataIndex ?? column.key) as keyof Row
  return row[key]
}

/**
 * Batch I: fold the checked filter sets into the query filter map as
 * comma-joined strings (vxe filter-multiple remote serialization parity).
 * Keys with an empty checked set are left untouched.
 */
function mergeFilterValues(
  filters: Record<string, string>,
  filterValues: Record<string, string[]>,
): Record<string, string> {
  const next: Record<string, string> = { ...filters }
  for (const [key, values] of Object.entries(filterValues)) {
    if (values.length > 0) next[key] = values.join(',')
  }
  return next
}

/**
 * Data-driven table. Renders as a CSS-grid layout (no native `<table>`) so it
 * can support future virtual scroll / column resize uniformly. Wires ARIA
 * roles (`table` / `row` / `columnheader` / `cell`) for screen readers.
 *
 * Sortable columns cycle `none → asc → desc → none` on click.
 */
export function IrisTable<Row extends Record<string, unknown>>({
  columns,
  data,
  rowKey = 'id',
  selectable = 'none',
  selection: selectionProp,
  defaultSelection,
  onSelectionChange,
  sort: sortProp,
  defaultSort,
  onSortChange,
  multiSort = false,
  multiSortState: multiSortStateProp,
  defaultMultiSort,
  onMultiSortChange,
  striped = false,
  size,
  seqStartIndex = 1,
  seqMethod,
  currentRowKey,
  onCurrentRowChange,
  beforeCurrentRowChange,
  currentColumnKey,
  onCurrentColumnChange,
  beforeCurrentColumnChange,
  showHeader = true,
  footerData,
  rowClassName,
  cellClassName,
  headerCellClassName,
  footerCellClassName,
  rowStyle,
  cellStyle,
  headerCellStyle,
  footerCellStyle,
  onCellClick,
  bordered = true,
  resizableColumns = false,
  columnWidths: columnWidthsProp,
  defaultColumnWidths,
  onColumnWidthsChange,
  onRowClick,
  onCellEdit,
  tableRef,
  onDataChange,
  checkMethod,
  pagerConfig,
  editConfig,
  validConfig,
  rowDrag,
  columnDrag,
  columnVisibility,
  onColumnVisibilityChange,
  filters,
  filterValues,
  onFilterValuesChange,
  formConfig,
  toolbar,
  tooltipConfig,
  contextMenu,
  printable = false,
  seq = false,
  spanMethod,
  renderDetail,
  rowExpandable,
  defaultExpandedRowKeys,
  expandAll = false,
  onExpandedRowsChange,
  getSubRows,
  lazyLoad,
  keyboardNavigation = false,
  cellRange = false,
  checkboxRange = false,
  virtualScroll,
  columnVirtualization = false,
  emptyState,
  loading = false,
  error = false,
  loadingState,
  errorState,
  onRetry,
  proxyConfig,
  style,
  className,
  ...rest
}: IrisTableProps<Row>): React.ReactElement {
  React.useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById('iris-table-row-styles')) return
    const style = document.createElement('style')
    style.id = 'iris-table-row-styles'
    style.textContent = TABLE_ROW_CSS
    document.head.appendChild(style)
  }, [])

  const { t } = useI18n()
  // Defensive: null/undefined columns → empty array
  const safeColumns = React.useMemo(() => columns ?? [], [columns])
  // Column visibility (vxe columnConfig.visible parity): filter hidden
  // columns out of every render path (header, body, summary).
  const displayColumns = React.useMemo(() => {
    if (!columnVisibility) return safeColumns
    return safeColumns.filter((c) => columnVisibility[c.key] !== false)
  }, [safeColumns, columnVisibility])

  // Multi-level (grouped) headers: a column with `children` forms a header group. The BODY always renders the leaf columns; only the header gains extra rows.

  // When nothing is grouped, `leafColumns` is the original `safeColumns` (same
  // reference) so the flat path is byte-identical.
  const grouped = React.useMemo(
    () => safeColumns.some((c) => c.children && c.children.length > 0),
    [safeColumns],
  )
  const leafColumns = React.useMemo(
    () => (grouped ? flattenLeafColumns(displayColumns) : displayColumns),
    [grouped, displayColumns],
  )
  const headerMatrix = React.useMemo(
    () => (grouped ? buildHeaderMatrix(displayColumns) : null),
    [grouped, displayColumns],
  )

  // ── Server-side proxy (vxe-grid proxyConfig parity, query slice) ────────
  // The controller lives in a ref and is created once; the unified core data
  // engine inside it owns paging / latest-wins / dedupe. The bridge only maps
  // state → props and routes sort / filter / page events back to setParams.
  const remoteSort = proxyConfig?.remoteSort === true
  const remoteFilter = proxyConfig?.remoteFilter === true
  const proxyQueryRef = React.useRef<IrisTableProxyConfig<Row>['query'] | undefined>(undefined)
  proxyQueryRef.current = proxyConfig?.query
  const createProxySource = (): RemoteTableSource<Row> =>
    createRemoteTableSource<Row>({
      // The latest query closure is read at request time, so a parent that
      // swaps the query never leaves a stale closure behind.
      query: (params) => proxyQueryRef.current!(params),
      // Kicked from an effect below — never fire a fetch during render.
      autoLoad: false,
      initialParams: {
        page: proxyConfig?.defaultPage ?? 1,
        pageSize: proxyConfig?.pageSize ?? 10,
        sort: remoteSort ? ((sortProp !== undefined ? sortProp : defaultSort) ?? null) : null,
        sorts: remoteSort && multiSort ? (multiSortStateProp ?? defaultMultiSort ?? []) : undefined,
        filters: remoteFilter ? mergeFilterValues(filters ?? {}, filterValues ?? {}) : {},
      },
    })
  const proxyRef = React.useRef<RemoteTableSource<Row> | null>(null)
  if (proxyConfig && proxyRef.current === null) {
    proxyRef.current = createProxySource()
  }
  // A proxyConfig-less render never exposes a (possibly destroyed) stale
  // controller: rows/loading/pager all fall back to the null proxy.
  const proxy = proxyConfig ? proxyRef.current : null
  const proxyState = React.useSyncExternalStore(
    proxy ? proxy.subscribe : noopProxySubscribe,
    proxy ? proxy.getState : ((() => EMPTY_PROXY_STATE) as () => RemoteTableSourceState<Row>),
    proxy ? proxy.getState : ((() => EMPTY_PROXY_STATE) as () => RemoteTableSourceState<Row>),
  )
  // Proxy mode drives the table's loading/error UI from the controller state
  // (reusing the existing loading/error props rendering below).
  const tableLoading = proxy ? proxyState.loading : loading
  const tableError = proxy ? proxyState.error !== null : error
  const handleRetry = React.useCallback(() => {
    void proxyRef.current?.refetch()
    onRetry?.()
  }, [onRetry])
  const retry = proxy ? handleRetry : onRetry

  // autoLoad parity: kick the first request from an effect (never during the
  // render phase); tear the controller down when the proxy is removed or the
  // table unmounts so a late response never writes back to a dead instance.
  // Keyed on proxy PRESENCE (not identity): a proxyConfig that arrives after
  // the first render still auto-loads + registers cleanup, and an inline-object
  // proxyConfig doesn't destroy/recreate the controller on every render. If a
  // previous cleanup tore the controller down (removal / StrictMode remount),
  // recreate it here and force a re-render so useSyncExternalStore subscribes
  // to the fresh instance.
  const [, forceRender] = React.useReducer((x: number) => x + 1, 0)
  const hasProxy = proxyConfig !== undefined
  React.useEffect(() => {
    let ctrl = proxyRef.current
    if (!ctrl && hasProxy) {
      ctrl = createProxySource()
      proxyRef.current = ctrl
      forceRender()
    }
    if (ctrl && proxyConfig?.autoLoad !== false) void ctrl.request()
    return () => {
      if (proxyRef.current === ctrl) proxyRef.current = null
      ctrl?.destroy()
    }
  }, [hasProxy])

  // Editable write-back (vxe-grid parity): the table owns a live copy of the
  // data so committed edits survive WITHOUT the parent re-feeding `data`.
  // External `data` reference changes still win (controlled mode); in proxy
  // mode the source of truth is the proxy's loaded page — liveData holds
  // local edit write-backs until the next refetch replaces them.
  const [liveData, setLiveData] = React.useState<Row[]>(data ?? [])
  const externalDataRef = React.useRef(data)
  // Reference of the LAST data the parent actually fed us (updated only by
  // this effect). Internal write-backs (edit commit / row ops) update
  // `externalDataRef` but NOT this, so the effect can distinguish "parent fed
  // new data" from "we mutated our own live copy" and never clobber edits.
  const lastExternalRef = React.useRef(data)
  React.useEffect(() => {
    const next = proxy ? proxyState.data : data
    if (next !== lastExternalRef.current) {
      lastExternalRef.current = next
      externalDataRef.current = next
      setLiveData(next ?? [])
    }
  }, [proxy, proxyState, data])

  // Sort state managed by useTableSort hook (controlled/uncontrolled, comparator, sorted data).
  const {
    sortState: sort,
    cycleSort,
    sortComparator,
    sortedData: localSortedData,
    multiSortState,
    cycleMultiSort,
    multiSortComparator,
  } = useTableSort<Row>(liveData, {
    leafColumns,
    sort: sortProp,
    defaultSort,
    onSortChange: (next) => {
      onSortChange?.(next)
      // remoteSort parity: sort changes re-query the server (page resets to 1
      // in the core controller, vxe behavior).
      if (remoteSort) proxyRef.current?.setParams({ sort: next })
    },
    multiSort,
    multiSortState: multiSortStateProp,
    defaultMultiSort,
    onMultiSortChange: (next) => {
      onMultiSortChange?.(next)
      // remoteSort parity (multi mode): the FULL sort list re-queries the
      // server; the single `sort` param stays the single-column channel.
      if (remoteSort) proxyRef.current?.setParams({ sorts: next })
    },
  })
  // remoteSort parity: the server owns the ordering — never re-sort locally.
  const sortedData = remoteSort ? liveData : localSortedData

  // remoteSort parity: hand the sort state to the server. Header clicks are
  // pushed via the onSortChange wrapper above; this effect covers controlled
  // `sort` prop updates from the parent (core setParams dedupes unchanged
  // params, so the click path does not double-request). In multiSort mode the
  // single-column channel is inert — the multi effect below owns the sync.
  React.useEffect(() => {
    if (!proxy || !remoteSort || multiSort) return
    proxyRef.current?.setParams({ sort: sort ?? null })
  }, [proxy, remoteSort, sort, multiSort])

  // remoteSort parity (multi mode): hand the full sort list to the server,
  // keyed on click order. The header-click path pushes via the
  // onMultiSortChange wrapper; this effect covers controlled `multiSortState`
  // prop updates from the parent (core setParams dedupes unchanged sorts, so
  // neither path double-requests).
  React.useEffect(() => {
    if (!proxy || !remoteSort || !multiSort) return
    proxyRef.current?.setParams({ sorts: multiSortState })
  }, [proxy, remoteSort, multiSort, multiSortState])

  // ── Search form (vxe-grid formConfig parity, batch D) ──────────────────
  // Draft/applied two-state: keystrokes only touch the DRAFT (never trigger a
  // query); submit/reset promote the built values into the APPLIED filters.
  // The draft is seeded from field defaultValue and re-seeded only when the
  // field set (or a default) actually changes, so an inline formConfig object
  // with a fresh identity each render never wipes user input.
  const [formDraft, setFormDraft] = React.useState<Record<string, string>>(() =>
    seedFormValues(formConfig?.fields),
  )
  const [formApplied, setFormApplied] = React.useState<Record<string, string>>({})
  const formFieldSignature = (formConfig?.fields ?? [])
    .map((f) => `${f.key}=${f.defaultValue ?? ''}`)
    .join('\u0000')
  React.useEffect(() => {
    setFormDraft(seedFormValues(formConfig?.fields))
    setFormApplied({})
    // Keyed on the field signature only — inline formConfig objects with a
    // fresh identity per render must not re-seed (nor wipe user input).
  }, [formFieldSignature])
  const setFormValue = (key: string, value: string): void => {
    setFormDraft((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }))
  }
  // Batch I: the proxy receives the text filters PLUS the comma-joined checked
  // filter sets, merged into ONE map (vxe filter-multiple remote serialization).
  const mergedProxyFilters = (form: Record<string, string>): Record<string, string> =>
    mergeFilterValues(mergeFormFilters(filters ?? {}, form), filterValues ?? {})
  const handleFormSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    const values = buildFormValues(formConfig?.fields, formDraft)
    formConfig?.onSearch?.(values)
    setFormApplied(values)
    // Proxy mode: the server owns filtering — merge the form values into the
    // controller filters (page resets to 1 in core applyParams, vxe behavior).
    if (proxy) {
      proxyRef.current?.setParams({ filters: mergedProxyFilters(values), page: 1 })
    }
  }
  const handleFormReset = (e: React.FormEvent): void => {
    e.preventDefault()
    const defaults = seedFormValues(formConfig?.fields)
    setFormDraft(defaults)
    const values = buildFormValues(formConfig?.fields, defaults)
    setFormApplied(values)
    formConfig?.onReset?.(values)
    if (proxy) {
      // setParams returns false when the merged params are unchanged (e.g.
      // filters already cleared) — a reset must still re-query, so force a
      // refetch only in that no-op case (no double request when it changed).
      if (
        proxyRef.current?.setParams({
          filters: mergedProxyFilters(values),
          page: 1,
        }) === false
      ) {
        proxyRef.current?.refetch()
      }
    }
  }

  // remoteFilter parity: hand the filter map to the server and never hide
  // rows client-side (vxe proxyConfig.filter). Form values are merged in so a
  // later `filters` prop change from the parent does not silently drop the
  // applied search (the draft would still show it). The effect lives after
  // the form state declarations (formApplied is referenced in the deps).
  React.useEffect(() => {
    if (!proxy || !remoteFilter) return
    proxyRef.current?.setParams({ filters: mergedProxyFilters(formApplied) })
  }, [proxy, remoteFilter, filters, filterValues, formApplied])

  // Row-selection logic (single/multiple toggle, dedup, select-all,
  // controlled/uncontrolled) is single-sourced in the core model; keys are the
  // string|number row keys. The sort / edit / resize / virtual logic below is
  // untouched. Mode is fixed at creation from `selectable` (as ToggleGroup
  // fixes its mode from `type`).
  const selControlled = selectionProp !== undefined
  const selModelRef = React.useRef<SelectionModel<string | number> | null>(null)
  if (selModelRef.current === null) {
    selModelRef.current = createSelectionModel<string | number>({
      mode: selectable === 'single' ? 'single' : 'multiple',
      defaultSelected: selControlled
        ? (selectionProp as Array<string | number>)
        : (defaultSelection ?? []),
      onChange: (next) => onSelectionChange?.(next),
    })
  }
  const selModel = selModelRef.current
  const selection = useStore(selModel.store)

  // Controlled: mirror the prop into the model without re-emitting onChange.
  React.useEffect(() => {
    if (selControlled) selModel.sync(selectionProp as Array<string | number>)
  }, [selectionProp, selControlled, selModel])

  // Controlled tables RENDER from the prop (true controlled semantics): a local
  // toggle emits onSelectionChange, but the displayed selection only changes when
  // the parent writes `selection` back — so a parent that validates/rejects a
  // change no longer sees the row flip optimistically. Uncontrolled renders from
  // the model store as before.
  const displaySelection = selControlled ? (selectionProp as Array<string | number>) : selection
  // Handle methods run against the MOUNT-time closure (tableRef is assigned once), so
  // a selection snapshot would go stale — mirror the latest value for them instead.
  const displaySelectionRef = React.useRef(displaySelection)
  displaySelectionRef.current = displaySelection
  // Re-base the model on the controlled prop before a toggle so the emitted next
  // value is computed against what the parent actually holds (not a prior,
  // possibly-rejected, optimistic value).
  const rebaseToProp = (): void => {
    if (selControlled) selModel.sync(selectionProp as Array<string | number>)
  }

  // Checkbox range-selection anchor (vxe checkboxConfig isShiftKey parity,
  // batch G): the row key of the last clicked row checkbox. Shift-click toggles
  // every checkMethod-eligible row between the anchor and the target (in
  // bodyData order); a plain click just moves the anchor. The header
  // select-all resets it.
  const checkboxAnchorRef = React.useRef<string | number | null>(null)

  // Expandable detail rows: a leading toggle column + a full-width detail panel,
  // driven by the framework-agnostic createExpansion (multiple-open).
  const hasDetail = renderDetail !== undefined
  const expansionRef = React.useRef<ExpansionModel | null>(null)
  if (expansionRef.current === null) {
    expansionRef.current = createExpansion({
      mode: 'multiple',
      defaultExpanded: (defaultExpandedRowKeys ?? []).map(String),
      onChange: (keys) => onExpandedRowsChange?.(keys),
    })
  }
  const expansion = expansionRef.current
  const expandedKeys = useStore(expansion.store)
  const isRowExpandable = (row: Row, idx: number): boolean =>
    hasDetail && (rowExpandable ? rowExpandable(row, idx) : true)

  const widthsControlled = columnWidthsProp !== undefined
  const [widthsInternal, setWidthsInternal] = React.useState<IrisTableColumnWidths>(
    defaultColumnWidths ?? {},
  )
  const columnWidths = widthsControlled
    ? (columnWidthsProp as IrisTableColumnWidths)
    : widthsInternal
  const setColumnWidth = (key: string, width: number) => {
    const next = { ...columnWidths, [key]: width }
    if (!widthsControlled) setWidthsInternal(next)
    onColumnWidthsChange?.(next)
  }

  // Inline editing: one cell at a time, keyed by `${rowKey}::${colKey}`. The
  // whole draft/validate/coerce session lives in the framework-agnostic
  // createCellEdit controller (core); the adapter only bridges the editor
  // element and resolves the row/column context for the session callbacks.
  // Both the text/number <input> and the select editor focus through this ref
  // (callback refs because a single union-typed ref can't bind to both tags).
  const editorRef = React.useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(
    null,
  )
  const setEditorRef = (
    el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null,
  ): void => {
    editorRef.current = el
  }
  const onCellEditRef = React.useRef(onCellEdit)
  onCellEditRef.current = onCellEdit
  const editCtxRef = React.useRef<{ row: Row; col: IrisTableColumn<Row>; rowIndex: number } | null>(
    null,
  )
  const cellId = (rowIdent: string | number, colKey: string): string => `${rowIdent}::${colKey}`
  const coerceValue = (col: IrisTableColumn<Row>, draft: unknown): unknown => {
    // Select editors commit the option's TYPED value (vxe edit-render parity):
    // a number option commits a number, a string option a string. Drafts that
    // already carry the typed form (select onChange stores it) pass through;
    // string drafts (e.g. the initial seed) resolve against editOptions by
    // String(value) so validation and commit see the typed value.
    if (col.editor === 'select') {
      if (!col.editOptions) return String(draft)
      if (typeof draft !== 'string') return draft
      const opt = col.editOptions.find((o) => String(o.value) === draft)
      return opt ? opt.value : draft
    }
    const s = String(draft)
    if (col.editor !== 'number') return s
    return s === '' || Number.isNaN(Number(s))
      ? getCellValue(editCtxRef.current!.row, col)
      : Number(s)
  }
  const cellEdit = React.useMemo(
    () =>
      createCellEdit({
        validate: (draft, _target) => {
          const ctx = editCtxRef.current
          if (!ctx) return null
          // Declarative editRules run async (they may contain async validators);
          // the legacy validate callback stays synchronous for the sync commit
          // path.
          if (ctx.col.editRules && ctx.col.editRules.length > 0) {
            return validateEditRulesAsync(ctx.col.editRules, draft, ctx.row).then((r) =>
              r.valid ? null : (r.messages[0] ?? null),
            )
          }
          if (ctx.col.validate) {
            return ctx.col.validate(coerceValue(ctx.col, draft), ctx.row) ?? null
          }
          return null
        },
        coerce: (draft, _target) => {
          const ctx = editCtxRef.current
          return ctx ? coerceValue(ctx.col, draft) : draft
        },
        onCommit: (_target, value) => {
          const ctx = editCtxRef.current
          if (!ctx) return
          const oldValue = getCellValue(ctx.row, ctx.col)
          if (value !== oldValue) {
            // Write the committed value back into the live data so the edit
            // survives without the parent re-feeding `data` (controlled mode
            // overrides via the data-reference sync above).
            const k = rowKeyOf(ctx.row)
            if (k != null) {
              setLiveData((prev) => {
                const next = setCellValue(prev, rowKey, k, ctx.col.key, value)
                externalDataRef.current = next
                return next
              })
            }
            onCellEditRef.current?.({
              row: ctx.row,
              column: ctx.col,
              oldValue,
              newValue: value,
              rowIndex: ctx.rowIndex,
            })
          }
        },
      }),
    [],
  )
  const editTarget = useStore(cellEdit.store)
  const editingTarget = editTarget.editing
  // ── Row drag-sort (composed over core createSortable) ──────────────────
  // One controller + container-level pointer handling; each row renders a
  // drag handle that seeds the press. Drop targets are collected on first
  // movement past the threshold (rects are captured once, then reused).
  const rowDragCtrl = React.useMemo(() => createSortable(), [])
  // ── Column drag-sort (composed over core createSortable) ────────────────
  const colDragCtrl = React.useMemo(() => createSortable(), [])
  const colDragState = useStore(colDragCtrl)
  const colRectsRef = React.useRef<SortableRect[]>([])
  const colDragActive = colDragState.activeId
  const colDragOver = colDragState.overId

  const handleColDragPointerDown = (e: React.PointerEvent, colKey: string) => {
    if (!columnDrag || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    colDragCtrl.press(colKey, e.clientX, e.clientY)
  }

  const handleColDragPointerMove = (e: React.PointerEvent) => {
    if (!columnDrag) return
    if (colDragCtrl.isPending()) {
      const started = colDragCtrl.tryStart(e.clientX, e.clientY)
      if (started) {
        const rects: SortableRect[] = []
        rootRef.current?.querySelectorAll('[data-iris-table-header]').forEach((el) => {
          const r = (el as HTMLElement).getBoundingClientRect()
          const id = (el as HTMLElement).getAttribute('data-iris-table-header')
          if (id) rects.push({ id, left: r.left, top: r.top, width: r.width, height: r.height })
        })
        colRectsRef.current = rects
      }
    }
    if (colDragCtrl.getState().activeId !== null) {
      colDragCtrl.moveOver({ x: e.clientX, y: e.clientY }, colRectsRef.current)
    }
  }

  const handleColDragPointerUp = () => {
    if (!columnDrag) return
    if (colDragCtrl.isPending()) {
      colDragCtrl.cancel()
      return
    }
    const { activeId, overId } = colDragCtrl.end()
    if (activeId !== null && overId !== null && activeId !== overId) {
      const next = [...leafColumns]
      const from = next.findIndex((c) => c.key === activeId)
      const to = next.findIndex((c) => c.key === overId)
      if (from >= 0 && to >= 0 && from !== to) {
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        columnDrag.onReorder(next as IrisTableColumn<Row>[])
      }
    }
    colRectsRef.current = []
  }
  const rowDragState = useStore(rowDragCtrl)
  const rowRectsRef = React.useRef<SortableRect[]>([])
  const spanOccupyRef = React.useRef<Set<string>>(new Set())
  const [columnSettingsOpen, setColumnSettingsOpen] = React.useState(false)
  const importFileRef = React.useRef<HTMLInputElement | null>(null)
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !toolbar?.onImport) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const parsed = parseCsv(text)
      if (parsed.length < 2) return
      const [header, ...body] = parsed
      const rows = body.map((cells: string[]) =>
        Object.fromEntries(header.map((h: string, i: number) => [h, cells[i] ?? ''])),
      )
      toolbar.onImport?.(rows)
    }
    reader.readAsText(file)
    e.target.value = ''
  }
  const toggleColumnVisibility = (key: string) => {
    const next = { ...(columnVisibility ?? {}) }
    next[key] = !(columnVisibility?.[key] !== false)
    onColumnVisibilityChange?.(next)
  }
  const rowDragActiveId = rowDragState.activeId
  const rowDragOverId = rowDragState.overId

  const handleRowDragPointerDown = (e: React.PointerEvent, rowId: string) => {
    if (!rowDrag || e.button !== 0) return
    e.preventDefault()
    rowDragCtrl.press(rowId, e.clientX, e.clientY)
  }

  const handleRowDragPointerMove = (e: React.PointerEvent) => {
    if (!rowDrag) return
    if (rowDragCtrl.isPending()) {
      const started = rowDragCtrl.tryStart(e.clientX, e.clientY)
      if (started) {
        const rects: SortableRect[] = []
        rootRef.current?.querySelectorAll('[data-iris-table-row]').forEach((el) => {
          const r = (el as HTMLElement).getBoundingClientRect()
          const id = (el as HTMLElement).getAttribute('data-iris-table-row')
          if (id) rects.push({ id, left: r.left, top: r.top, width: r.width, height: r.height })
        })
        rowRectsRef.current = rects
      }
    }
    if (rowDragCtrl.getState().activeId !== null) {
      rowDragCtrl.moveOver({ x: e.clientX, y: e.clientY }, rowRectsRef.current)
    }
  }

  const handleRowDragPointerUp = () => {
    if (!rowDrag) return
    if (rowDragCtrl.isPending()) {
      rowDragCtrl.cancel()
      return
    }
    const { activeId, overId } = rowDragCtrl.end()
    if (activeId !== null && overId !== null && activeId !== overId) {
      const rows = [...bodyData] as Row[]
      const from = rows.findIndex((r) => String(rowKeyOf(r)) === activeId)
      const to = rows.findIndex((r) => String(rowKeyOf(r)) === overId)
      if (from >= 0 && to >= 0 && from !== to) {
        const [moved] = rows.splice(from, 1)
        rows.splice(to, 0, moved)
        rowDrag.onReorder(rows)
      }
    }
    rowRectsRef.current = []
  }

  const handleRowDragPointerLeave = () => {
    if (rowDrag && rowDragCtrl.getState().activeId !== null) {
      rowDragCtrl.cancel()
    }
  }

  React.useEffect(() => {
    if (editingTarget !== null) editorRef.current?.focus()
  }, [editingTarget])

  // ── Right-click context menu (vxe contextMenu parity, batch H) ────────
  // Transient state: items + params are computed ONCE per open from the
  // callback; the cursor coordinates live in a virtual floating anchor (a fake
  // element whose getBoundingClientRect returns the zero-size cursor rect).
  // Cross-page note: the selection model is created once in a ref and the
  // proxy page change only calls setLiveData — nothing resets displaySelection,
  // so selections survive page flips (vxe reserve semantics is our default;
  // covered by the cross-page test in context-menu-select.test.tsx).
  const [contextMenuState, setContextMenuState] = React.useState<{
    open: boolean
    items: Array<{ key: string; label: string; disabled?: boolean }>
    params: IrisTableContextMenuParams<Row>
  } | null>(null)
  const contextAnchorRef = React.useRef<HTMLElement | null>(null)
  // Remount token: useFloating's autoUpdate does not re-run when `open` stays
  // true (a second right-click while the menu is open), so a fresh key forces
  // the menu to recompute at the new cursor coordinates.
  const [contextMenuSeq, setContextMenuSeq] = React.useState(0)
  const closeContextMenu = React.useCallback(() => {
    setContextMenuState((prev) => (prev ? { ...prev, open: false } : prev))
  }, [])
  // ── Header filter panel (vxe filterConfig parity, batch I) ─────────────
  // One panel at a time, keyed by the column whose trigger was clicked. The
  // anchor is the trigger BUTTON itself (a real DOM node), captured at click
  // time; the seq token remounts the panel per open so its draft checkbox
  // state always re-seeds from the applied `filterValues`.
  const [filterPanelState, setFilterPanelState] = React.useState<{
    open: boolean
    colKey: string
  } | null>(null)
  const filterAnchorRef = React.useRef<HTMLButtonElement | null>(null)
  const [filterPanelSeq, setFilterPanelSeq] = React.useState(0)
  const closeFilterPanel = React.useCallback(() => {
    setFilterPanelState((prev) => (prev ? { ...prev, open: false } : prev))
  }, [])
  const openFilterPanel = (e: React.MouseEvent<HTMLButtonElement>, colKey: string): void => {
    // Never let the trigger click reach the header cell (which would sort).
    e.stopPropagation()
    filterAnchorRef.current = e.currentTarget
    setFilterPanelState({ open: true, colKey })
    setFilterPanelSeq((s) => s + 1)
  }
  const applyFilterValues = (colKey: string, values: string[]): void => {
    onFilterValuesChange?.({ ...(filterValues ?? {}), [colKey]: values })
  }
  const clearFilterValues = (colKey: string): void => {
    const next = { ...(filterValues ?? {}) }
    delete next[colKey]
    onFilterValuesChange?.(next)
  }
  const handleContextMenu = (
    e: React.MouseEvent,
    row: Row,
    col: IrisTableColumn<Row>,
    idx: number,
    ci: number,
  ): void => {
    if (!contextMenu) return
    e.preventDefault()
    // Virtual anchor: zero-size rect at the cursor. The object is rebuilt per
    // open (capturing this event's coordinates) and read by useFloating after
    // the state update commits, so the panel always lands at the cursor.
    contextAnchorRef.current = {
      getBoundingClientRect: () => ({
        left: e.clientX,
        top: e.clientY,
        right: e.clientX,
        bottom: e.clientY,
        width: 0,
        height: 0,
        x: e.clientX,
        y: e.clientY,
        toJSON() {},
      }),
    } as unknown as HTMLElement
    const params: IrisTableContextMenuParams<Row> = {
      row,
      column: col,
      rowIndex: idx,
      columnIndex: ci,
    }
    setContextMenuState({ open: true, items: contextMenu.items(params), params })
    setContextMenuSeq((s) => s + 1)
  }

  const beginEdit = (
    row: Row,
    col: IrisTableColumn<Row>,
    rowIdent: string | number,
    rowIndex: number,
  ) => {
    if (!col.editable) return
    editCtxRef.current = { row, col, rowIndex }
    const current = getCellValue(row, col)
    cellEdit.startEdit(cellId(rowIdent, col.key), col.key, current == null ? '' : String(current))
  }
  const cancelEdit = () => {
    cellEdit.cancelEdit()
  }
  const commitEdit = (): boolean => {
    return cellEdit.commitEdit()
  }

  // Tab edit navigation (vxe editConfig parity, batch J): Tab commits the
  // current cell and opens the NEXT editable column of the same row, Shift+Tab
  // the previous one (`leafColumns` render order). A validation failure keeps
  // the cell (commit returns false). With no editable neighbor the edit is
  // committed and the default Tab behavior moves focus away (no preventDefault).
  const moveEditOnTab = (e: React.KeyboardEvent, dir: 1 | -1): void => {
    if (e.key !== 'Tab') return
    const ctx = editCtxRef.current
    if (!ctx) return
    if (!commitEdit()) {
      e.preventDefault()
      return
    }
    const start = leafColumns.indexOf(ctx.col)
    for (let i = start + dir; i >= 0 && i < leafColumns.length; i += dir) {
      const nextCol = leafColumns[i]!
      if (!nextCol.editable) continue
      e.preventDefault()
      beginEdit(ctx.row, nextCol, rowKeyOf(ctx.row), ctx.rowIndex)
      return
    }
  }

  const onHeaderKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, col: IrisTableColumn<Row>) => {
    if (!col.sortable) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (multiSort) cycleMultiSort(col)
      else cycleSort(col)
    }
  }

  // Sortable header click: multi mode appends/cycles the list, single mode
  // keeps the asc → desc → none cycle — both routed through one entry point.
  const cycleHeaderSort = (col: IrisTableColumn<Row>) => {
    if (multiSort) cycleMultiSort(col)
    else cycleSort(col)
  }

  const rowKeyOf = (row: Row): string | number => {
    return (row as Record<string, unknown>)[rowKey] as string | number
  }

  /**
   * Unified cell click: preserves the internal edit/range behavior, then fires
   * the user `onCellClick` (vxe cell-click parity) with full coordinates.
   */
  const handleCellClick = (
    e: React.MouseEvent,
    row: Row,
    col: IrisTableColumn<Row>,
    k: string | number | undefined,
    idx: number,
    ci: number,
  ): void => {
    if (cellRange) {
      if (e.shiftKey) cellRangeCtrl.extendRange(idx, ci)
      else cellRangeCtrl.startRange(idx, ci)
    } else if (col.editable && editConfig?.trigger === 'click' && k != null) {
      beginEdit(row, col, k, idx)
    }
    onCellClick?.({ row, column: col, rowIndex: idx, columnIndex: ci })
  }

  const setCurrentColumn = (col: IrisTableColumn<Row>): void => {
    if (onCurrentColumnChange && beforeCurrentColumnChange?.(col.key) !== false) {
      onCurrentColumnChange(col.key)
    }
  }

  // Single mode toggles off / replaces, multiple toggles inclusion — both are
  // the model's `toggle` semantics for the row's key.
  // ── Imperative row ops (vxe-grid insert/remove/setRow parity, batch E) ──
  const onDataChangeRef = React.useRef(onDataChange)
  onDataChangeRef.current = onDataChange
  const commitRowList = React.useCallback((next: Row[]) => {
    setLiveData(next)
    externalDataRef.current = next
    onDataChangeRef.current?.(next)
  }, [])
  const handleRef = React.useRef<IrisTableHandle<Row> | null>(null)
  handleRef.current = {
    insertRow: (row, index) => {
      commitRowList(insertRowInList(externalDataRef.current ?? [], rowKey, row, index))
    },
    removeRow: (key) => {
      const rows = externalDataRef.current ?? []
      const next = removeRowFromList(rows, rowKey, key)
      if (next !== rows) {
        if (displaySelectionRef.current.includes(key)) {
          rebaseToProp()
          selModel.toggle(key)
        }
        commitRowList(next)
      }
    },
    removeRows: (keys) => {
      // Batch remove (vxe removeRows parity, batch J): compose the core helper
      // per key, skipping missing ones; prune the selection of the keys that
      // were ACTUALLY removed; commit + onDataChange exactly once.
      let rows = externalDataRef.current ?? []
      const removed = new Set<string | number>()
      for (const key of keys) {
        const next = removeRowFromList(rows, rowKey, key)
        if (next !== rows) {
          removed.add(key)
          rows = next
        }
      }
      if (removed.size === 0) return
      const selectedNow = displaySelectionRef.current
      if (selectable !== 'none' && selectedNow.some((k) => removed.has(k))) {
        rebaseToProp()
        for (const key of removed) {
          if (selectedNow.includes(key)) selModel.toggle(key)
        }
      }
      commitRowList(rows)
    },
    updateRow: (key, patch) => {
      commitRowList(updateRowInList(externalDataRef.current ?? [], rowKey, key, patch))
    },
    refetch: () => {
      proxyRef.current?.refetch()
    },
    // ── Selection methods (vxe clearCheckboxRow / setAllCheckboxRow(true) /
    // toggleCheckboxRow parity, batch F) ───────────────────────────────────
    clearSelection: () => {
      if (selectable === 'none') return
      rebaseToProp()
      selModel.clear()
    },
    selectAll: () => {
      if (selectable !== 'multi') return
      rebaseToProp()
      // vxe setAllCheckboxRow(true): select every checkMethod-eligible row of
      // the current page (checkMethod rows are skipped, vxe parity) — UNIONED
      // with the existing selection, so rows selected on an earlier proxy page
      // (or a prior toggle) are kept instead of replaced.
      const keys = bodyData
        .map((row, i) => (checkMethod && !checkMethod(row, i) ? null : rowKeyOf(row)))
        .filter((k): k is string | number => k != null)
      const existing = new Set(displaySelection)
      selModel.set([...displaySelection, ...keys.filter((k) => !existing.has(k))])
    },
    toggleRowSelection: (key) => {
      if (selectable === 'none') return
      rebaseToProp()
      // vxe toggleCheckboxRow: a DIRECT toggle by key — bypasses checkMethod.
      selModel.toggle(key)
    },
  }
  React.useEffect(() => {
    if (tableRef) tableRef.current = handleRef.current
    return () => {
      if (tableRef) tableRef.current = null
    }
  }, [tableRef])

  const toggleRow = (row: Row, idx?: number) => {
    if (selectable === 'none') return
    if (idx != null && checkMethod && !checkMethod(row, idx)) return
    rebaseToProp()
    selModel.toggle(rowKeyOf(row))
  }

  /**
   * Shift-click checkbox range (vxe checkboxConfig isShiftKey parity): toggle
   * every checkMethod-eligible row between the anchor and the target in
   * bodyData order. An unknown anchor (e.g. the anchor row left the page in
   * proxy mode) degrades to a single toggle of the target. Updates go through
   * the model's per-key `toggle` (batch: one rebase against the controlled
   * prop, then the toggles).
   */
  const toggleRowRange = (anchorKey: string | number, targetKey: string | number) => {
    if (selectable !== 'multi') return
    const anchorIdx = bodyData.findIndex((r) => rowKeyOf(r) === anchorKey)
    const targetIdx = bodyData.findIndex((r) => rowKeyOf(r) === targetKey)
    if (anchorIdx < 0 || targetIdx < 0) {
      // Unknown anchor: fall back to a plain single toggle of the target
      // (checkMethod still respected — a disabled row cannot be range-toggled).
      if (targetIdx < 0 || (checkMethod && !checkMethod(bodyData[targetIdx]!, targetIdx))) return
      rebaseToProp()
      selModel.toggle(targetKey)
      return
    }
    const from = Math.min(anchorIdx, targetIdx)
    const to = Math.max(anchorIdx, targetIdx)
    const keys: Array<string | number> = []
    for (let i = from; i <= to; i += 1) {
      const row = bodyData[i]!
      if (checkMethod && !checkMethod(row, i)) continue
      keys.push(rowKeyOf(row))
    }
    if (keys.length === 0) return
    rebaseToProp()
    for (const key of keys) selModel.toggle(key)
  }

  // Tree mode (opt-in via getSubRows): flatten the data into the visible rows
  // honoring the (shared) expansion model. `bodyData` is the row list the body,
  // selection, and summary all operate on — identical to `sortedData` in flat
  // mode, so non-tree behavior is unchanged.
  const treeMode = getSubRows !== undefined
  // Lazy tree (vxe lazyLoad parity, batch J): children are fetched on first
  // expand. The loaded map lives in a ref (read by `getChildren`, which wins
  // over `getSubRows`); the loading SET is React state because it drives the
  // caret render (spinner) on both transitions.
  const lazyChildrenRef = React.useRef<Map<string, Row[]>>(new Map())
  const [lazyLoading, setLazyLoading] = React.useState<Set<string>>(new Set())
  const lazyChildrenOf = (row: Row): readonly Row[] | undefined =>
    lazyChildrenRef.current.get(String(rowKeyOf(row))) ?? getSubRows!(row)
  // Comparator for tree siblings: multi mode uses the chained multi comparator
  // (batch G fix), single mode keeps its own — byte-identical to before.
  const treeComparator = React.useMemo(
    () => (multiSort ? multiSortComparator : sortComparator),
    [multiSort, multiSortComparator, sortComparator],
  )
  const flatTree = React.useMemo<Array<TreeRow<Row>> | null>(
    () =>
      treeMode
        ? flattenTree<Row>(sortedData, {
            getKey: (r) => String(rowKeyOf(r)),
            // With an active sort, sort each level's children by the same
            // comparator so the whole tree reorders hierarchically (multi mode
            // passes the chained multi comparator so child ties resolve by the
            // secondary columns too). Lazy-loaded children win over `getSubRows`
            // and still participate in the same sorting.
            getChildren: treeComparator
              ? withSortedChildren(lazyChildrenOf, treeComparator)
              : lazyChildrenOf,
            isExpanded: (k) => expandedKeys.includes(k),
          })
        : null,
    // Recompute on data / expansion / accessor / sort change (rowKeyOf reads `rowKey`).
    [treeMode, sortedData, getSubRows, expandedKeys, rowKey, treeComparator, lazyLoading],
  )
  // Client-side filters (vxe filterConfig parity, local mode): core filterSort
  // applied to the sorted data before paging/virtualizing (flat mode). With
  // remoteFilter, the server owns filtering — rows are never hidden locally.
  // The search form's applied values merge over the `filters` prop (form wins,
  // neither input is mutated); in proxy mode the server owns form filtering,
  // so only the prop map filters the loaded page (batch C behavior preserved).
  const filteredData = React.useMemo(() => {
    if (remoteFilter) return sortedData
    const merged: Record<string, string> = proxy
      ? (filters ?? {})
      : mergeFormFilters(filters ?? {}, formApplied)
    const active = Object.entries(merged).filter(([, v]) => v != null && v !== '')
    // Batch I: per-column checked sets OR-match the raw String(value); a set
    // applies only when non-empty. AND-ed with the text channel below.
    const checkedEntries = Object.entries(filterValues ?? {}).filter(
      ([, values]) => values.length > 0,
    )
    if (active.length === 0 && checkedEntries.length === 0) return sortedData
    return sortedData.filter((row) => {
      const textOk = active.every(([key, value]) => {
        const col = displayColumns.find((c) => c.key === key)
        if (!col) return true
        const raw = getCellValue(row, col)
        if (col.filterMethod) return col.filterMethod(raw, row, value)
        return String(raw ?? '')
          .toLowerCase()
          .includes(value.toLowerCase())
      })
      const setsOk = checkedEntries.every(([key, values]) => {
        const col = displayColumns.find((c) => c.key === key)
        if (!col) return true
        return values.includes(String(getCellValue(row, col) ?? ''))
      })
      return textOk && setsOk
    })
  }, [sortedData, filters, formApplied, displayColumns, remoteFilter, proxy, filterValues])
  const bodyData = flatTree ? flatTree.map((t) => t.row) : filteredData

  // expandAll parity (vxe expand-config.expandAll — one-shot at init): seed the
  // expansion model with every tree key that HAS children, walked from the top
  // of `sortedData` (not the flattened rows — the flat tree is DERIVED from the
  // expansion model, so flattening first is chicken/egg). Proxy data arrives
  // async, so the seed waits for the first non-empty page; the ref keeps it
  // initial-only (a later prop toggle does not re-seed).
  const expandAllSeededRef = React.useRef(false)
  React.useEffect(() => {
    if (!expandAll || !treeMode || expandAllSeededRef.current) return
    if (sortedData.length === 0) return
    const keys: string[] = []
    const collect = (rows: Row[]): void => {
      for (const row of rows) {
        const children = getSubRows!(row)
        if (children && children.length > 0) {
          keys.push(String((row as Record<string, unknown>)[rowKey] as string | number))
          collect(children)
        }
      }
    }
    collect(sortedData)
    // Burn the one-shot only when there was something to seed: a proxy page
    // without parent rows (e.g. the first page of a paged tree) must not
    // consume the seed — a later page that does contain parents still seeds.
    if (keys.length === 0) return
    expandAllSeededRef.current = true
    expansion.merge(keys)
  }, [expandAll, treeMode, sortedData, getSubRows, expansion, rowKey])

  const toggleAll = () => {
    if (selectable !== 'multi') return
    // The header select-all is the range-selection escape hatch: any
    // subsequent shift-click starts a fresh range from the next clicked row.
    checkboxAnchorRef.current = null
    rebaseToProp()
    const keys = bodyData
      .map((row, i) => (checkMethod && !checkMethod(row, i) ? null : rowKeyOf(row)))
      .filter((k): k is string | number => k != null)
    selModel.toggleAll(keys)
  }

  const allKeys = bodyData.map(rowKeyOf)
  const allSelected =
    selectable === 'multi' &&
    (selControlled
      ? allKeys.length > 0 && allKeys.every((k) => displaySelection.includes(k))
      : selModel.isAllSelected(allKeys))
  const someSelected =
    selectable === 'multi' && allKeys.some((k) => displaySelection.includes(k)) && !allSelected

  const gridTemplateColumns = React.useMemo(() => {
    const widths: string[] = []
    if (hasDetail) widths.push(`${EXPAND_COL_WIDTH}px`)
    if (selectable !== 'none') widths.push('40px')
    for (const col of leafColumns) {
      const override = columnWidths[col.key]
      if (override != null) widths.push(`${override}px`)
      else if (typeof col.width === 'number') widths.push(`${col.width}px`)
      else if (typeof col.width === 'string') widths.push(col.width)
      else widths.push('minmax(0, 1fr)')
    }
    return widths.join(' ')
  }, [leafColumns, selectable, columnWidths, hasDetail])

  // Sticky offsets for pinned columns: each accumulates the resolved widths of
  // the pinned columns between it and its edge (plus the selection column on
  // the left). Requires a numeric width; falls back to a default.
  const pinnedOffsets = React.useMemo(() => {
    const map: Record<string, { side: 'left' | 'right'; offset: number }> = {}
    const widthOf = (col: IrisTableColumn<Row>): number =>
      columnWidths[col.key] ?? (typeof col.width === 'number' ? col.width : DEFAULT_PINNED_WIDTH)
    let left =
      (hasDetail ? EXPAND_COL_WIDTH : 0) + (selectable !== 'none' ? SELECTION_COL_WIDTH : 0)
    for (const col of leafColumns) {
      if (col.pinned === 'left') {
        map[col.key] = { side: 'left', offset: left }
        left += widthOf(col)
      }
    }
    let right = 0
    for (let i = leafColumns.length - 1; i >= 0; i -= 1) {
      const col = leafColumns[i]
      if (col?.pinned === 'right') {
        map[col.key] = { side: 'right', offset: right }
        right += widthOf(col)
      }
    }
    return map
  }, [leafColumns, columnWidths, selectable])

  const pinnedStyle = (key: string): React.CSSProperties | null => {
    const p = pinnedOffsets[key]
    if (!p) return null
    return {
      position: 'sticky',
      [p.side]: p.offset,
      zIndex: 1,
      background: 'var(--iris-background)',
    }
  }

  // -------- Column virtualization (opt-in) --------
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const [scrollLeft, setScrollLeft] = React.useState(0)
  const [viewportWidth, setViewportWidth] = React.useState(0)

  // Cell-range selection (opt-in via `cellRange`). The controller lives in a
  // ref so it is never re-created; we bridge it to React via
  // useSyncExternalStore through the controller's getState/subscribe API.
  const cellRangeRef = React.useRef<CellRangeController | null>(null)
  if (cellRangeRef.current === null) {
    cellRangeRef.current = createCellRange()
  }
  const cellRangeCtrl = cellRangeRef.current
  // Subscribe React to the range store — re-renders whenever anchor/active changes.
  // `cellRangeState` drives re-renders; `isInRange` reads fresh state at render time.
  const cellRangeState = React.useSyncExternalStore(
    cellRangeCtrl.subscribe,
    cellRangeCtrl.getState,
    cellRangeCtrl.getState,
  )
  // Derive a stable isInRange function from the subscribed snapshot so that
  // TypeScript treats `cellRangeState` as consumed and every cell reads the
  // current range (computed from anchor/active in the snapshot, not a closure).
  const isInRange = React.useCallback(
    (row: number, col: number): boolean => {
      const { anchor, active } = cellRangeState
      if (!anchor || !active) return false
      const minRow = Math.min(anchor.row, active.row)
      const maxRow = Math.max(anchor.row, active.row)
      const minCol = Math.min(anchor.col, active.col)
      const maxCol = Math.max(anchor.col, active.col)
      return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol
    },
    [cellRangeState],
  )

  // Grid keyboard navigation (opt-in): roving cell focus over the data cells.
  const [focusedCell, setFocusedCell] = React.useState<{ row: number; col: number } | null>(null)
  const GRID_NAV_KEYS = new Set([
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
    'PageUp',
    'PageDown',
  ])
  const handleGridKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!keyboardNavigation || !GRID_NAV_KEYS.has(e.key)) return
    // Only navigate from a grid cell — never hijack arrows inside an editing
    // cell's <input> (which carries no data-grid-row).
    const target = e.target as HTMLElement
    if (target.dataset.gridRow === undefined) return
    e.preventDefault()
    const current = focusedCell ?? { row: 0, col: 0 }
    const next = nextGridCell(current, e.key as GridNavKey, {
      rowCount: bodyData.length,
      colCount: leafColumns.length,
      pageSize: 10,
    })
    setFocusedCell(next)
    const cell = rootRef.current?.querySelector<HTMLElement>(
      `[data-grid-row="${next.row}"][data-grid-col="${next.col}"]`,
    )
    cell?.focus()
  }

  // Cell-range keyboard handler: Shift+Arrow extends the range, Escape clears it.
  const CELL_RANGE_ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
  const handleCellRangeKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!cellRange) return
    if (e.key === 'Escape') {
      cellRangeCtrl.clearRange()
      return
    }
    if (!e.shiftKey || !CELL_RANGE_ARROW_KEYS.has(e.key)) return
    const target = e.target as HTMLElement
    const rowAttr = target.dataset.irisCellRow
    const colAttr = target.dataset.irisCellCol
    if (rowAttr === undefined || colAttr === undefined) return
    e.preventDefault()
    const row = Number(rowAttr)
    const col = Number(colAttr)
    const anchor = cellRangeCtrl.getState().anchor
    const active = anchor ? (cellRangeCtrl.getState().active ?? { row, col }) : { row, col }
    let nextRow = active.row
    let nextCol = active.col
    if (e.key === 'ArrowUp') nextRow = Math.max(0, nextRow - 1)
    else if (e.key === 'ArrowDown') nextRow = Math.min(bodyData.length - 1, nextRow + 1)
    else if (e.key === 'ArrowLeft') nextCol = Math.max(0, nextCol - 1)
    else nextCol = Math.min(leafColumns.length - 1, nextCol + 1)
    cellRangeCtrl.extendRange(nextRow, nextCol)
  }

  const resolvedColWidths = React.useMemo(
    () =>
      leafColumns.map(
        (col) =>
          columnWidths[col.key] ??
          (typeof col.width === 'number' ? col.width : DEFAULT_PINNED_WIDTH),
      ),
    [leafColumns, columnWidths],
  )

  React.useEffect(() => {
    if (!columnVirtualization) return
    const el = rootRef.current
    if (!el) return
    const measure = () => setViewportWidth(el.clientWidth)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [columnVirtualization])

  // Set of column indices to render: the visible window + overscan, always
  // unioned with pinned columns. `null` ⇒ render every column (feature off).
  const visibleColSet = React.useMemo(() => {
    if (!columnVirtualization) return null
    const w = computeVirtualRange({
      itemCount: leafColumns.length,
      scrollTop: scrollLeft,
      viewportSize: viewportWidth,
      itemSize: (i) => resolvedColWidths[i] ?? DEFAULT_PINNED_WIDTH,
      buffer: 2,
    })
    const set = new Set<number>()
    for (let i = w.startIndex; i <= w.endIndex; i += 1) set.add(i)
    leafColumns.forEach((col, i) => {
      if (col.pinned) set.add(i)
    })
    return set
  }, [columnVirtualization, leafColumns, scrollLeft, viewportWidth, resolvedColWidths])

  // 1-based grid track for a column (after the optional selection track), so a
  // rendered cell lands in the right place even when earlier cells are skipped.
  const colTrack = (i: number): number => (hasDetail ? 1 : 0) + (selectable !== 'none' ? 2 : 1) + i

  const baseCellStyle: React.CSSProperties = {
    padding: '8px 12px',
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
  const borderStyle = bordered ? '1px solid var(--iris-border)' : 'none'

  // Cell tooltips (vxe tooltipConfig parity, title mode, batch G): a native
  // `title` on every body cell — content from the callback or the raw cell
  // value; editing cells are exempt, and empty content drops the tooltip (vxe
  // empty-content parity). Truncation gating is not implemented: titles render
  // on every cell regardless of `showAll` (documented simplification — cheap
  // and explicit).
  const cellTooltip = (row: Row, col: IrisTableColumn<Row>): string | undefined => {
    if (!tooltipConfig) return undefined
    const raw = getCellValue(row, col)
    const content = tooltipConfig.content
      ? tooltipConfig.content(row, col)
      : col.formatter
        ? (() => {
            const formatted = col.formatter(raw, row)
            return typeof formatted === 'string' ? formatted : String(raw ?? '')
          })()
        : String(raw ?? '')
    return content === '' ? undefined : content
  }

  // Header filter trigger (vxe filterConfig parity, batch I): a small icon
  // button at the end of the title; active (--iris-primary) when the column
  // has a non-empty checked set. stopPropagation keeps it from sorting.
  const renderFilterTrigger = (col: IrisTableColumn<Row>, leaf: boolean): React.ReactNode => {
    if (!leaf || !col.filterable) return null
    const active = (filterValues?.[col.key]?.length ?? 0) > 0
    return (
      <button
        type="button"
        data-iris-filter-trigger={col.key}
        aria-label={t('table.filter')}
        aria-haspopup="true"
        aria-expanded={
          filterPanelState?.open === true && filterPanelState.colKey === col.key
            ? 'true'
            : undefined
        }
        data-iris-filter-active={active ? 'true' : undefined}
        onClick={(e) => openFilterPanel(e, col.key)}
        onKeyDown={(e) => e.stopPropagation()}
        style={{
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          padding: 0,
          marginInlineStart: 'var(--iris-space-xxs, 4px)',
          fontSize: 'var(--iris-font-size-xs, 12px)',
          lineHeight: 1,
          color: active ? 'var(--iris-primary)' : 'var(--iris-muted)',
        }}
      >
        ⏷
      </button>
    )
  }

  // Each row is its own CSS grid (sharing `gridTemplateColumns`) rather than the
  // root being one grid — this keeps columns aligned while letting the virtual
  // scroller absolutely-position rows. `extraStyle` lets the virtual window set
  // a row's height to fill its slot.
  const renderRow = (
    row: Row,
    idx: number,
    extraStyle?: React.CSSProperties,
    treeMeta?: TreeRow<Row>,
  ): React.ReactElement => {
    const k = rowKeyOf(row)
    const selected = displaySelection.includes(k)
    return (
      <div
        key={String(k ?? idx)}
        role="row"
        aria-selected={selectable !== 'none' ? selected : undefined}
        // Tree depth/position for screen readers (1-based); the toggle button
        // carries aria-expanded for the control itself.
        aria-level={treeMeta ? treeMeta.depth + 1 : undefined}
        aria-setsize={treeMeta ? treeMeta.setSize : undefined}
        aria-posinset={treeMeta ? treeMeta.posInset : undefined}
        data-iris-table-row={String(k ?? idx)}
        data-iris-table-row-selected={selected ? 'true' : undefined}
        data-iris-row-current={currentRowKey === k ? 'true' : undefined}
        onClick={() => {
          onRowClick?.(row, idx)
          if (onCurrentRowChange && k != null) {
            if (beforeCurrentRowChange?.(k, row) !== false) onCurrentRowChange(k, row)
          }
        }}
        className={rowClassName?.(row, idx)}
        style={{
          display: 'grid',
          gridTemplateColumns,
          ...extraStyle,
          ...(rowStyle?.(row, idx) ?? null),
        }}
      >
        {rowDrag ? (
          <div
            role="cell"
            data-iris-table-cell="__drag"
            data-iris-row-drag-active={rowDragActiveId === String(k ?? idx) ? 'true' : undefined}
            data-iris-row-drag-over={rowDragOverId === String(k ?? idx) ? 'true' : undefined}
            onPointerDown={(e) => handleRowDragPointerDown(e, String(k ?? idx))}
            onClick={(e) => e.stopPropagation()}
            style={{
              ...baseCellStyle,
              justifyContent: 'center',
              cursor: 'grab',
              color: 'var(--iris-muted)',
              borderBottom: borderStyle,
              background:
                rowDragActiveId === String(k ?? idx)
                  ? 'var(--iris-surface-hover)'
                  : rowDragOverId === String(k ?? idx)
                    ? 'var(--iris-surface-selected, rgba(99, 102, 241, 0.12))'
                    : 'transparent',
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 'var(--iris-font-size-sm, 13px)' }}>
              ⠿
            </span>
          </div>
        ) : null}
        {seq ? (
          <div
            role="cell"
            data-iris-table-cell="__seq"
            style={{
              ...baseCellStyle,
              justifyContent: 'center',
              color: 'var(--iris-muted)',
              borderBottom: borderStyle,
              userSelect: 'none',
            }}
          >
            {seqMethod ? seqMethod({ rowIndex: idx, columnIndex: 0 }) : idx + seqStartIndex}
          </div>
        ) : null}
        {hasDetail ? (
          <div
            role="cell"
            data-iris-table-cell="__expand"
            style={{
              ...baseCellStyle,
              justifyContent: 'center',
              background: 'var(--iris-cell-bg, transparent)',
              borderBottom: borderStyle,
            }}
          >
            {isRowExpandable(row, idx) ? (
              <button
                type="button"
                data-iris-table-expand-toggle=""
                aria-expanded={expandedKeys.includes(String(k))}
                aria-label={t(
                  expandedKeys.includes(String(k)) ? 'treeSelect.collapse' : 'treeSelect.expand',
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  expansion.toggle(String(k))
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 0,
                  font: 'inherit',
                  color: 'var(--iris-foreground)',
                  transform: expandedKeys.includes(String(k)) ? 'rotate(90deg)' : 'none',
                  transition: 'transform 150ms',
                }}
              >
                ▶
              </button>
            ) : null}
          </div>
        ) : null}
        {selectable !== 'none' ? (
          <div
            role="cell"
            data-iris-table-cell="__selection"
            onClick={
              checkboxRange
                ? (e: React.MouseEvent) => {
                    // vxe checkboxConfig isShiftKey parity: shift-click toggles
                    // the whole range between the anchor and this row. The
                    // label forwards a second click to the <input> —
                    // preventDefault on the original click cancels the
                    // forwarded one AND the single-toggle change event, so the
                    // target row is not toggled twice (the range covers it).
                    if (e.shiftKey && checkboxAnchorRef.current !== null) {
                      e.preventDefault()
                      toggleRowRange(checkboxAnchorRef.current, k)
                    }
                    // Always move the anchor — even without shift.
                    checkboxAnchorRef.current = k ?? null
                  }
                : undefined
            }
            style={{
              ...baseCellStyle,
              justifyContent: 'center',
              background: 'var(--iris-cell-bg, transparent)',
              borderBottom: borderStyle,
            }}
          >
            <IrisCheckbox
              checked={selected}
              disabled={checkMethod ? !checkMethod(row, idx) : false}
              onChange={() => toggleRow(row, idx)}
              aria-label={t('table.selectRow', { key: String(k ?? idx) })}
            />
          </div>
        ) : null}
        {leafColumns.map((col, ci) => {
          if (visibleColSet && !visibleColSet.has(ci)) return null
          const spanKey = `${idx}:${ci}`
          if (spanMethod && spanOccupyRef.current.has(spanKey)) return null
          const span = spanMethod?.({ rowIndex: idx, columnIndex: ci })
          const rowspan = span?.rowspan ?? 1
          const colspan = span?.colspan ?? 1
          if (rowspan > 1) {
            for (let r = 1; r < rowspan; r++) spanOccupyRef.current.add(`${idx + r}:${ci}`)
          }
          if (colspan > 1) {
            for (let c = 1; c < colspan; c++) spanOccupyRef.current.add(`${idx}:${ci + c}`)
          }
          const raw = getCellValue(row, col)
          const editing = cellEdit.isEditing(cellId(k, col.key), col.key)
          return (
            <div
              key={col.key}
              role="cell"
              data-iris-table-cell={col.key}
              data-iris-table-pinned={col.pinned}
              data-editable={col.editable ? '' : undefined}
              data-editing={editing ? '' : undefined}
              title={editing ? undefined : cellTooltip(row, col)}
              className={cellClassName?.(row, col, idx)}
              {...(keyboardNavigation
                ? {
                    'data-grid-row': idx,
                    'data-grid-col': ci,
                    tabIndex: (
                      focusedCell
                        ? focusedCell.row === idx && focusedCell.col === ci
                        : idx === 0 && ci === 0
                    )
                      ? 0
                      : -1,
                    onFocus: () => setFocusedCell({ row: idx, col: ci }),
                  }
                : null)}
              {...(cellRange
                ? {
                    'data-iris-cell-row': idx,
                    'data-iris-cell-col': ci,
                    'data-iris-cell-selected': isInRange(idx, ci) ? 'true' : undefined,
                    onClick: (e: React.MouseEvent) => {
                      if (e.shiftKey) {
                        cellRangeCtrl.extendRange(idx, ci)
                      } else {
                        cellRangeCtrl.startRange(idx, ci)
                      }
                    },
                  }
                : null)}
              onDoubleClick={col.editable ? () => beginEdit(row, col, k, idx) : undefined}
              onContextMenu={
                contextMenu ? (e) => handleContextMenu(e, row, col, idx, ci) : undefined
              }
              onClick={
                onCellClick
                  ? (e: React.MouseEvent) => {
                      handleCellClick(e, row, col, k, idx, ci)
                    }
                  : cellRange
                    ? (e: React.MouseEvent) => {
                        if (e.shiftKey) cellRangeCtrl.extendRange(idx, ci)
                        else cellRangeCtrl.startRange(idx, ci)
                      }
                    : col.editable && editConfig?.trigger === 'click'
                      ? () => beginEdit(row, col, k, idx)
                      : undefined
              }
              style={{
                ...baseCellStyle,
                ...(visibleColSet ? { gridColumnStart: colTrack(ci) } : null),
                ...(colspan > 1 ? { gridColumnEnd: `span ${colspan}` } : null),
                ...(rowspan > 1 ? { gridRowEnd: `span ${rowspan}` } : null),
                justifyContent:
                  (col.align ?? (typeof getCellValue(row, col) === 'number' ? 'right' : 'left')) ===
                  'right'
                    ? 'flex-end'
                    : col.align === 'center'
                      ? 'center'
                      : 'flex-start',
                background:
                  cellRange && isInRange(idx, ci)
                    ? 'var(--iris-surface-selected, rgba(99,102,241,0.12))'
                    : striped && idx % 2 === 1
                      ? 'var(--iris-surface)'
                      : 'transparent',
                borderBottom: borderStyle,
                cursor: col.editable ? 'cell' : cellRange ? 'default' : undefined,
                ...(editing ? { padding: '4px 8px' } : null),
                ...pinnedStyle(col.key),
                ...(cellStyle?.(row, col, idx) ?? null),
              }}
            >
              {treeMeta && ci === 0 ? (
                <span
                  data-iris-table-tree-indent=""
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    flex: 'none',
                    paddingLeft: treeMeta.depth * 16,
                  }}
                >
                  {treeMeta.hasChildren ||
                  (lazyLoad !== undefined && !lazyChildrenRef.current.has(treeMeta.key)) ? (
                    <button
                      type="button"
                      data-iris-table-tree-toggle=""
                      data-iris-tree-loading={lazyLoading.has(treeMeta.key) ? '' : undefined}
                      aria-expanded={treeMeta.expanded}
                      aria-label={t(
                        treeMeta.expanded ? 'treeSelect.collapse' : 'treeSelect.expand',
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (treeMeta.hasChildren) {
                          expansion.toggle(treeMeta.key)
                          return
                        }
                        // Lazy leaf: first expand fetches the children. Loading
                        // is tracked in state (drives the spinner caret); a
                        // throwing load stays retryable (the key is not cached).
                        if (lazyLoading.has(treeMeta.key)) return
                        setLazyLoading((prev) => new Set(prev).add(treeMeta.key))
                        const clearLoading = () =>
                          setLazyLoading((prev) => {
                            const next = new Set(prev)
                            next.delete(treeMeta.key)
                            return next
                          })
                        try {
                          lazyLoad!(row, (children) => {
                            lazyChildrenRef.current.set(treeMeta.key, children)
                            if (children && children.length > 0) {
                              expansion.toggle(treeMeta.key)
                            }
                            clearLoading()
                          })
                        } catch {
                          clearLoading()
                        }
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: 0,
                        marginRight: 4,
                        font: 'inherit',
                        color: 'var(--iris-foreground)',
                        transform: treeMeta.expanded ? 'rotate(90deg)' : 'none',
                        transition: 'transform 150ms',
                      }}
                    >
                      ▶
                    </button>
                  ) : (
                    <span style={{ display: 'inline-block', width: 16 }} aria-hidden="true" />
                  )}
                </span>
              ) : null}
              {editing ? (
                // Const bindings let TS keep the select/options narrowing
                // inside the nested JSX callbacks (a mutable `col` would lose
                // it). A select editor with no editOptions falls back to the
                // text input.
                (() => {
                  const isSelectEditor = col.editor === 'select' && col.editOptions !== undefined
                  const selectOptions = isSelectEditor ? col.editOptions : undefined
                  return (
                    <>
                      {isSelectEditor && selectOptions ? (
                        // vxe edit-render select parity (batch H): a native
                        // <select> commits the option's TYPED value (numbers stay
                        // numbers). Value matches options by String(value); when
                        // the current draft matches NO option, a synthetic option
                        // preserves it so a plain blur never silently replaces
                        // the cell value with the first option.
                        <select
                          ref={setEditorRef}
                          value={String(cellEdit.getDraft() ?? '')}
                          data-iris-table-editor=""
                          data-iris-table-editor-select=""
                          aria-invalid={cellEdit.getError() ? 'true' : undefined}
                          aria-describedby={
                            cellEdit.getError() && validConfig?.showMessage !== false
                              ? `${cellId(k, col.key)}-error`
                              : undefined
                          }
                          onChange={(e) => {
                            const opt = selectOptions.find(
                              (o) => String(o.value) === e.target.value,
                            )
                            cellEdit.setDraft(opt ? opt.value : e.target.value)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Tab') {
                              moveEditOnTab(e, e.shiftKey ? -1 : 1)
                            } else if (e.key === 'Enter') {
                              e.preventDefault()
                              commitEdit()
                            } else if (e.key === 'Escape') {
                              e.preventDefault()
                              cancelEdit()
                            }
                          }}
                          onBlur={() => commitEdit()}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: '100%',
                            border: `1px solid ${cellEdit.getError() ? 'var(--iris-danger)' : 'var(--iris-primary)'}`,
                            borderRadius: 'var(--iris-radius-sm, 4px)',
                            padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
                            font: 'inherit',
                            background: 'var(--iris-background)',
                            color: 'var(--iris-foreground)',
                            outline: 'none',
                          }}
                        >
                          {!selectOptions.some(
                            (o) => String(o.value) === String(cellEdit.getDraft() ?? ''),
                          ) ? (
                            <option value={String(cellEdit.getDraft() ?? '')}>
                              {String(cellEdit.getDraft() ?? '')}
                            </option>
                          ) : null}
                          {selectOptions.map((o) => (
                            <option key={String(o.value)} value={String(o.value)}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : col.editor === 'textarea' ? (
                        // vxe edit-render textarea parity (batch I): Enter
                        // commits, Shift+Enter inserts a newline, Escape
                        // cancels — same commit/aria surface as the text editor.
                        <textarea
                          ref={setEditorRef}
                          rows={3}
                          value={String(cellEdit.getDraft() ?? '')}
                          data-iris-table-editor=""
                          data-iris-table-editor-textarea=""
                          aria-invalid={cellEdit.getError() ? 'true' : undefined}
                          aria-describedby={
                            cellEdit.getError() && validConfig?.showMessage !== false
                              ? `${cellId(k, col.key)}-error`
                              : undefined
                          }
                          onChange={(e) => cellEdit.setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Tab') {
                              moveEditOnTab(e, e.shiftKey ? -1 : 1)
                            } else if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              commitEdit()
                            } else if (e.key === 'Escape') {
                              e.preventDefault()
                              cancelEdit()
                            }
                          }}
                          onBlur={() => commitEdit()}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: '100%',
                            border: `1px solid ${cellEdit.getError() ? 'var(--iris-danger)' : 'var(--iris-primary)'}`,
                            borderRadius: 'var(--iris-radius-sm, 4px)',
                            padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
                            font: 'inherit',
                            background: 'var(--iris-background)',
                            color: 'var(--iris-foreground)',
                            outline: 'none',
                            resize: 'none',
                          }}
                        />
                      ) : (
                        <input
                          ref={setEditorRef}
                          type={col.editor === 'number' ? 'number' : 'text'}
                          value={String(cellEdit.getDraft() ?? '')}
                          data-iris-table-editor=""
                          aria-invalid={cellEdit.getError() ? 'true' : undefined}
                          aria-describedby={
                            cellEdit.getError() && validConfig?.showMessage !== false
                              ? `${cellId(k, col.key)}-error`
                              : undefined
                          }
                          onChange={(e) => cellEdit.setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Tab') {
                              moveEditOnTab(e, e.shiftKey ? -1 : 1)
                            } else if (e.key === 'Enter') {
                              e.preventDefault()
                              commitEdit()
                            } else if (e.key === 'Escape') {
                              e.preventDefault()
                              cancelEdit()
                            }
                          }}
                          onBlur={() => commitEdit()}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: '100%',
                            border: `1px solid ${cellEdit.getError() ? 'var(--iris-danger)' : 'var(--iris-primary)'}`,
                            borderRadius: 'var(--iris-radius-sm, 4px)',
                            padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
                            font: 'inherit',
                            background: 'var(--iris-background)',
                            color: 'var(--iris-foreground)',
                            outline: 'none',
                          }}
                        />
                      )}
                      {/* validConfig.showMessage=false: validation still blocks the
                    commit and aria-invalid stays — only the message element is
                    skipped (vxe ValidConfig parity). */}
                      {cellEdit.getError() && validConfig?.showMessage !== false ? (
                        <div
                          id={`${cellId(k, col.key)}-error`}
                          role="alert"
                          data-iris-table-editor-error=""
                          style={{
                            marginTop: 'var(--iris-space-xxs, 4px)',
                            fontSize: 'var(--iris-font-size-xs, 12px)',
                            color: 'var(--iris-danger)',
                          }}
                        >
                          {cellEdit.getError()}
                        </div>
                      ) : null}
                    </>
                  )
                })()
              ) : col.render ? (
                col.render(raw, row, idx)
              ) : col.html ? (
                <span
                  // vxe type=html parity — opt-in; the caller guarantees the
                  // content is trusted (XSS risk, matching the vxe docs warning).
                  dangerouslySetInnerHTML={{ __html: String(raw ?? '') }}
                />
              ) : col.formatter ? (
                // vxe formatter parity (batch I): display-only — sorting,
                // filtering, editing and summary all read the raw value.
                col.formatter(raw, row)
              ) : (
                (raw as React.ReactNode)
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      {formConfig ? (
        <form
          data-iris-table-form=""
          onSubmit={handleFormSubmit}
          onReset={handleFormReset}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 'var(--iris-space-sm, 12px)',
            padding: 'var(--iris-space-sm, 12px)',
            border: '1px solid var(--iris-border)',
            borderBottom: 'none',
            background: 'var(--iris-surface)',
            fontSize: 'var(--iris-font-size-sm, 13px)',
          }}
        >
          {formConfig.fields.map((field) => (
            <div key={field.key} data-iris-table-form-field={field.key} style={{ minWidth: 180 }}>
              <IrisFormField label={field.label} size="sm">
                {field.type === 'select' ? (
                  <IrisSelect
                    items={(field.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
                    value={formDraft[field.key] ?? ''}
                    onValueChange={(v) => setFormValue(field.key, String(v ?? ''))}
                    placeholder={field.placeholder ?? t('select.placeholder')}
                    size="sm"
                  />
                ) : (
                  <IrisInput
                    value={formDraft[field.key] ?? ''}
                    onChange={(e) => setFormValue(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    size="sm"
                  />
                )}
              </IrisFormField>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 'var(--iris-space-xs, 8px)' }}>
            <IrisButton type="submit" size="sm" data-iris-table-form-submit="">
              {formConfig.submitText ?? t('table.formSubmit')}
            </IrisButton>
            <IrisButton type="reset" variant="outline" size="sm" data-iris-table-form-reset="">
              {formConfig.resetText ?? t('table.formReset')}
            </IrisButton>
          </div>
        </form>
      ) : null}
      {toolbar ? (
        <div
          data-iris-table-toolbar=""
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--iris-space-sm, 12px)',
            padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
            border: '1px solid var(--iris-border)',
            borderBottom: 'none',
            borderTopLeftRadius: 'var(--iris-radius-md, 6px)',
            borderTopRightRadius: 'var(--iris-radius-md, 6px)',
            background: 'var(--iris-surface)',
            fontSize: 'var(--iris-font-size-sm, 13px)',
            position: 'relative',
          }}
        >
          {toolbar.title ? (
            <span style={{ fontWeight: 600, color: 'var(--iris-foreground)' }}>
              {toolbar.title}
            </span>
          ) : null}
          <div style={{ flex: 1 }} />
          {toolbar.onRefresh ? (
            <button
              type="button"
              data-iris-table-toolbar-refresh=""
              onClick={() => {
                toolbar.onRefresh?.()
                // proxy mode: the built-in refresh also re-queries (vxe parity)
                if (proxyRef.current) proxyRef.current.refetch()
              }}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--iris-muted)',
                fontSize: 'var(--iris-font-size-md, 14px)',
              }}
              aria-label={t('table.refresh')}
              title={t('table.refresh')}
            >
              ↻
            </button>
          ) : null}
          {toolbar.onImport ? (
            <>
              <input
                ref={importFileRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={handleImportFile}
              />
              <button
                type="button"
                data-iris-table-toolbar-import=""
                onClick={() => importFileRef.current?.click()}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--iris-muted)',
                  fontSize: 'var(--iris-font-size-md, 14px)',
                }}
                aria-label={t('table.import')}
                title={t('table.import')}
              >
                ⇪
              </button>
            </>
          ) : null}
          {toolbar.columnSettings && columnVisibility ? (
            <>
              <button
                type="button"
                data-iris-table-toolbar-columns=""
                onClick={() => setColumnSettingsOpen((v) => !v)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--iris-muted)',
                  fontSize: 'var(--iris-font-size-md, 14px)',
                }}
                aria-label={t('table.columnSettings')}
                title={t('table.columnSettings')}
              >
                ☰
              </button>
              {columnSettingsOpen ? (
                <div
                  data-iris-table-column-settings=""
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    zIndex: 'var(--iris-z-popover, 1000)',
                    background: 'var(--iris-surface-floating, var(--iris-surface))',
                    border: '1px solid var(--iris-border)',
                    borderRadius: 'var(--iris-radius-md, 6px)',
                    boxShadow: 'var(--iris-shadow-lg)',
                    padding: 'var(--iris-space-xs, 8px)',
                    minWidth: 160,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--iris-space-xxs, 4px)',
                  }}
                >
                  {safeColumns.map((col) => (
                    <label
                      key={col.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--iris-space-xs, 8px)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={columnVisibility[col.key] !== false}
                        onChange={() => toggleColumnVisibility(col.key)}
                      />
                      {col.title ?? col.key}
                    </label>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
          {toolbar.buttons && toolbar.buttons.length > 0
            ? toolbar.buttons.map((btn) => (
                <button
                  key={btn.key}
                  type="button"
                  data-iris-table-toolbar-button={btn.key}
                  {...{ [`data-iris-table-toolbar-button-${btn.key}`]: '' }}
                  onClick={btn.onClick}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--iris-foreground)',
                    fontSize: 'var(--iris-font-size-md, 14px)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--iris-space-xxs, 4px)',
                    padding: '0 var(--iris-space-xxs, 4px)',
                  }}
                  aria-label={btn.label}
                  title={btn.label}
                >
                  {btn.icon ? (
                    <span aria-hidden="true" style={{ fontSize: 'var(--iris-font-size-sm, 13px)' }}>
                      {btn.icon}
                    </span>
                  ) : null}
                  {btn.label}
                </button>
              ))
            : null}
        </div>
      ) : null}
      <div
        ref={rootRef}
        // A keyboard-navigable hierarchical table is a `treegrid`; otherwise the
        // grid/table role as before (treegrid implies managed cell focus).
        role={keyboardNavigation ? (treeMode ? 'treegrid' : 'grid') : 'table'}
        data-iris-table=""
        data-size={size}
        data-printable={printable ? 'true' : undefined}
        data-bordered={bordered ? 'true' : undefined}
        data-striped={striped ? 'true' : undefined}
        data-column-virtualized={columnVirtualization ? 'true' : undefined}
        className={className}
        onKeyDown={
          keyboardNavigation || cellRange
            ? (e) => {
                if (keyboardNavigation) handleGridKey(e)
                if (cellRange) handleCellRangeKey(e)
              }
            : undefined
        }
        onPointerMove={
          rowDrag || columnDrag
            ? (e) => {
                handleRowDragPointerMove(e)
                handleColDragPointerMove(e)
              }
            : undefined
        }
        onPointerUp={
          rowDrag || columnDrag
            ? () => {
                handleRowDragPointerUp()
                handleColDragPointerUp()
              }
            : undefined
        }
        onPointerLeave={rowDrag ? handleRowDragPointerLeave : undefined}
        onScroll={
          columnVirtualization
            ? (e) => setScrollLeft((e.currentTarget as HTMLDivElement).scrollLeft)
            : undefined
        }
        {...rest}
        style={{
          background: 'var(--iris-background)',
          color: 'var(--iris-foreground)',
          fontSize: 'var(--iris-font-size-md, 14px)',
          border: borderStyle,
          borderRadius: 'var(--iris-radius-md, 6px)',
          // Column virtualization turns the table into a horizontal scroll container.
          overflow: columnVirtualization ? 'auto' : 'hidden',
          ...style,
        }}
      >
        {/* Multi-level (grouped) header: a CSS grid of `headerMatrix.length` rows;
          each cell placed by its leaf-column span (colStart/colSpan) and row span. */}
        {showHeader && grouped && headerMatrix ? (
          <div
            role="row"
            data-iris-table-row="header"
            data-iris-table-header-grouped=""
            style={{
              display: 'grid',
              gridTemplateColumns,
              gridTemplateRows: `repeat(${headerMatrix.length}, auto)`,
            }}
          >
            {hasDetail ? (
              <div role="columnheader" style={{ gridColumn: '1', gridRow: '1 / -1' }} />
            ) : null}
            {selectable !== 'none' ? (
              <div
                role="columnheader"
                data-iris-table-header=""
                style={{
                  gridColumn: hasDetail ? '2' : '1',
                  gridRow: '1 / -1',
                  ...baseCellStyle,
                  background: 'var(--iris-surface)',
                  borderBottom: borderStyle,
                  justifyContent: 'center',
                }}
              >
                {selectable === 'multi' ? (
                  <IrisCheckbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onChange={toggleAll}
                    aria-label={t('table.selectAll')}
                  />
                ) : null}
                {selectable === 'multi' && displaySelection.length > 0 ? (
                  <span
                    data-iris-table-selected-count=""
                    style={{
                      marginInlineStart: 'var(--iris-space-xs, 8px)',
                      fontSize: 'var(--iris-font-size-sm, 13px)',
                      color: 'var(--iris-muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t('table.selectedCount', { count: String(displaySelection.length) })}
                  </span>
                ) : null}
              </div>
            ) : null}
            {headerMatrix.flatMap((cells) =>
              cells.map((cell) => {
                const col = cell.column
                const isLeaf = !col.children || col.children.length === 0
                const sortable = isLeaf && col.sortable
                const multiIdx =
                  multiSort && sortable ? multiSortState.findIndex((s) => s.key === col.key) : -1
                const isSortKey = sortable && (multiSort ? multiIdx >= 0 : sort?.key === col.key)
                const dir: IrisTableSortDirection | undefined = isSortKey
                  ? multiSort
                    ? multiSortState[multiIdx]!.direction
                    : sort?.direction
                  : undefined
                const lead = (hasDetail ? 1 : 0) + (selectable !== 'none' ? 1 : 0)
                return (
                  <div
                    key={`${col.key}-${cell.level}`}
                    role="columnheader"
                    data-iris-table-header={col.key}
                    data-iris-table-header-group={isLeaf ? undefined : ''}
                    data-iris-col-drag-active={colDragActive === col.key ? 'true' : undefined}
                    data-iris-col-drag-over={colDragOver === col.key ? 'true' : undefined}
                    className={headerCellClassName?.(col)}
                    onPointerDown={
                      columnDrag && isLeaf ? (e) => handleColDragPointerDown(e, col.key) : undefined
                    }
                    aria-colspan={cell.colSpan}
                    aria-sort={
                      isSortKey
                        ? dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : sortable
                          ? 'none'
                          : undefined
                    }
                    tabIndex={sortable ? 0 : undefined}
                    onClick={sortable ? () => cycleHeaderSort(col) : undefined}
                    onKeyDown={sortable ? (e) => onHeaderKeyDown(e, col) : undefined}
                    style={{
                      gridColumn: `${lead + cell.colStart} / span ${cell.colSpan}`,
                      gridRow: `${cell.level + 1} / span ${cell.rowSpan}`,
                      ...baseCellStyle,
                      justifyContent: isLeaf ? 'flex-start' : 'center',
                      background: 'var(--iris-surface)',
                      borderBottom: borderStyle,
                      borderInlineEnd: isLeaf ? 'none' : borderStyle,
                      cursor: sortable ? 'pointer' : 'default',
                      fontWeight: 600,
                      userSelect: sortable ? 'none' : 'auto',
                      ...(headerCellStyle?.(col) ?? null),
                    }}
                  >
                    <span>
                      {col.titlePrefix}
                      {col.title}
                      {col.titleSuffix}
                    </span>
                    {sortable ? (
                      <span
                        aria-hidden="true"
                        data-iris-table-sort-indicator=""
                        style={{
                          marginInlineStart: 'var(--iris-space-xs, 8px)',
                          fontSize: 'var(--iris-font-size-xs, 12px)',
                          color: dir ? 'var(--iris-primary)' : 'var(--iris-muted)',
                        }}
                      >
                        {dir === 'asc' ? '↑' : dir === 'desc' ? '↓' : '↕'}
                      </span>
                    ) : null}
                    {renderFilterTrigger(col, isLeaf)}
                    {/* Multi mode: non-primary sort columns show their click-order
                      sequence number (vxe sort-config sequence parity). */}
                    {multiSort && multiIdx > 0 ? (
                      <span
                        data-iris-sort-seq=""
                        style={{
                          marginInlineStart: 'var(--iris-space-xxs, 4px)',
                          fontSize: 'var(--iris-font-size-xs, 12px)',
                          color: 'var(--iris-muted)',
                        }}
                      >
                        {multiIdx + 1}
                      </span>
                    ) : null}
                  </div>
                )
              }),
            )}
          </div>
        ) : showHeader ? (
          /* Header row (flat) */
          <div
            role="row"
            data-iris-table-row="header"
            style={{ display: 'grid', gridTemplateColumns }}
          >
            {hasDetail ? (
              <div
                role="columnheader"
                data-iris-table-header="__expand"
                style={{
                  ...baseCellStyle,
                  background: 'var(--iris-surface)',
                  borderBottom: borderStyle,
                }}
              />
            ) : null}
            {selectable === 'multi' ? (
              <div
                role="columnheader"
                data-iris-table-header=""
                style={{
                  ...baseCellStyle,
                  background: 'var(--iris-surface)',
                  borderBottom: borderStyle,
                  justifyContent: 'center',
                }}
              >
                <IrisCheckbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onChange={toggleAll}
                  aria-label={t('table.selectAll')}
                />
              </div>
            ) : selectable === 'single' ? (
              <div
                role="columnheader"
                data-iris-table-header=""
                style={{
                  ...baseCellStyle,
                  background: 'var(--iris-surface)',
                  borderBottom: borderStyle,
                }}
              />
            ) : null}
            {displayColumns.map((col, ci) => {
              if (visibleColSet && !visibleColSet.has(ci)) return null
              const multiIdx = multiSort ? multiSortState.findIndex((s) => s.key === col.key) : -1
              const isSortKey = multiSort ? multiIdx >= 0 : sort?.key === col.key
              const dir: IrisTableSortDirection | undefined = isSortKey
                ? multiSort
                  ? multiSortState[multiIdx]!.direction
                  : sort?.direction
                : undefined
              return (
                <div
                  key={col.key}
                  role="columnheader"
                  aria-sort={
                    isSortKey
                      ? dir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : col.sortable
                        ? 'none'
                        : undefined
                  }
                  tabIndex={col.sortable ? 0 : undefined}
                  onClick={
                    col.sortable
                      ? () => {
                          cycleHeaderSort(col)
                          setCurrentColumn(col)
                        }
                      : () => setCurrentColumn(col)
                  }
                  onKeyDown={col.sortable ? (e) => onHeaderKeyDown(e, col) : undefined}
                  data-iris-table-header={col.key}
                  data-iris-table-pinned={col.pinned}
                  data-iris-col-current={currentColumnKey === col.key ? 'true' : undefined}
                  data-iris-col-drag-active={colDragActive === col.key ? 'true' : undefined}
                  data-iris-col-drag-over={colDragOver === col.key ? 'true' : undefined}
                  onPointerDown={
                    columnDrag ? (e) => handleColDragPointerDown(e, col.key) : undefined
                  }
                  className={headerCellClassName?.(col)}
                  data-sortable={col.sortable ? 'true' : undefined}
                  data-sort-direction={dir}
                  style={{
                    ...baseCellStyle,
                    ...(visibleColSet ? { gridColumnStart: colTrack(ci) } : null),
                    justifyContent:
                      col.align === 'right'
                        ? 'flex-end'
                        : col.align === 'center'
                          ? 'center'
                          : 'flex-start',
                    background: 'var(--iris-surface)',
                    borderBottom: borderStyle,
                    cursor: col.sortable ? 'pointer' : 'default',
                    fontWeight: 600,
                    userSelect: col.sortable ? 'none' : 'auto',
                    ...(headerCellStyle?.(col) ?? null),
                    ...(editConfig?.showAsterisk && col.editRules?.some((r) => r.required)
                      ? { '::after': undefined }
                      : {}),
                    position: 'relative',
                    // Pinned header keeps a solid surface bg + sticky position
                    // (overrides position: relative above for the sticky edge).
                    ...(pinnedStyle(col.key)
                      ? { ...pinnedStyle(col.key), background: 'var(--iris-surface)' }
                      : null),
                  }}
                >
                  <span>
                    {col.titlePrefix}
                    {col.title}
                    {col.titleSuffix}
                  </span>
                  {col.sortable ? (
                    <span
                      aria-hidden="true"
                      data-iris-table-sort-indicator=""
                      style={{
                        marginInlineStart: 'var(--iris-space-xs, 8px)',
                        fontSize: 'var(--iris-font-size-xs, 12px)',
                        color: dir ? 'var(--iris-primary)' : 'var(--iris-muted)',
                      }}
                    >
                      {dir === 'asc' ? '↑' : dir === 'desc' ? '↓' : '↕'}
                    </span>
                  ) : null}
                  {renderFilterTrigger(col, true)}
                  {/* Multi mode: non-primary sort columns show their click-order
                    sequence number (vxe sort-config sequence parity). */}
                  {multiSort && multiIdx > 0 ? (
                    <span
                      data-iris-sort-seq=""
                      style={{
                        marginInlineStart: 'var(--iris-space-xxs, 4px)',
                        fontSize: 'var(--iris-font-size-xs, 12px)',
                        color: 'var(--iris-muted)',
                      }}
                    >
                      {multiIdx + 1}
                    </span>
                  ) : null}
                  {resizableColumns ? (
                    <ColumnResizeHandle
                      colKey={col.key}
                      label={col.title}
                      width={columnWidths[col.key]}
                      minWidth={col.minWidth ?? 60}
                      maxWidth={col.maxWidth ?? Infinity}
                      onResize={setColumnWidth}
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : null}

        {/* Body — state precedence: error → loading → empty → rows. */}
        {tableError ? (
          <div role="row" data-iris-table-row="error" style={STATE_ROW_STYLE}>
            <span style={{ marginInlineEnd: retry ? 'var(--iris-space-sm, 12px)' : 0 }}>
              {errorState ?? t('table.error')}
            </span>
            {retry ? (
              <button
                type="button"
                data-iris-table-retry=""
                onClick={retry}
                style={{
                  border: '1px solid var(--iris-border)',
                  background: 'var(--iris-surface)',
                  color: 'var(--iris-foreground)',
                  borderRadius: 'var(--iris-radius-sm, 4px)',
                  padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                  fontSize: 'var(--iris-font-size-sm, 13px)',
                  cursor: 'pointer',
                }}
              >
                {t('table.retry')}
              </button>
            ) : null}
          </div>
        ) : tableLoading ? (
          <div role="row" aria-busy="true" data-iris-table-row="loading" style={STATE_ROW_STYLE}>
            {loadingState ?? t('table.loading')}
          </div>
        ) : bodyData.length === 0 ? (
          <div role="row" data-iris-table-row="empty" style={STATE_ROW_STYLE}>
            {emptyState ?? t('table.empty')}
          </div>
        ) : virtualScroll && (!treeMode || !hasDetail) ? (
          // Virtualize flat mode, and tree mode too — tree rows are uniform height,
          // so the only thing that bars it is variable-height detail panels, hence
          // the `!hasDetail` guard. `bodyData` is the flattened visible rows (=
          // `sortedData` in flat mode); `flatTree?.[idx]` supplies each row's tree
          // meta (depth + toggle), with `idx` the absolute row index from the scroller.
          <IrisVirtualScroll
            items={bodyData}
            itemHeight={virtualScroll.itemHeight}
            height={virtualScroll.height}
            buffer={virtualScroll.buffer}
            keyOf={(row) => rowKeyOf(row)}
            renderItem={(row, idx) => renderRow(row, idx, { height: '100%' }, flatTree?.[idx])}
          />
        ) : (
          bodyData.map((row, idx) => {
            if (spanMethod && idx === 0) spanOccupyRef.current.clear()
            const main = renderRow(row, idx, undefined, flatTree?.[idx])
            if (
              !hasDetail ||
              !isRowExpandable(row, idx) ||
              !expandedKeys.includes(String(rowKeyOf(row)))
            )
              return main
            // Full-width detail panel beneath the row (spans all grid tracks).
            return (
              <React.Fragment key={`${String(rowKeyOf(row) ?? idx)}::wrap`}>
                {main}
                <div
                  role="row"
                  data-iris-table-row-detail={String(rowKeyOf(row) ?? idx)}
                  style={{ display: 'grid', gridTemplateColumns }}
                >
                  <div
                    role="cell"
                    data-iris-table-detail-cell=""
                    style={{ gridColumn: '1 / -1', padding: '8px 12px', borderBottom: borderStyle }}
                  >
                    {renderDetail!(row, idx)}
                  </div>
                </div>
              </React.Fragment>
            )
          })
        )}

        {/* Summary / footer row: each column with a `summary` op aggregates over
          the full sorted dataset (the core `aggregate` material). */}
        {!tableError &&
        !tableLoading &&
        bodyData.length > 0 &&
        leafColumns.some((c) => c.summary) ? (
          <div
            role="row"
            data-iris-table-row="summary"
            style={{
              display: 'grid',
              gridTemplateColumns,
              fontWeight: 600,
              borderTop: '2px solid var(--iris-border)',
              background: 'var(--iris-surface)',
            }}
          >
            {selectable !== 'none' ? (
              <div role="cell" data-iris-table-cell="__selection" style={baseCellStyle} />
            ) : null}
            {leafColumns.map((col, ci) => {
              if (visibleColSet && !visibleColSet.has(ci)) return null
              const op = col.summary
              const value = op ? aggregate(bodyData, (r) => getCellValue(r, col), op) : null
              return (
                <div
                  key={col.key}
                  role="cell"
                  data-iris-table-cell={col.key}
                  data-iris-table-summary-cell={op ? '' : undefined}
                  style={{ ...baseCellStyle, ...pinnedStyle(col.key) }}
                >
                  {op != null && value != null
                    ? col.renderSummary
                      ? col.renderSummary(value, bodyData)
                      : String(value)
                    : null}
                </div>
              )
            })}
          </div>
        ) : null}

        {/* Custom footer rows (vxe footer-data parity): one grid row per entry,
          rendered below the summary row. */}
        {!tableError && !tableLoading && footerData && footerData.length > 0 ? (
          <div data-iris-table-footer="" style={{ display: 'contents' }}>
            {footerData.map((footerRow, fi) => (
              <div
                key={String((footerRow as Record<string, unknown>)[rowKey] ?? fi)}
                role="row"
                data-iris-table-row={`footer-${fi}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns,
                  fontWeight: 600,
                  background: 'var(--iris-surface)',
                }}
              >
                {selectable !== 'none' ? (
                  <div role="cell" data-iris-table-cell="__selection" style={baseCellStyle} />
                ) : null}
                {leafColumns.map((col, ci) => {
                  if (visibleColSet && !visibleColSet.has(ci)) return null
                  const value = getCellValue(footerRow, col)
                  return (
                    <div
                      key={col.key}
                      role="cell"
                      data-iris-table-cell={col.key}
                      data-iris-table-footer-cell=""
                      className={footerCellClassName?.(col, fi)}
                      style={{
                        ...baseCellStyle,
                        justifyContent:
                          (col.align ?? (typeof value === 'number' ? 'right' : 'left')) === 'right'
                            ? 'flex-end'
                            : col.align === 'center'
                              ? 'center'
                              : 'flex-start',
                        ...(visibleColSet ? { gridColumnStart: colTrack(ci) } : null),
                        ...(footerCellStyle?.(col, fi) ?? null),
                      }}
                    >
                      {String(value ?? '')}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        ) : null}

        {/* Server-side pager (vxe-grid proxyConfig parity): driven by the
          controller's page/pageSize/total; page changes call setParams and
          proxyConfig.onPageChange. */}
        {contextMenu && contextMenuState ? (
          <TableContextMenu
            key={contextMenuSeq}
            open={contextMenuState.open}
            anchorRef={contextAnchorRef}
            items={contextMenuState.items}
            params={contextMenuState.params}
            onSelect={contextMenu.onSelect}
            onClose={closeContextMenu}
          />
        ) : null}
        {filterPanelState
          ? (() => {
              const fcol = displayColumns.find((c) => c.key === filterPanelState.colKey)
              if (!fcol || !fcol.filterable) return null
              return (
                <TableFilterPanel
                  key={filterPanelSeq}
                  open={filterPanelState.open}
                  anchorRef={filterAnchorRef}
                  columnKey={fcol.key}
                  options={fcol.filterOptions ?? []}
                  initialChecked={filterValues?.[fcol.key] ?? []}
                  onApply={applyFilterValues}
                  onClear={clearFilterValues}
                  onClose={closeFilterPanel}
                  t={t}
                />
              )
            })()
          : null}
        {proxy ? (
          <div
            data-iris-table-pager=""
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
              borderTop: borderStyle,
              background: 'var(--iris-surface)',
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--iris-space-xs, 8px)' }}
            >
              {pagerConfig?.pageSizes && pagerConfig.pageSizes.length > 0 ? (
                <IrisSelect
                  items={pagerConfig.pageSizes.map((s) => ({
                    value: String(s),
                    label: `${s} / ${t('table.page')}`,
                  }))}
                  value={String(proxyState.params.pageSize)}
                  onValueChange={(v) => {
                    const size = Number(v)
                    proxyRef.current?.setParams({ pageSize: size, page: 1 })
                    proxyConfig?.onPageChange?.(1, size)
                  }}
                  aria-label={t('table.pageSize')}
                />
              ) : null}
              <IrisPagination
                total={proxyState.total}
                pageSize={proxyState.params.pageSize}
                value={proxyState.params.page}
                onValueChange={(page) => {
                  proxyRef.current?.setParams({ page })
                  proxyConfig?.onPageChange?.(page, proxyState.params.pageSize)
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
