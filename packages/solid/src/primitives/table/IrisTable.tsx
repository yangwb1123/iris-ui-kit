import {
  createEffect,
  createMemo,
  createSignal,
  For,
  mergeProps,
  on,
  onCleanup,
  onMount,
  Show,
  type Accessor,
  type JSX,
} from 'solid-js'
import {
  buildFormValues,
  buildHeaderMatrix,
  applyTableMask,
  compareStates,
  computeVirtualRange,
  detectColumnType,
  flattenLeafColumns,
  flattenTree,
  mergeFormFilters,
  reconcileTreeRows,
  reorderTreeRows,
  withSortedChildren,
  nextGridCell,
  seedFormValues,
  tableDisplayText,
  toCsvRows,
  type GridNavKey,
  type DetectedColumnType,
  type HeaderCell,
  type RemoteTableSource,
  type TreeRow,
  validateEditRulesAsync,
  writeClipboardText,
} from '@iris-ui-kit/core'
import {
  useGridCore,
  useGridClipboard,
  useGridEditing,
  useGridExpansion,
  useGridFiltering,
  useGridRange,
  useGridRows,
  useGridSelection,
  useGridSorting,
} from '../../grid'
import { useI18n } from '../../i18n'
import { IrisVirtualScroll } from '../virtual-scroll/IrisVirtualScroll'
import type { IrisTableProps } from './props'
import type {
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableDensity,
  IrisTableContextMenuItem,
  IrisTableContextMenuParams,
  IrisTableSortState,
} from './types'
import { useTableProxy } from './useTableProxy'
import {
  TableContextMenu as TableOverlayContextMenu,
  TableFilterPanel as TableOverlayFilterPanel,
  resolveInitialWidth as resolveTableInitialWidth,
} from './table-overlay'
import { createMultiSortComparator, mergeFilterValues } from './table-helpers'
import { TableForm, TablePager, TableToolbar } from './table-chrome'
import { TableFlatHeader, TableGroupedHeader } from './table-header'
import { TableSummary } from './table-summary'
import { createTableDrag } from './table-drag'
import { computeTableResponsiveColumns } from './table-responsive'
import { TableScrollTop } from './table-scroll-top'
import { TableFilterTrigger } from './table-filter-trigger'
import { applyDetectedTableTypes } from './table-columns'
import { createTableRowTarget } from './table-row-target'
import { createPinnedDragMath } from './table-pinned-drag'
import { createTableViewsController, TableTabs, TableViews } from './table-views'
import { createTableUndoController } from './table-undo'
import { getCellValue as getTableCellValue } from './utils'
import { isEditableColumn, withComputedFormulaCells } from './utils'
import { exportCsv as serializeTableCsv } from './exportCsv'

export type { IrisTableProps } from './props'

const DEFAULT_MIN_WIDTH = 60
const DRAG_COL_WIDTH = 40

/** Read clipboard text; null when the browser API is unavailable or denied. */
async function readClipboardText(): Promise<string | null> {
  if (typeof navigator === 'undefined') return null
  const nav = navigator as Navigator & { clipboard?: { readText?: () => Promise<string> } }
  if (!nav.clipboard?.readText) return null
  try {
    return await nav.clipboard.readText()
  } catch {
    return null
  }
}

/** One open row-edit session (vxe editConfig.mode='row' parity): its own
 * draft/error pair, resolved at commit time against the current row. */
interface RowCellSession<Row extends Record<string, unknown>> {
  col: IrisTableColumn<Row>
  rowIndex: number
  draft: Accessor<string>
  error: Accessor<string | null>
  setDraft: (value: string) => void
  setError: (value: string | null) => void
  /** Monotonic session epoch (core `sessionGen` parity, batch AB fix): bumped
   * on cancel/commit so an in-flight async (editRules) commit can detect it
   * was cancelled or superseded while its validation promise was pending. */
  gen: number
}

/** Data table rendered as CSS grid with sorting, selection, editing, and
 * opt-in virtual windows for flat/tree rows. */
export function IrisTable<Row extends Record<string, unknown> = Record<string, unknown>>(
  props: IrisTableProps<Row>,
): JSX.Element {
  const merged = mergeProps(
    {
      rowKey: 'id',
      selectable: 'none' as 'none' | 'single' | 'multi',
      striped: false,
      bordered: true,
      loading: false,
      error: false,
      resizableColumns: false,
      keyboardNavigation: false,
      cellRange: false,
      editConfig: undefined as import('./types').IrisTableEditConfig | undefined,
      columnVirtualization: false,
      multiSort: false,
      scrollToTop: false,
      seq: false,
      undo: false,
    },
    props,
  )

  /** Resolve values with this table's own external-table scope. Keeping the
   * scope in this component closure prevents multiple Solid tables from
   * leaking formula references into one another. */
  const resolveTableCellValue = (row: Row, column: IrisTableColumn<Row>): unknown =>
    getTableCellValue(row, column, props.formulaTables)

  const { t } = useI18n()
  const [densityState, setDensityState] = createSignal<IrisTableDensity>('comfortable')
  const densityProp = (): IrisTableDensity =>
    merged.density === 'compact' || merged.density === 'cozy' ? merged.density : 'comfortable'
  const effectiveDensity = (): IrisTableDensity =>
    merged.densityToggle ? densityState() : densityProp()
  const cycleDensity = (): void => {
    setDensityState((current) =>
      current === 'comfortable' ? 'compact' : current === 'compact' ? 'cozy' : 'comfortable',
    )
  }

  const [responsiveWidth, setResponsiveWidth] = createSignal(0)
  const sourceDisplayColumns = createMemo<IrisTableColumn<Row>[]>(() => {
    const vis = props.columnVisibility
    if (vis === undefined) return merged.columns
    return merged.columns.filter((c) => vis[c.key] !== false)
  })
  const [detectedTypes, setDetectedTypes] = createSignal<Record<string, DetectedColumnType>>({})
  let detectTypesDone = false
  const detectedDisplayColumns = createMemo<IrisTableColumn<Row>[]>(() => {
    if (!merged.autoDetectTypes || Object.keys(detectedTypes()).length === 0) {
      return sourceDisplayColumns()
    }
    return applyDetectedTableTypes(sourceDisplayColumns(), detectedTypes())
  })
  const responsiveLeadingWidth = createMemo(
    () =>
      (merged.rowDrag ? DRAG_COL_WIDTH : 0) +
      (merged.seq ? 60 : 0) +
      (merged.renderDetail !== undefined ? 40 : 0) +
      (merged.selectable !== 'none' ? 40 : 0),
  )
  const responsiveWidthOf = (column: IrisTableColumn<Row>): number => {
    const width = widthOf(column)
    return Number.isFinite(width) && width >= 0 ? width : resolveTableInitialWidth(column)
  }
  const responsiveResult = createMemo(() =>
    merged.responsive
      ? computeTableResponsiveColumns(
          detectedDisplayColumns(),
          responsiveWidth(),
          responsiveLeadingWidth(),
          responsiveWidthOf,
        )
      : { columns: detectedDisplayColumns(), overflow: false },
  )
  const responsiveOverflow = createMemo(() => responsiveResult().overflow)
  const displayColumns = createMemo<IrisTableColumn<Row>[]>(() => responsiveResult().columns)

  const grouped = createMemo(() =>
    displayColumns().some((c) => c.children && c.children.length > 0),
  )
  const leafColumns = createMemo<IrisTableColumn<Row>[]>(() =>
    grouped() ? flattenLeafColumns(displayColumns()) : displayColumns(),
  )
  const headerMatrix = createMemo<HeaderCell<IrisTableColumn<Row>>[][] | null>(() =>
    grouped() ? buildHeaderMatrix(displayColumns()) : null,
  )

  const [internalWidths, setInternalWidths] = createSignal<IrisTableColumnWidths>({
    ...(props.defaultColumnWidths ?? {}),
  })
  const widthsControlled = (): boolean => props.columnWidths !== undefined
  const effectiveWidths = (): IrisTableColumnWidths =>
    widthsControlled() ? props.columnWidths! : internalWidths()
  const widthOf = (col: IrisTableColumn<Row>): number =>
    effectiveWidths()[col.key] ??
    resolveTableInitialWidth(col as IrisTableColumn<Record<string, unknown>>)
  const setColumnWidths = (next: IrisTableColumnWidths): void => {
    if (!widthsControlled()) setInternalWidths(next)
    merged.onColumnWidthsChange?.(next)
  }

  const pinnedDrag = createPinnedDragMath<Row>({
    enabled: () => merged.pinnedDrag,
    columns: leafColumns,
    widthOf,
    onColumnPinnedChange: merged.onColumnPinnedChange,
    onPinnedCountChange: merged.onPinnedCountChange,
  })
  const pinnedBoundaryKey = createMemo(pinnedDrag.boundaryKey)
  const resolvePinnedCount = pinnedDrag.resolvePinnedCount
  const commitPinnedCount = pinnedDrag.commitPinnedCount

  const hasProxy = (): boolean => props.proxyConfig !== undefined
  const remoteSort = (): boolean => props.proxyConfig?.remoteSort === true
  const remoteFilter = (): boolean => props.proxyConfig?.remoteFilter === true
  const proxyPresence = createMemo(() => hasProxy())
  let proxy: RemoteTableSource<Row> | null = null
  const { state: proxyState } = useTableProxy<Row>({
    props,
    proxyPresence,
    remoteSort,
    remoteFilter,
    multiSort: merged.multiSort,
    sort: props.sort,
    defaultSort: props.defaultSort,
    multiSortState: props.multiSortState,
    defaultMultiSort: props.defaultMultiSort,
    onProxyChange: (next) => {
      proxy = next
    },
  })
  const [proxyRows, setProxyRows] = createSignal<Row[]>([])
  createEffect(() => {
    setProxyRows(proxyState().data)
  })
  const [localRows, setLocalRows] = createSignal<Row[] | null>(null)
  createEffect(
    on(
      () => props.data,
      () => {
        if (localRows() !== null) setLocalRows(null)
      },
    ),
  )
  let lastProxyDataRef: Row[] | undefined
  createEffect(() => {
    const data = proxyState().data
    if (data !== lastProxyDataRef) {
      lastProxyDataRef = data
      if (localRows() !== null) setLocalRows(null)
    }
  })
  const baseData = createMemo<Row[]>(() => {
    if (localRows() !== null) return localRows()!
    if (hasProxy()) return proxyRows()
    return props.data ?? []
  })
  createEffect(() => {
    const enabled = merged.autoDetectTypes === true
    const rows = baseData()
    const sourceColumns = merged.columns
    if (!enabled || detectTypesDone || rows.length === 0) return
    detectTypesDone = true
    const next: Record<string, DetectedColumnType> = {}
    for (const column of flattenLeafColumns(sourceColumns).filter((c) => !c.formula)) {
      next[column.key] = detectColumnType(rows.map((row) => resolveTableCellValue(row, column)))
    }
    setDetectedTypes(next)
  })
  const tableLoading = createMemo<boolean>(() => {
    const s = proxyState()
    return hasProxy() ? s.loading : merged.loading
  })
  const tableError = createMemo<boolean>(() => {
    const s = proxyState()
    return hasProxy() ? s.error !== null : merged.error
  })

  const gridCore = useGridCore<Row>()
  // Grid Rows is the single mutation boundary for edits, paste, drag and
  // imperative row operations. The undo bridge is created after the table's
  // selection/root/editing state exists, so the transaction callback records
  // lazily without making undo part of the default path.
  let recordUndoRows: ((rows: Row[]) => void) | null = null
  let suppressUndoRecord = false
  // Solid updates keyed `<For>` rows immediately. While a row-mode editor is
  // open, defer the adapter's local signal write so committing one column does
  // not replace the row DOM under the remaining editors. The core rows model
  // is updated synchronously; the deferred signal flushes once the session
  // closes and therefore preserves both editor focus and row references.
  let rowEditingState: Accessor<{ k: string | number; idx: number } | null> | null = null
  let pendingLocalRows: Row[] | null = null
  let pendingLocalRowsTimer: ReturnType<typeof setTimeout> | null = null
  let liveRowsRef: Row[] = baseData()
  const [liveRevision, setLiveRevision] = createSignal(0)
  const flushPendingLocalRows = (): void => {
    if (pendingLocalRows === null || rowEditingState?.() !== null) return
    const next = pendingLocalRows
    pendingLocalRows = null
    setLocalRows(next)
  }
  const schedulePendingLocalRows = (): void => {
    if (pendingLocalRowsTimer !== null) return
    pendingLocalRowsTimer = setTimeout(() => {
      pendingLocalRowsTimer = null
      flushPendingLocalRows()
    }, 0)
  }
  onCleanup(() => {
    if (pendingLocalRowsTimer !== null) clearTimeout(pendingLocalRowsTimer)
  })
  const sorting = useGridSorting<Row>(gridCore, {
    mode: merged.multiSort ? 'multiple' : 'single',
    defaultSort: props.defaultSort,
    defaultMultiSort: props.defaultMultiSort,
    onSortChange: (next) => {
      merged.onSortChange?.(next)
      // remoteSort parity: sort changes re-query the server (page resets to 1
      // in the core controller, vxe behavior).
      if (remoteSort()) proxy?.setParams({ sort: next })
    },
    onMultiSortChange: (next) => {
      merged.onMultiSortChange?.(next)
      // remoteSort parity (multi mode): the FULL sort list re-queries the
      // server; the single `sort` param stays the single-column channel.
      if (remoteSort()) proxy?.setParams({ sorts: next })
    },
  })
  createEffect(() => {
    if (props.sort !== undefined) sorting.model.syncSort(props.sort ?? null)
    if (props.multiSortState !== undefined) sorting.model.syncMultiSort(props.multiSortState ?? [])
  })

  const effectiveSort = createMemo<IrisTableSortState | null>(() =>
    props.sort !== undefined ? (props.sort ?? null) : sorting.sort(),
  )
  const multiSortState = createMemo<IrisTableSortState[]>(() =>
    props.multiSortState !== undefined ? (props.multiSortState ?? []) : sorting.multiSort(),
  )
  const setSort = (next: IrisTableSortState | null): void => sorting.model.setSort(next)
  const cycleSort = (col: IrisTableColumn<Row>): void => {
    if (col.sortable) sorting.model.cycleSort(col.key)
  }
  const setMultiSort = (next: IrisTableSortState[]): void => sorting.model.setMultiSort(next)
  const cycleMultiSort = (col: IrisTableColumn<Row>): void => {
    if (col.sortable) sorting.model.cycleMultiSort(col.key)
  }
  const sortComparator = createMemo<((a: Row, b: Row) => number) | null>(() => {
    // Read the identity here even when no formula is currently sorted. A new
    // formulaTables record must rebuild the comparator and therefore the
    // sorted view, while in-place mutation remains outside the contract.
    const formulaTables = props.formulaTables
    return createMultiSortComparator(
      effectiveSort() ? [effectiveSort()!] : [],
      leafColumns(),
      (row, column) => getTableCellValue(row, column, formulaTables),
    )
  })
  const multiSortComparator = createMemo<((a: Row, b: Row) => number) | null>(() => {
    const formulaTables = props.formulaTables
    return createMultiSortComparator(multiSortState(), leafColumns(), (row, column) =>
      getTableCellValue(row, column, formulaTables),
    )
  })

  const tableViews = createTableViewsController({
    config: () => merged.views,
    sort: effectiveSort,
    setSort,
    onActiveViewChange: (key) => merged.onActiveViewChange?.(key),
  })

  const sortedRows = createMemo<Row[]>(() => {
    if (remoteSort()) return baseData()
    if (merged.multiSort) {
      const compare = multiSortComparator()
      if (!compare) return baseData()
      return [...baseData()].sort(compare)
    }
    const compare = sortComparator()
    return compare ? [...baseData()].sort(compare) : baseData()
  })
  const cycleHeaderSort = (col: IrisTableColumn<Row>): void => {
    if (merged.multiSort) cycleMultiSort(col)
    else cycleSort(col)
  }
  const handleHeaderClick = (column: IrisTableColumn<Row>): void => {
    cycleHeaderSort(column)
  }
  createEffect(() => {
    const present = proxyPresence()
    const single = effectiveSort()
    const multi = multiSortState()
    if (!present || !remoteSort()) return
    if (merged.multiSort) proxy?.setParams({ sorts: multi })
    else proxy?.setParams({ sort: single ?? null })
  })

  // Filtering state is feature-owned; formApplied remains adapter-owned
  // because form keystrokes are draft-only until submit/reset.
  const filtering = useGridFiltering<Row>(gridCore, {
    defaultFilters: props.filters,
    defaultFilterValues: props.filterValues,
    onFiltersChange: (next) => merged.onFiltersChange?.(next),
    onFilterValuesChange: (next) => merged.onFilterValuesChange?.(next),
  })
  createEffect(() => {
    if (props.filters !== undefined) filtering.model.syncFilters(props.filters)
    if (props.filterValues !== undefined) filtering.model.syncFilterValues(props.filterValues)
  })
  const effectiveFilters = createMemo<Record<string, string>>(() =>
    props.filters !== undefined ? props.filters : filtering.filters(),
  )
  const effectiveFilterValues = createMemo(() =>
    props.filterValues !== undefined ? props.filterValues : filtering.filterValues(),
  )

  const [formDraft, setFormDraft] = createSignal<Record<string, string>>(
    seedFormValues(props.formConfig?.fields),
  )
  const [formApplied, setFormApplied] = createSignal<Record<string, string>>({})
  const formFieldSignature = createMemo(() =>
    (props.formConfig?.fields ?? []).map((f) => `${f.key}=${f.defaultValue ?? ''}`).join('\u0000'),
  )
  createEffect(() => {
    // Re-seed only when the field signature actually changes.
    formFieldSignature()
    setFormDraft(seedFormValues(props.formConfig?.fields))
    setFormApplied({})
  })
  const setFormValue = (key: string, value: string): void => {
    setFormDraft((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }))
  }
  const mergedProxyFilters = (form: Record<string, string>): Record<string, string> =>
    mergeFormFilters(effectiveFilters(), form)
  const handleFormSubmit = (e: Event): void => {
    e.preventDefault()
    const values = buildFormValues(props.formConfig?.fields, formDraft())
    props.formConfig?.onSearch?.(values)
    setFormApplied(values)
    // Proxy mode: the server owns filtering — merge the form values into the
    // controller filters (page resets to 1 in core applyParams, vxe behavior).
    if (proxy) {
      void proxy.setParams({
        filters: mergeFilterValues(mergedProxyFilters(values), effectiveFilterValues()),
        page: 1,
      })
    }
  }
  const handleFormReset = (e: Event): void => {
    e.preventDefault()
    const defaults = seedFormValues(props.formConfig?.fields)
    setFormDraft(defaults)
    const values = buildFormValues(props.formConfig?.fields, defaults)
    setFormApplied(values)
    props.formConfig?.onReset?.(values)
    if (proxy) {
      // setParams returns false when the merged params are unchanged (e.g.
      // filters already cleared) — a reset must still re-query, so force a
      // refetch only in that no-op case (no double request when it changed).
      if (
        proxy.setParams({
          filters: mergeFilterValues(mergedProxyFilters(values), effectiveFilterValues()),
          page: 1,
        }) === false
      ) {
        void proxy.refetch()
      }
    }
  }
  // remoteFilter parity: hand the filter map to the server and never hide
  // rows client-side (vxe proxyConfig.filter). Form values are merged in so a
  // later `filters` prop change from the parent does not silently drop the
  // applied search. (Core setParams dedupes unchanged params.)
  createEffect(() => {
    const present = proxyPresence()
    const f = effectiveFilters()
    const applied = formApplied()
    if (!present || !remoteFilter()) return
    proxy?.setParams({
      filters: mergeFilterValues(mergeFormFilters(f, applied), effectiveFilterValues()),
    })
  })

  const rowId = (row: Row, index: number): string | number => {
    const v = row[merged.rowKey]
    if (typeof v === 'string' || typeof v === 'number') return v
    return index
  }

  // ---- Expandable detail rows ----
  // A leading toggle column + a full-width detail panel, driven by the
  // shared Grid Core expansion feature (multiple-open). Keys are strings. The
  // same expansion model is reused by tree mode (below) — they're mutually
  // exclusive (renderDetail vs getSubRows).
  const { model: gridRows } = useGridRows(gridCore, baseData(), {
    getRowKey: (row, index) => rowId(row, index),
    // Static tree children share the Core rows mutation boundary. Lazy
    // children remain adapter-owned because they live in a cache map.
    getChildren: props.getSubRows,
    onRowsChange: (transaction) => {
      const next = [...transaction.rows]
      liveRowsRef = next
      setLiveRevision((value) => value + 1)
      if (hasProxy()) setProxyRows(next)
      else if (rowEditingState?.() === null) setLocalRows(next)
      else {
        pendingLocalRows = next
        schedulePendingLocalRows()
      }
      if (!suppressUndoRecord) recordUndoRows?.(next)
    },
  })
  createEffect(() => {
    const rows = baseData()
    if (rows !== liveRowsRef) {
      liveRowsRef = rows
      setLiveRevision((value) => value + 1)
    }
    gridRows.sync(rows)
  })
  const hasDetail = (): boolean => props.renderDetail !== undefined
  const { model: expansion, expandedKeys } = useGridExpansion<Row, string>(gridCore, {
    mode: 'multiple',
    defaultValue: (props.defaultExpandedRowKeys ?? []).map(String),
    onChange: (keys) => props.onExpandedRowsChange?.(keys),
  })
  const isRowExpandable = (row: Row, idx: number): boolean =>
    hasDetail() && (props.rowExpandable ? props.rowExpandable(row, idx) : true)

  // ---- Tree rows ----
  // Opt-in via getSubRows: flatten the (root) data into the visible flat list,
  // honoring the (shared) expansion model. `bodyRows` is what the body, the
  // select-all set, and the summary aggregate over; in flat mode it is identical
  // to sortedRows() (each row carries no tree meta).
  // ---- Client-side filters (vxe filterConfig parity, local mode) ---------
  // Core substring semantics applied to the sorted data before tree flattening
  // (flat mode). With remoteFilter the server owns filtering — rows are never
  // hidden locally. The search form's applied values merge over the `filters`
  // prop (form wins, neither input is mutated); in proxy mode the server owns
  // form filtering, so only the prop map filters the loaded page. The result
  // is reference-preserving when no filter is active.
  const filteredData = createMemo<Row[]>(() => {
    if (remoteFilter()) return sortedRows()
    const mergedF = hasProxy()
      ? effectiveFilters()
      : mergeFormFilters(effectiveFilters(), formApplied())
    const active = Object.entries(mergedF).filter(([, v]) => v != null && v !== '')
    // Batch AB: per-column checked sets OR-match the raw String(value); a set
    // applies only when non-empty. AND-ed with the text channel below.
    const checkedEntries = Object.entries(effectiveFilterValues()).filter(
      ([, values]) => values.length > 0,
    )
    if (active.length === 0 && checkedEntries.length === 0) return sortedRows()
    return sortedRows().filter((row) => {
      const textOk = active.every(([key, value]) => {
        const col = displayColumns().find((c) => c.key === key)
        if (!col) return true
        const raw = resolveTableCellValue(row, col)
        if (col.filterMethod) return col.filterMethod(raw, row, value)
        return String(raw ?? '')
          .toLowerCase()
          .includes(value.toLowerCase())
      })
      const setsOk = checkedEntries.every(([key, values]) => {
        const col = displayColumns().find((c) => c.key === key)
        if (!col) return true
        return values.includes(String(resolveTableCellValue(row, col) ?? ''))
      })
      return textOk && setsOk
    })
  })
  // Tree children sort by the same comparator as the roots: multi mode chains
  // the multi comparator, single mode keeps the single one.
  const treeComparator = createMemo(() =>
    merged.multiSort ? multiSortComparator() : sortComparator(),
  )
  // ---- Lazy tree (vxe lazyLoad parity, batch J) ---------------------------
  // Children are fetched on first expand: `lazyLoad(row, load)`. The loaded
  // cache (plain closure, wins over `getSubRows`) drives flattenTree; the
  // loading SET is a signal because it drives the caret spinner on both
  // transitions (the cache map itself is not reactive).
  const lazyTree = (): boolean => props.lazyLoad !== undefined
  const [lazyLoading, setLazyLoading] = createSignal<Set<string>>(new Set())
  let lazyChildren = new Map<string, Row[]>()
  // Monotonic epoch, bumped whenever the data source reference changes (cache
  // + loading cleared wholesale): a stale fetch's result must never re-seed a
  // cleared cache, and must not clear a newer fetch's loading flag. Solid has
  // no re-render staleness, but the async callback closure still needs the
  // guard (react batch-K M2 parity).
  let lazyEpoch = 0
  let lastLazySourceRef: Row[] | undefined
  createEffect(() => {
    const source = hasProxy() ? proxyState().data : props.data
    if (source !== lastLazySourceRef) {
      lastLazySourceRef = source
      lazyEpoch++
      lazyChildren = new Map()
      setLazyLoading(new Set<string>())
    }
  })
  const lazyChildrenOf = (row: Row): Row[] | undefined => {
    const key = String(rowId(row, 0))
    return lazyChildren.get(key) ?? props.getSubRows?.(row)
  }
  const flatTree = createMemo<Array<TreeRow<Row>> | null>(() => {
    if (props.getSubRows === undefined && !lazyTree()) return null
    const keys = expandedKeys()
    const compare = treeComparator()
    // `lazyLoading` drives a re-walk when a lazy load lands (the ref-style
    // cache map is not reactive — react's lazyLoading-in-deps parity).
    lazyLoading()
    return flattenTree<Row>(filteredData(), {
      getKey: (r) => String(rowId(r, 0)),
      // With an active sort, sort each level's children by the same comparator
      // so the whole tree reorders hierarchically. Lazy-loaded children win
      // over `getSubRows` and still participate in the same sorting.
      getChildren: compare ? withSortedChildren(lazyChildrenOf, compare) : lazyChildrenOf,
      isExpanded: (k) => keys.includes(k),
    })
  })
  // Body rows paired with their tree meta (meta is null in flat mode).
  const bodyEntries = createMemo<Array<{ row: Row; meta: TreeRow<Row> | null }>>(() => {
    // Establish an explicit render dependency for formula results. Solid's
    // <For> preserves an unchanged row identity, so a new tables record must
    // also produce a fresh entry list for every displayed formula cell to
    // re-run; in-place mutation remains outside the immutable prop contract.
    const formulaTables = leafColumns().some((column) => column.formula)
      ? props.formulaTables
      : undefined
    const ft = flatTree()
    const entries = ft
      ? ft.map((t) => ({ row: t.row, meta: t }))
      : filteredData().map((row) => ({ row, meta: null }))
    return formulaTables === undefined ? entries : [...entries]
  })
  const bodyRows = createMemo<Row[]>(() => bodyEntries().map((e) => e.row))
  const materializedRows = (): Row[] =>
    withComputedFormulaCells(bodyRows(), leafColumns(), props.formulaTables)

  /** Map clipboard's effective-row projection back to the Core row source. */
  const reconcileClipboardRows = (
    sourceRows: readonly Row[],
    previousRows: readonly Row[],
    rows: readonly Row[],
  ): Row[] => {
    const visibleKeys = new Map<Row, string | number>()
    bodyRows().forEach((row, index) => visibleKeys.set(row, rowId(row, index)))
    const keyOf = (row: Row, index: number, source?: readonly Row[]): string | number => {
      const visibleKey = visibleKeys.get(row)
      if (visibleKey !== undefined) return visibleKey
      const sourceIndex = source?.indexOf(row) ?? -1
      return rowId(row, sourceIndex >= 0 ? sourceIndex : index)
    }
    const patches = new Map<string | number, Row>()
    rows.forEach((row, index) => {
      if (Object.is(row, previousRows[index])) return
      const previous = previousRows[index]
      if (!previous) return
      const sourceIndex = sourceRows.indexOf(previous)
      patches.set(keyOf(previous, sourceIndex >= 0 ? sourceIndex : index, sourceRows), row)
    })
    const getChildren = props.getSubRows
    if (getChildren) {
      return reconcileTreeRows(sourceRows, patches, {
        getRowKey: (row, index) => keyOf(row, index),
        getChildren,
      })
    }
    return sourceRows.map((row, index) => patches.get(keyOf(row, index, sourceRows)) ?? row)
  }

  // ---- Selection ----
  // Row-selection logic (single/multi toggle, dedup, select-all) is single-sourced
  // in the core model; the table keeps only its row-id mapping + rendering. Keyed
  // by string|number because row ids may be either.
  const selectionMode = merged.selectable === 'single' ? 'single' : 'multiple'
  const { model: selectionModel, selection } = useGridSelection<Row, string | number>(gridCore, {
    mode: selectionMode,
    value: props.selection,
    defaultValue: props.defaultSelection,
    onChange: (keys) => merged.onSelectionChange?.(keys),
  })

  // Controlled: mirror the prop into the model without re-emitting onChange.
  const selControlled = (): boolean => props.selection !== undefined
  createEffect(() => {
    if (selControlled()) selectionModel.sync(props.selection!)
  })

  // Controlled tables RENDER from the prop (true controlled semantics): a local
  // toggle emits onSelectionChange, but the displayed selection only changes when
  // the parent writes `selection` back — so a parent that validates/rejects a
  // change no longer sees the row flip optimistically. Uncontrolled renders from
  // the model store as before.
  const displaySelection = (): Array<string | number> => {
    // Subscribe to the model store even when controlled so a render read re-runs
    // after a (possibly-rejected) optimistic toggle — that re-asserts the prop's
    // value onto the native checkbox's `checked`, which the click mutated. The
    // returned value is always the prop in controlled mode.
    const store = selection()
    return selControlled() ? props.selection! : store
  }
  // Re-base the model on the controlled prop before a toggle so the emitted next
  // value is computed against what the parent actually holds (not a prior,
  // possibly-rejected, optimistic value).
  const rebaseToProp = (): void => {
    if (selControlled()) selectionModel.sync(props.selection!)
  }

  const isSelected = (id: string | number): boolean => displaySelection().includes(id)

  const allRowIds = createMemo(() => bodyRows().map((r, i) => rowId(r, i)))
  const allSelected = createMemo(() => {
    const sel = displaySelection()
    const ids = allRowIds()
    return selControlled()
      ? ids.length > 0 && ids.every((id) => sel.includes(id))
      : selectionModel.isAllSelected(ids)
  })
  const someSelected = createMemo(() => {
    const sel = displaySelection()
    return !allSelected() && allRowIds().some((id) => sel.includes(id))
  })

  const toggleRow = (id: string | number): void => {
    if (merged.selectable === 'none') return
    rebaseToProp()
    selectionModel.toggle(id)
  }

  const toggleAll = (): void => {
    rebaseToProp()
    selectionModel.toggleAll(allRowIds())
  }

  // ---- Inline Editing (cell mode is Grid Core-owned) ----
  const cellEditing = useGridEditing<Row>(gridCore, {
    getRowKey: (row, index) => rowId(row, index),
    getRowIndex: (rowKey) => {
      const index = bodyRows().findIndex((row, rowIndex) => Object.is(rowId(row, rowIndex), rowKey))
      return index >= 0 ? index : undefined
    },
    getRules: (columnKey) => leafColumns().find((column) => column.key === columnKey)?.editRules,
    getValue: (row, columnKey) => {
      const column = leafColumns().find((candidate) => candidate.key === columnKey)
      return column ? resolveTableCellValue(row, column) : row[columnKey]
    },
    setValue: (row, columnKey, value) => {
      const column = leafColumns().find((candidate) => candidate.key === columnKey)
      const key = (column?.dataIndex ?? column?.key ?? columnKey) as keyof Row
      return { ...row, [key]: value }
    },
    coerce: (draft, row, columnKey) => {
      const column = leafColumns().find((candidate) => candidate.key === columnKey)
      if (column?.editor !== 'number') return draft
      const text = String(draft ?? '')
      if (text === '' || Number.isNaN(Number(text))) {
        return column ? resolveTableCellValue(row, column) : draft
      }
      return Number(text)
    },
    validate: (value, row, columnKey) => {
      const column = leafColumns().find((candidate) => candidate.key === columnKey)
      return column?.validate?.(value, row) ?? null
    },
    isEditable: (_row, columnKey) => {
      const column = leafColumns().find((candidate) => candidate.key === columnKey)
      return Boolean(column && isEditableColumn(column))
    },
    onCommit: (commit) => {
      const column = leafColumns().find((candidate) => candidate.key === commit.columnKey)
      if (!column) return
      merged.onCellEdit?.({
        row: commit.row,
        column,
        oldValue: commit.oldValue,
        newValue: commit.value,
        rowIndex: commit.rowIndex,
      })
    },
  })
  const editingState = cellEditing.state
  const editingCellId = (): string | null => {
    const target = editingState().editing
    return target ? `${target.rowKey}::${target.columnKey}` : null
  }
  const editingColumnKey = (): string | null => editingState().editing?.columnKey ?? null
  const editingDraft = (): string => String(editingState().draft ?? '')
  const editError = (): string | null => editingState().error

  const beginEdit = (row: Row, column: IrisTableColumn<Row>, rowIdent: string | number): void => {
    if (!isEditableColumn(column)) return
    const current = resolveTableCellValue(row, column)
    cellEditing.startCellEdit(rowIdent, column.key, current == null ? '' : String(current))
  }

  const commitEdit = (_row: Row, _column: IrisTableColumn<Row>, _rowIndex: number): void => {
    cellEditing.commitCellEdit()
  }

  const cancelEdit = (): void => {
    cellEditing.cancelCellEdit()
  }

  function editPreviewText(row: Row, column: IrisTableColumn<Row>, draft: string): string {
    const raw =
      column.editor === 'number'
        ? draft === '' || Number.isNaN(Number(draft))
          ? resolveTableCellValue(row, column)
          : Number(draft)
        : draft
    const formatted = column.formatter?.(applyTableMask(raw, column), row)
    return String(formatted ?? '')
  }

  // ---- Row edit mode (vxe editConfig.mode='row' parity) -------------------
  // One session per editable column of the clicked row, each with its own
  // draft/error pair through the same bespoke machinery cell mode uses. The
  // session Map is a signal so the cell render reacts; sessions live in plain
  // closures (their own signals) and are dropped wholesale on cancel.
  const rowMode = (): boolean => merged.editConfig?.mode === 'row'
  const [rowEditing, setRowEditing] = createSignal<{ k: string | number; idx: number } | null>(null)
  rowEditingState = rowEditing
  const [rowSessions, setRowSessions] = createSignal<Map<string, RowCellSession<Row>>>(new Map())
  const rowEditorRefs = new Map<string, HTMLInputElement>()

  const createRowSession = (
    row: Row,
    col: IrisTableColumn<Row>,
    rowIndex: number,
  ): RowCellSession<Row> => {
    const current = resolveTableCellValue(row, col)
    const [draft, setDraft] = createSignal<string>(current == null ? '' : String(current))
    const [error, setError] = createSignal<string | null>(null)
    return { col, rowIndex, draft, error, setDraft, setError, gen: 0 }
  }

  const currentRowFor = (key: string | number, fallback: Row): Row =>
    gridRows.find(key) ??
    liveRowsRef.find((candidate, index) => rowId(candidate, index) === key) ??
    fallback

  // Commit ONE column's session: validate (editRules async → in-flight),
  // write back, then close just that editor (per-cell commit — the rest of
  // the row stays open). Returns false only on a SYNC validation failure
  // (keeps the row open with the error visible).
  const commitRowSession = (
    session: RowCellSession<Row>,
    row: Row,
    rowIdent: string | number,
  ): boolean => {
    const col = session.col
    const rowIndex = session.rowIndex
    const id = `${rowIdent}::${col.key}`
    // Liveness guard (batch AD, browser-blur hardening): a committed or
    // cancelled session must never re-commit. The editor's onBlur can fire
    // AFTER the session left the map (input unmount on close/cancel — e.g.
    // Escape-then-blur, Enter-then-blur in real browsers), which would
    // otherwise start a FRESH commit on the stale session object (double
    // onCellEdit / write-back after Escape).
    if (!rowSessions().has(id)) return true
    const currentRow = currentRowFor(rowIdent, row)
    const oldValue = resolveTableCellValue(currentRow, col)
    const draftValue = session.draft()
    const newValue =
      col.editor === 'number'
        ? draftValue === '' || Number.isNaN(Number(draftValue))
          ? oldValue
          : Number(draftValue)
        : draftValue
    const close = (): void => {
      setRowSessions((prev) => {
        if (!prev.has(id)) return prev
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    }
    const finish = (): void => {
      session.setError(null)
      close()
      if (newValue !== oldValue) {
        merged.onCellEdit?.({ row: currentRow, column: col, oldValue, newValue, rowIndex })
        // Row-mode sessions bypass the core editing feature, so write their
        // immutable replacement through the rows transaction for both local
        // and proxy tables. The transaction callback also records one undo
        // snapshot and keeps `dataIndex` separate from the display key.
        const valueKey = (col.dataIndex ?? col.key) as string
        gridRows.update(rowIdent, { [valueKey]: newValue } as Partial<Row>, {
          reason: 'cell-edit',
        })
      }
    }
    if (col.editRules && col.editRules.length > 0) {
      const gen = ++session.gen
      const context = { rows: baseData(), columnKey: col.key }
      void validateEditRulesAsync(col.editRules, draftValue, row, false, context).then((r) => {
        if (gen !== session.gen) return // cancelled / superseded while pending
        if (!r.valid) {
          session.setError(r.messages[0] ?? null)
          return
        }
        finish()
      })
      return true
    }
    if (col.validate) {
      const error = col.validate(newValue, row)
      if (error) {
        session.setError(error)
        return false
      }
    }
    session.gen++ // a landed commit supersedes any pending async commit
    finish()
    return true
  }

  const focusRowEditor = (colKey: string): void => {
    queueMicrotask(() => rowEditorRefs.get(colKey)?.focus())
  }

  const beginRowEdit = (row: Row, rowIndex: number, focusColKey?: string): void => {
    const k = rowId(row, rowIndex)
    const editableCols = leafColumns().filter(isEditableColumn)
    if (editableCols.length === 0) return
    const sessions = new Map<string, RowCellSession<Row>>()
    for (const col of editableCols) {
      sessions.set(`${k}::${col.key}`, createRowSession(row, col, rowIndex))
    }
    setRowSessions(sessions)
    setRowEditing({ k, idx: rowIndex })
    // Focus the clicked column's editor when it exists, else the first
    // editable column (the editors mount on the next render).
    const focusKey =
      focusColKey && editableCols.some((c) => c.key === focusColKey)
        ? focusColKey
        : editableCols[0]!.key
    focusRowEditor(focusKey)
  }

  /** Escape: cancel EVERY open session of the row (the whole row, vxe parity). */
  const cancelRowEdit = (): void => {
    // Drop any in-flight async commit: Escape cancels the WHOLE row, and a
    // pending validation must NOT write back (core `sessionGen` parity).
    for (const s of rowSessions().values()) s.gen++
    setRowSessions(new Map())
    setRowEditing(null)
  }

  /** Clicking another row (or starting a new row): commit each open session;
   *  a SYNC validation failure keeps the row open with the error visible.
   *  Async-validating sessions commit in the background and land whenever
   *  they resolve (per-cell commit, vxe row mode parity). */
  const switchRowEdit = (row: Row, rowIndex: number, focusColKey?: string): void => {
    const cur = rowEditing()
    if (cur !== null) {
      for (const session of rowSessions().values()) {
        // Resolve static tree descendants through the shared Core rows model;
        // lazy/proxy descendants remain in the adapter-owned visible snapshot.
        const currentRow =
          gridRows.find(cur.k) ?? bodyRows().find((r, i) => rowId(r, i) === cur.k) ?? row
        if (!commitRowSession(session, currentRow, cur.k)) return
      }
    }
    beginRowEdit(currentRowFor(rowId(row, rowIndex), row), rowIndex, focusColKey)
  }

  // All open sessions committed → the row leaves edit mode (click re-opens).
  createEffect(() => {
    const cur = rowEditing()
    if (cur !== null && rowSessions().size === 0) setRowEditing(null)
  })
  createEffect(() => {
    if (rowEditing() === null && pendingLocalRows !== null) schedulePendingLocalRows()
  })

  /** A row-mode cell click: same row reopens a committed column; a different
   *  row commits the current row's open editors first (vxe
   *  click-elsewhere-commits parity). */
  const handleRowCellClick = (
    row: Row,
    col: IrisTableColumn<Row>,
    rowIndex: number,
    k: string | number,
  ): void => {
    const currentRow = currentRowFor(k, row)
    if (rowEditing()?.k === k) {
      const id = `${k}::${col.key}`
      if (isEditableColumn(col) && !rowSessions().has(id)) {
        const session = createRowSession(currentRow, col, rowIndex)
        setRowSessions((prev) => {
          const next = new Map(prev)
          next.set(id, session)
          return next
        })
        focusRowEditor(col.key)
      }
    } else {
      switchRowEdit(currentRow, rowIndex, col.key)
    }
  }

  /** Tab between the row's editors: commit THAT column, focus the next
   *  editable one. Sync failure stays on the editor with the error. */
  const handleRowTab = (
    row: Row,
    col: IrisTableColumn<Row>,
    session: RowCellSession<Row>,
    rowIdent: string | number,
    dir: 1 | -1,
  ): void => {
    if (!commitRowSession(session, row, rowIdent)) return
    const cols = leafColumns()
    const start = cols.indexOf(col)
    for (let i = start + dir; i >= 0 && i < cols.length; i += dir) {
      const nextCol = cols[i]!
      if (!isEditableColumn(nextCol)) continue
      focusRowEditor(nextCol.key)
      return
    }
  }

  const tableDrag = createTableDrag<Row>({
    rowDrag: () => merged.rowDrag,
    columnDrag: () => merged.columnDrag,
    root: () => rootRef,
    rows: bodyRows,
    columns: leafColumns,
    rowId,
    reorderRows: (activeId, overId) => {
      // Lazy children are adapter-owned and cannot safely be flattened into
      // roots, even when a static accessor is also supplied (the cache wins
      // in that mode). Flat tables retain the previous visible-list reorder.
      if (props.lazyLoad !== undefined) return null
      const getChildren = props.getSubRows
      if (getChildren !== undefined) {
        // A static tree must be reordered in the source tree. The visible
        // flattened list is only a drag projection and must never be
        // committed as roots. A cross-parent drop is rejected until a
        // re-parenting contract can describe the destination path.
        const visibleKeys = new Map(
          bodyRows().map((row, index) => [row, String(rowId(row, index))]),
        )
        const visibleRows = bodyRows()
        const fromVisible = visibleRows.findIndex(
          (row, index) => String(rowId(row, index)) === activeId,
        )
        const toVisible = visibleRows.findIndex(
          (row, index) => String(rowId(row, index)) === overId,
        )
        if (fromVisible < 0 || toVisible < 0) return null
        const result = reorderTreeRows(
          gridRows.get(),
          activeId,
          overId,
          {
            // Every drop target is visible; leave hidden descendants keyless so
            // a synthetic sibling index cannot mask a visible target when no
            // rowKey is configured.
            getRowKey: (row) => visibleKeys.get(row),
            getChildren,
          },
          fromVisible < toVisible ? 'after' : 'before',
        )
        return result.changed ? result.rows : null
      }
      const rows = [...bodyRows()]
      const from = rows.findIndex((row, index) => String(rowId(row, index)) === activeId)
      const to = rows.findIndex((row, index) => String(rowId(row, index)) === overId)
      if (from < 0 || to < 0 || from === to) return null
      const [moved] = rows.splice(from, 1)
      rows.splice(to, 0, moved!)
      return rows
    },
    onDataChange: (rows) => {
      gridRows.commit(rows, { reason: 'row-drag' })
      merged.onDataChange?.(rows)
    },
  })
  const rowDragActive = tableDrag.rowActive
  const rowDragOver = tableDrag.rowOver
  const colDragActive = tableDrag.columnActive
  const colDragOver = tableDrag.columnOver
  const handleRowDragPointerDown = tableDrag.onRowPointerDown
  const handleRowDragPointerMove = tableDrag.onRowPointerMove
  const handleRowDragPointerUp = tableDrag.onRowPointerUp
  const handleRowDragPointerLeave = tableDrag.onRowPointerLeave
  const handleColDragPointerDown = tableDrag.onColumnPointerDown
  const handleColDragPointerMove = tableDrag.onColumnPointerMove
  const handleColDragPointerUp = tableDrag.onColumnPointerUp

  // ---- Right-click context menu (vxe contextMenu parity) ------------------
  // Transient state: items + params are computed ONCE per open from the
  // callback; the cursor coordinates live in a virtual floating anchor (a
  // fake element whose getBoundingClientRect returns the zero-size cursor
  // rect). Each open builds a FRESH anchor object, so the positioning effect
  // re-runs on the new identity (no remount token needed).
  const [contextMenuState, setContextMenuState] = createSignal<{
    open: boolean
    items: IrisTableContextMenuItem[]
    params: IrisTableContextMenuParams<Row>
  } | null>(null)
  const [contextAnchor, setContextAnchor] = createSignal<HTMLElement | null>(null)
  const closeContextMenu = (): void => {
    setContextMenuState((prev) => (prev ? { ...prev, open: false } : prev))
  }

  // ---- Header filter panel (vxe filterConfig parity) ----------------------
  // One panel at a time, keyed by the column whose trigger was clicked. The
  // anchor is the trigger BUTTON itself (a real DOM node), captured at click
  // time. The panel renders inside a keyed Show on the state object identity,
  // so each open remounts it and the draft checkbox state re-seeds from the
  // applied `filterValues`.
  const [filterPanelState, setFilterPanelState] = createSignal<{
    open: boolean
    colKey: string
  } | null>(null)
  const [filterAnchor, setFilterAnchor] = createSignal<HTMLButtonElement | null>(null)
  const closeFilterPanel = (): void => {
    setFilterPanelState((prev) => (prev ? { ...prev, open: false } : prev))
  }
  const openFilterPanel = (e: MouseEvent, colKey: string): void => {
    // Never let the trigger click reach the header cell (which would sort).
    e.stopPropagation()
    setFilterAnchor(e.currentTarget as HTMLButtonElement)
    setFilterPanelState({ open: true, colKey })
  }
  const applyFilterValues = (colKey: string, values: string[]): void => {
    filtering.model.setFilterValues({ ...effectiveFilterValues(), [colKey]: values })
  }
  const clearFilterValues = (colKey: string): void => {
    filtering.model.clearColumnFilterValues(colKey)
  }

  const handleContextMenu = (
    e: MouseEvent,
    row: Row,
    col: IrisTableColumn<Row>,
    idx: number,
    ci: number,
  ): void => {
    if (!merged.contextMenu) return
    e.preventDefault()
    // Virtual anchor: zero-size rect at the cursor. The object is rebuilt per
    // open (capturing this event's coordinates) so the panel always lands at
    // the cursor.
    const virtualAnchor = {
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
    setContextAnchor(virtualAnchor)
    const params: IrisTableContextMenuParams<Row> = {
      row,
      column: col,
      rowIndex: idx,
      columnIndex: ci,
    }
    setContextMenuState({ open: true, items: merged.contextMenu!.items(params), params })
  }

  const renderFilterTrigger = (col: IrisTableColumn<Row>, leaf: boolean): JSX.Element => (
    <TableFilterTrigger
      column={col}
      leaf={leaf}
      active={(effectiveFilterValues()[col.key]?.length ?? 0) > 0}
      open={filterPanelState()?.open === true && filterPanelState()?.colKey === col.key}
      label={t('table.filter')}
      onOpen={(event) => openFilterPanel(event, col.key)}
    />
  )

  let rootRef: HTMLDivElement | undefined
  const rowTarget = createTableRowTarget(() => rootRef)
  const { scrollTo: scrollToRow, goTo: goToRow } = rowTarget
  onCleanup(rowTarget.dispose)

  // Built-in row-list undo/redo. Ordinary user mutations are observed at the
  // Grid Rows transaction throat above; replay and explicit commits use this
  // guarded funnel so an undo/redo never records itself as a fresh step.
  const setTableRows = (rows: Row[]): void => {
    suppressUndoRecord = true
    try {
      gridRows.commit(rows)
    } finally {
      suppressUndoRecord = false
    }
  }
  const undoController = createTableUndoController(
    () => merged.undo === true,
    () => baseData(),
    () => (hasProxy() ? proxyState().data : (props.data ?? [])),
    setTableRows,
    (rows) => merged.onDataChange?.(rows),
    () => rootRef,
    () => editingCellId() !== null || rowEditing() !== null,
    {
      current: displaySelection,
      enabled: () => merged.selectable !== 'none',
      keyOf: rowId,
      rebase: rebaseToProp,
      set: (keys) => selectionModel.set(keys),
    },
  )
  recordUndoRows = undoController.record

  const tableHandle = {
    loadData: (rows: Row[]): void => {
      gridRows.loadData(rows)
      merged.onDataChange?.(rows)
    },
    reloadData: (): void => {
      if (proxy) {
        setLocalRows(null)
        void proxy.refetch()
      }
    },
    commitProxy: (overrides: Partial<import('./types').IrisTableProxyQueryParams>): void => {
      proxy?.setParams(overrides)
    },
    getProxyInfo: (): { page: number; pageSize: number; total: number } | null => {
      const s = proxy?.getState()
      return s ? { page: s.params.page, pageSize: s.params.pageSize, total: s.total } : null
    },
    clearSort: (): void => {
      if (merged.multiSort) setMultiSort([])
      else setSort(null)
    },
    clearFilter: (): void => {
      filtering.model.clear()
    },
    removeRows: (keys: Array<string | number>): void => {
      const removedKeys = gridRows.removeMany(keys)
      if (removedKeys.length === 0) return
      const rows = gridRows.get()
      const selectedNow = selection()
      const removed = new Set(removedKeys)
      const nextSelection = selectedNow.filter((key) => !removed.has(key))
      if (nextSelection.length !== selectedNow.length) {
        if (selControlled()) selectionModel.sync(props.selection ?? [])
        selectionModel.set(nextSelection)
      }
      merged.onDataChange?.(rows)
    },
    getFilteredData: (): Row[] => [...bodyRows()],
    exportCurrentViewCsv: (): string => serializeTableCsv(materializedRows(), leafColumns()),
    exportMultiCsv: (): string => {
      const current = serializeTableCsv(materializedRows(), leafColumns())
      const names = props.exportNames
      if (!names || names.length === 0) return current
      const segments = [`# current${current ? `\n${current}` : ''}`]
      for (const entry of names) {
        if (!entry.key) continue
        const refCsv = toCsvRows(entry.ref())
        segments.push(`# ${entry.key}${refCsv ? `\n${refCsv}` : ''}`)
      }
      return segments.join('\n\n')
    },
    compareStates,
    scrollToRow,
    goToRow,
  }
  onMount(() => {
    if (props.tableRef) props.tableRef.current = tableHandle
  })

  const [focusedCell, setFocusedCell] = createSignal<{ row: number; col: number } | null>(null)
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
  const handleGridKey = (e: KeyboardEvent): void => {
    if (!merged.keyboardNavigation || !GRID_NAV_KEYS.has(e.key)) return
    // Only navigate from a grid cell — never hijack arrows inside an editing
    // cell's <input> (which carries no data-grid-row).
    const target = e.target as HTMLElement
    if (target.dataset.gridRow === undefined) return
    e.preventDefault()
    const current = focusedCell() ?? { row: 0, col: 0 }
    const next = nextGridCell(current, e.key as GridNavKey, {
      rowCount: bodyRows().length,
      colCount: leafColumns().length,
      pageSize: 10,
    })
    setFocusedCell(next)
    const cell = rootRef?.querySelector<HTMLElement>(
      `[data-grid-row="${next.row}"][data-grid-col="${next.col}"]`,
    )
    cell?.focus()
  }
  const { model: cellRangeCtrl, range: activeCellRange } = useGridRange(gridCore)
  const { serialize: serializeGridRange, paste: pasteGridRange } = useGridClipboard<Row>(gridCore, {
    getRows: bodyRows,
    getColumns: () => leafColumns(),
    rowKeyField: merged.rowKey,
    resolveValue: (row, column) => resolveTableCellValue(row, column as IrisTableColumn<Row>),
    setValue: (row, column, value) => ({
      ...row,
      [(column.dataIndex ?? column.key) as string]: value,
    }),
    isCellEditable: (_row, column) => !(column as IrisTableColumn<Row>).formula,
    reconcileRows: reconcileClipboardRows,
    onPaste: (change) => merged.onDataChange?.([...change.rows]),
  })

  const isInRange = (row: number, col: number): boolean => {
    const range = activeCellRange()
    if (!range) return false
    return (
      row >= range.start.row &&
      row <= range.end.row &&
      col >= range.start.col &&
      col <= range.end.col
    )
  }
  const handleCellRangeKey = (e: KeyboardEvent): void => {
    if (!merged.cellRange) return
    if (e.key === 'Escape') {
      cellRangeCtrl.clearRange()
      return
    }
    const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
    if (!e.shiftKey || !ARROW_KEYS.has(e.key)) return
    const target = e.target as HTMLElement
    const rowAttr = target.dataset.irisCellRow
    const colAttr = target.dataset.irisCellCol
    if (rowAttr === undefined || colAttr === undefined) return
    e.preventDefault()
    const anchor = cellRangeCtrl.getState().anchor
    const active = anchor
      ? (cellRangeCtrl.getState().active ?? { row: Number(rowAttr), col: Number(colAttr) })
      : { row: Number(rowAttr), col: Number(colAttr) }
    let nextRow = active.row
    let nextCol = active.col
    if (e.key === 'ArrowUp') nextRow = Math.max(0, nextRow - 1)
    else if (e.key === 'ArrowDown') nextRow = Math.min(bodyRows().length - 1, nextRow + 1)
    else if (e.key === 'ArrowLeft') nextCol = Math.max(0, nextCol - 1)
    else nextCol = Math.min(leafColumns().length - 1, nextCol + 1)
    cellRangeCtrl.extendRange(nextRow, nextCol)
  }

  const copyActiveRange = (): void => {
    const range = activeCellRange()
    if (!range || merged.clipConfig?.copy === false) return
    const text = serializeGridRange(
      merged.clipConfig?.copyFormat,
      merged.clipConfig?.copyWithFormat === true,
    )
    if (text !== null) void writeClipboardText(text)
  }
  const pasteActiveRange = (range: {
    start: { row: number; col: number }
    end: { row: number; col: number }
  }): void => {
    void readClipboardText().then((text) => {
      if (text !== null) pasteGridRange(text, range)
    })
  }
  const handleClipboardKey = (e: KeyboardEvent): void => {
    if (!merged.cellRange || !merged.clipConfig || e.defaultPrevented) return
    if (!e.ctrlKey && !e.metaKey) return
    const key = e.key.toLowerCase()
    const range = activeCellRange()
    if (!range) return
    if (key === 'c') {
      if (merged.clipConfig.copy === false) return
      e.preventDefault()
      copyActiveRange()
    } else if (key === 'v') {
      if (merged.clipConfig.paste === false) return
      e.preventDefault()
      pasteActiveRange(range)
    }
  }

  const SELECTION_COL_WIDTH = 40
  const EXPAND_COL_WIDTH = 40
  const SEQ_COL_WIDTH = 60
  const gridTemplate = createMemo(() => {
    const parts: string[] = []
    if (merged.rowDrag) parts.push(`${DRAG_COL_WIDTH}px`)
    if (merged.seq) parts.push(`${SEQ_COL_WIDTH}px`)
    if (hasDetail()) parts.push(`${EXPAND_COL_WIDTH}px`)
    if (merged.selectable !== 'none') parts.push(`${SELECTION_COL_WIDTH}px`)
    for (const col of leafColumns()) {
      const w = effectiveWidths()[col.key]
      // React parity (batch AF): a width-less column renders `minmax(0, 1fr)`
      // (fills the container); explicit widths, resized values and
      // `width: 'auto'` keep their tracks. `widthOf` keeps the numeric
      // `resolveInitialWidth` fallback for resize/virtualization math.
      if (w != null) parts.push(`${w}px`)
      else if (typeof col.width === 'number') parts.push(`${col.width}px`)
      else if (col.width === 'auto') parts.push('minmax(max-content, max-content)')
      else if (typeof col.width === 'string') parts.push(col.width)
      else parts.push('minmax(0, 1fr)')
    }
    return parts.join(' ')
  })

  // ---- Column virtualization (opt-in via `columnVirtualization`) ----
  // Render only the horizontally-visible columns (+ pinned + overscan) for very
  // wide tables. The root becomes a horizontal scroll container; off-screen grid
  // tracks stay sized via `gridTemplateColumns`, and each rendered cell is placed
  // on its 1-based grid track (`colTrack`) so it lands correctly even when
  // earlier cells are skipped. Off by default → `visibleColSet()` is null and
  // every column renders unchanged.
  const [scrollLeft, setScrollLeft] = createSignal(0)
  const [viewportWidth, setViewportWidth] = createSignal(0)

  // 1-based grid track for a column index, after the optional drag + seq +
  // detail + selection tracks, so a windowed cell lands in the right place.
  const colTrack = (i: number): number =>
    (merged.rowDrag ? 1 : 0) +
    (merged.seq ? 1 : 0) +
    (hasDetail() ? 1 : 0) +
    (merged.selectable !== 'none' ? 1 : 0) +
    1 +
    i

  onMount(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById('iris-table-row-styles')) return
    const style = document.createElement('style')
    style.id = 'iris-table-row-styles'
    style.textContent = `
[data-iris-table] [role="row"]:hover {
  --iris-row-bg: var(--iris-surface-hover);
}
[data-iris-table-row-selected="true"] {
  --iris-row-bg: var(--iris-surface-selected);
}
/* Row edit mode (vxe editConfig.mode parity): the row whose editors are
   open gets the same token-driven highlight as the selected row. */
[data-iris-table-row][data-iris-row-editing="true"] {
  --iris-row-bg: var(--iris-surface-selected);
}
@media print { [data-iris-table-tabs], [data-iris-table-toolbar], [data-iris-table-form], [data-iris-scroll-hint] { display: none !important; } [data-iris-table][data-printable="true"] { border: none !important; box-shadow: var(--iris-shadow-none, none) !important; } }
[data-iris-table][data-density="compact"] [data-iris-table-cell],
[data-iris-table][data-density="compact"] [data-iris-table-header],
[data-iris-table][data-density="compact"] [data-iris-table-summary-cell],
[data-iris-table][data-density="compact"] [data-iris-table-footer-cell] { padding-block: 6px !important; }
[data-iris-table][data-density="cozy"] [data-iris-table-cell],
[data-iris-table][data-density="cozy"] [data-iris-table-header],
[data-iris-table][data-density="cozy"] [data-iris-table-summary-cell],
[data-iris-table][data-density="cozy"] [data-iris-table-footer-cell] { padding-block: 4px !important; }
[data-iris-row-target="true"] {
  --iris-cell-bg: color-mix(in srgb, var(--iris-primary) 18%, var(--iris-background));
  background: color-mix(in srgb, var(--iris-primary) 18%, var(--iris-background));
}
/* Lazy tree loading caret (vxe lazyLoad parity, batch J): keyframes can't
   be inline, so they live in the singleton stylesheet; opacity + spin use
   token-driven values. */
@keyframes iris-table-caret-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
[data-iris-table-tree-toggle][data-iris-tree-loading] {
  opacity: 0.55;
  animation: iris-table-caret-spin 900ms linear infinite;
}
[data-iris-table-context-menu] [role="menuitem"]:hover:not(:disabled) {
  background: var(--iris-surface-hover);
}
`
    document.head.appendChild(style)
  })
  onMount(() => {
    if (!merged.responsive || !rootRef) return
    const el = rootRef
    const measure = (): void => {
      setResponsiveWidth(el.clientWidth)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    onCleanup(() => ro.disconnect())
  })
  onMount(() => {
    if (!merged.columnVirtualization || !rootRef) return
    const el = rootRef
    const measure = (): void => {
      setViewportWidth(el.clientWidth)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    onCleanup(() => ro.disconnect())
  })

  // Set of column indices to render: the visible window + overscan, always
  // unioned with pinned columns. `null` ⇒ render every column (feature off).
  const visibleColSet = createMemo<Set<number> | null>(() => {
    if (!merged.columnVirtualization) return null
    const cols = leafColumns()
    const w = computeVirtualRange({
      itemCount: cols.length,
      scrollTop: scrollLeft(),
      viewportSize: viewportWidth(),
      itemSize: (i) => widthOf(cols[i]),
      buffer: 2,
    })
    const set = new Set<number>()
    for (let i = w.startIndex; i <= w.endIndex; i += 1) set.add(i)
    cols.forEach((col, i) => {
      if (col.pinned) set.add(i)
    })
    return set
  })

  // Active sort info for a column: multi mode reads the click-order list,
  // single mode the single-column state.
  const sortInfo = (
    col: IrisTableColumn<Row>,
  ): { isActive: boolean; dir: 'asc' | 'desc' | null } => {
    const multiIdx = merged.multiSort ? multiSortState().findIndex((s) => s.key === col.key) : -1
    const isActive = merged.multiSort ? multiIdx >= 0 : effectiveSort()?.key === col.key
    const dir = isActive
      ? merged.multiSort
        ? multiSortState()[multiIdx]!.direction
        : effectiveSort()!.direction
      : null
    return { isActive, dir }
  }
  const sortAria = (col: IrisTableColumn<Row>): 'none' | 'ascending' | 'descending' | undefined => {
    const { isActive, dir } = sortInfo(col)
    if (!isActive) return col.sortable ? 'none' : undefined
    return dir === 'asc' ? 'ascending' : 'descending'
  }
  const sortIndicator = (col: IrisTableColumn<Row>): JSX.Element => {
    if (!col.sortable) return <></>
    const { isActive, dir } = sortInfo(col)
    const multiIdx = merged.multiSort ? multiSortState().findIndex((s) => s.key === col.key) : -1
    return (
      <>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            'flex-direction': 'column',
            'margin-inline-start': '4px',
            'line-height': '0.6',
            'font-size': 'var(--iris-font-size-xs, 12px)',
            color: isActive ? 'var(--iris-primary)' : 'var(--iris-muted)',
          }}
        >
          <span style={{ opacity: dir === 'asc' ? '1' : '0.45' }}>▲</span>
          <span style={{ opacity: dir === 'desc' ? '1' : '0.45' }}>▼</span>
        </span>
        {/* Multi mode: non-primary sort columns show their click-order
            sequence number (vxe sort-config sequence parity). */}
        <Show when={merged.multiSort && multiIdx > 0}>
          <span
            data-iris-sort-seq=""
            style={{
              'margin-inline-start': 'var(--iris-space-xxs, 4px)',
              'font-size': 'var(--iris-font-size-xs, 12px)',
              color: 'var(--iris-muted)',
            }}
          >
            {multiIdx + 1}
          </span>
        </Show>
      </>
    )
  }

  const seqStartIndex = props.seqStartIndex ?? 1
  const seqValue = (index: number): string | number => {
    if (props.seqMethod) return props.seqMethod({ rowIndex: index, columnIndex: 0 })
    if (proxy && props.proxyConfig?.seq && merged.seq) {
      return (proxyState().params.page - 1) * proxyState().params.pageSize + index + 1
    }
    return index + seqStartIndex
  }
  // Span bookkeeping (vxe spanMethod parity): a per-pass occupied set rebuilt
  // whenever bodyEntries gets a fresh reference (a new render pass), so Solid's
  // <For> — which re-runs callbacks only for new entry identities — never
  // accumulates stale coverage across passes. The rebuild is also keyed on the
  // spanMethod identity: swapping the callback to a different function without
  // a data change (same bodyEntries reference) must drop coverage left by the
  // previous function, or cells it covered stay blank under the new one.
  const spanOccupy = new Set<string>()
  let spanRowsRef: Array<{ row: Row; meta: TreeRow<Row> | null }> | undefined
  let spanMethodRef: NonNullable<IrisTableProps<Row>['spanMethod']> | undefined
  const spanPass = (): void => {
    if (props.spanMethod === undefined) return
    const entries = bodyEntries()
    if (spanRowsRef !== entries || spanMethodRef !== props.spanMethod) {
      spanOccupy.clear()
      spanRowsRef = entries
      spanMethodRef = props.spanMethod
    }
  }

  const stateRowStyle: JSX.CSSProperties = {
    padding: '32px 12px',
    'text-align': 'center',
    color: 'var(--iris-muted)',
  }

  // Tree mode is opt-in via getSubRows. The virtual-scroll path windows flat AND
  // tree rows (uniform height) — only variable-height detail panels bar it, hence
  // the `!hasDetail()` guard below.
  const treeMode = (): boolean => props.getSubRows !== undefined || props.lazyLoad !== undefined

  // Single source of truth for a body row's main `<div>`. The non-virtual body
  // wraps it with a detail panel; the virtual scroller renders it directly,
  // passing the per-row tree meta (`flatTree()[idx]`) at the scroller's absolute
  // index so indent + toggle render for windowed tree rows too.
  const renderRow = (row: Row, index: number, treeMeta: TreeRow<Row> | null): JSX.Element => {
    const id = rowId(row, index)
    const liveRow = (): Row => {
      liveRevision()
      return (
        gridRows.find(id) ??
        liveRowsRef.find((candidate, candidateIndex) => rowId(candidate, candidateIndex) === id) ??
        row
      )
    }
    spanPass()
    const selected = (): boolean => isSelected(id)
    const expanded = (): boolean => expandedKeys().includes(String(id))
    const expandable = (): boolean => isRowExpandable(row, index)
    return (
      <div
        role="row"
        // Announce selection to assistive tech (parity with the React adapter);
        // `data-state` below stays as the styling hook.
        aria-selected={merged.selectable !== 'none' ? selected() : undefined}
        data-iris-table-row=""
        data-iris-table-row-key={String(id)}
        data-iris-row-editing={rowMode() && rowEditing()?.k === id ? 'true' : undefined}
        data-state={selected() ? 'selected' : undefined}
        // Tree depth/position for screen readers (1-based); the toggle button
        // carries aria-expanded for the control itself.
        aria-level={treeMeta ? treeMeta.depth + 1 : undefined}
        aria-setsize={treeMeta ? treeMeta.setSize : undefined}
        aria-posinset={treeMeta ? treeMeta.posInset : undefined}
        onClick={() => merged.onRowClick?.(row, index)}
        style={{
          display: 'grid',
          'grid-template-columns': gridTemplate(),
          background: selected()
            ? 'var(--iris-surface-selected)'
            : merged.striped && index % 2 === 1
              ? 'var(--iris-surface)'
              : 'var(--iris-row-bg, transparent)',
          transition: 'background-color 120ms ease',
          cursor: 'default',
        }}
      >
        {/* Row drag handle (vxe rowDragConfig parity): seeds the press; the
          drag id rides on THIS cell (the empty `data-iris-table-row` attr
          stays untouched) so rect collection can key by row id. */}
        <Show when={merged.rowDrag}>
          <div
            role="cell"
            data-iris-table-cell="__drag"
            data-iris-row-drag-handle={String(id)}
            data-iris-row-drag-active={rowDragActive() === String(id) ? 'true' : undefined}
            data-iris-row-drag-over={rowDragOver() === String(id) ? 'true' : undefined}
            onPointerDown={(e: PointerEvent) => handleRowDragPointerDown(e, String(id))}
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              padding: '8px',
              'border-bottom': '1px solid var(--iris-border)',
              cursor: 'grab',
              color: 'var(--iris-muted)',
              background:
                rowDragActive() === String(id)
                  ? 'var(--iris-surface-hover)'
                  : rowDragOver() === String(id)
                    ? 'var(--iris-surface-selected)'
                    : 'transparent',
            }}
          >
            <span aria-hidden="true" style={{ 'font-size': 'var(--iris-font-size-sm, 13px)' }}>
              ⠿
            </span>
          </div>
        </Show>
        <Show when={merged.seq}>
          <div
            role="cell"
            data-iris-table-cell="__seq"
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              padding: '8px',
              'border-bottom': '1px solid var(--iris-border)',
              color: 'var(--iris-muted)',
              'user-select': 'none',
            }}
          >
            {seqValue(index)}
          </div>
        </Show>
        <Show when={hasDetail()}>
          <div
            role="cell"
            data-iris-table-cell="__expand"
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              padding: '8px',
              'border-bottom': '1px solid var(--iris-border)',
            }}
          >
            <Show when={expandable()}>
              <button
                type="button"
                data-iris-table-expand-toggle=""
                aria-expanded={expanded()}
                aria-label={t(expanded() ? 'treeSelect.collapse' : 'treeSelect.expand')}
                onClick={(e) => {
                  e.stopPropagation()
                  expansion.toggle(String(id))
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '0',
                  font: 'inherit',
                  color: 'var(--iris-foreground)',
                  transform: expanded() ? 'rotate(90deg)' : 'none',
                  transition: 'transform 150ms',
                }}
              >
                ▶
              </button>
            </Show>
          </div>
        </Show>
        <Show when={merged.selectable !== 'none'}>
          <div
            role="cell"
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              padding: '8px',
              'border-bottom': '1px solid var(--iris-border)',
            }}
          >
            <input
              type="checkbox"
              checked={selected()}
              onChange={() => toggleRow(id)}
              onClick={(e) => e.stopPropagation()}
              aria-label={t('table.selectRow', { key: index + 1 })}
            />
          </div>
        </Show>
        <For each={leafColumns()}>
          {(col, colIndexAccessor) => {
            const cid = `${id}::${col.key}`
            const rowSession = (): RowCellSession<Row> | undefined =>
              rowMode() ? rowSessions().get(cid) : undefined
            const isEditing = (): boolean =>
              rowMode() ? rowSession() !== undefined : editingCellId() === cid
            const isFirstCol = colIndexAccessor() === 0
            const colIndex = colIndexAccessor()
            const isFocused = (): boolean => {
              const fc = focusedCell()
              return fc ? fc.row === index && fc.col === colIndex : index === 0 && colIndex === 0
            }
            // Column virtualization: skip cells outside the visible window (+
            // pinned). When windowing, place the rendered cell on its grid track.
            const inWindow = (): boolean => {
              const set = visibleColSet()
              return !set || set.has(colIndex)
            }
            const patternHint = (): boolean =>
              Boolean(merged.pattern || merged.patternFill) &&
              !rowMode() &&
              editingColumnKey() === col.key &&
              !isEditing() &&
              editingDraft() !== '' &&
              String(resolveTableCellValue(liveRow(), col) ?? '') === editingDraft()
            const displayText = (): string =>
              tableDisplayText<Row>(liveRow(), col, resolveTableCellValue)
            // Cell merge (vxe spanMethod parity): the occupied set carries
            // cells covered by an earlier rowspan/colspan origin — those cells
            // render nothing. Origin cells with colspan > 1 extend their grid
            // track; rowspan coverage only removes the covered cells (each row
            // is its own grid container, so a row cannot span another row).
            let colspan = 1
            if (props.spanMethod && inWindow()) {
              const spanKey = `${index}:${colIndex}`
              if (spanOccupy.has(spanKey)) return <></>
              const span = props.spanMethod({ rowIndex: index, columnIndex: colIndex })
              const rowspan = span?.rowspan ?? 1
              colspan = span?.colspan ?? 1
              if (rowspan > 1) {
                for (let r = 1; r < rowspan; r += 1) spanOccupy.add(`${index + r}:${colIndex}`)
              }
              if (colspan > 1) {
                for (let c = 1; c < colspan; c += 1) spanOccupy.add(`${index}:${colIndex + c}`)
              }
            }
            return (
              <Show when={inWindow()}>
                <div
                  role="cell"
                  data-iris-table-cell={col.key}
                  data-iris-table-pinned={col.pinned}
                  data-editable={isEditableColumn(col) ? '' : undefined}
                  data-editing={isEditing() ? '' : undefined}
                  data-iris-input-hint={patternHint() ? 'true' : undefined}
                  data-grid-row={merged.keyboardNavigation ? index : undefined}
                  data-grid-col={merged.keyboardNavigation ? colIndex : undefined}
                  data-iris-cell-row={merged.cellRange ? index : undefined}
                  data-iris-cell-col={merged.cellRange ? colIndex : undefined}
                  data-iris-cell-selected={
                    merged.cellRange && isInRange(index, colIndex) ? 'true' : undefined
                  }
                  tabindex={merged.keyboardNavigation ? (isFocused() ? 0 : -1) : undefined}
                  onFocus={
                    merged.keyboardNavigation
                      ? () => setFocusedCell({ row: index, col: colIndex })
                      : undefined
                  }
                  onClick={
                    rowMode()
                      ? () => handleRowCellClick(row, col, index, id)
                      : merged.cellRange
                        ? (e: MouseEvent) => {
                            if (e.shiftKey) {
                              cellRangeCtrl.extendRange(index, colIndex)
                            } else {
                              cellRangeCtrl.startRange(index, colIndex)
                            }
                          }
                        : isEditableColumn(col) && merged.editConfig?.trigger === 'click'
                          ? () => beginEdit(row, col, id)
                          : undefined
                  }
                  onDblClick={
                    rowMode()
                      ? () => switchRowEdit(row, index, col.key)
                      : isEditableColumn(col)
                        ? () => beginEdit(row, col, id)
                        : undefined
                  }
                  onContextMenu={
                    merged.contextMenu
                      ? (e: MouseEvent) => handleContextMenu(e, row, col, index, colIndex)
                      : undefined
                  }
                  style={{
                    display: 'flex',
                    'align-items': 'center',
                    'justify-content':
                      (col.align ??
                        (typeof resolveTableCellValue(liveRow(), col) === 'number'
                          ? 'right'
                          : 'left')) === 'right'
                        ? 'flex-end'
                        : col.align === 'center'
                          ? 'center'
                          : 'flex-start',
                    padding: isEditing() ? '4px' : '8px var(--iris-padding-md)',
                    'flex-wrap': isEditing() ? 'wrap' : undefined,
                    'border-bottom': '1px solid var(--iris-border)',
                    'font-size': 'var(--iris-font-size-md, 14px)',
                    'white-space': 'nowrap',
                    overflow: 'hidden',
                    'text-overflow': 'ellipsis',
                    cursor: isEditableColumn(col) ? 'cell' : 'default',
                    background:
                      merged.cellRange && isInRange(index, colIndex)
                        ? 'var(--iris-surface-selected, rgba(99,102,241,0.12))'
                        : undefined,
                    'background-image': patternHint()
                      ? 'linear-gradient(var(--iris-input-hint, rgba(251, 191, 36, 0.16)), var(--iris-input-hint, rgba(251, 191, 36, 0.16)))'
                      : undefined,
                    ...(visibleColSet() ? { 'grid-column-start': String(colTrack(colIndex)) } : {}),
                    ...(colspan > 1 ? { 'grid-column-end': `span ${colspan}` } : {}),
                  }}
                >
                  <Show when={treeMeta && isFirstCol}>
                    <span
                      data-iris-table-tree-indent=""
                      style={{
                        display: 'inline-flex',
                        'align-items': 'center',
                        flex: 'none',
                        'padding-left': `${treeMeta!.depth * 16}px`,
                      }}
                    >
                      <Show
                        when={treeMeta!.hasChildren}
                        fallback={
                          lazyTree() && !lazyChildren.has(treeMeta!.key) ? (
                            <button
                              type="button"
                              data-iris-table-tree-toggle=""
                              data-iris-tree-loading={
                                lazyLoading().has(treeMeta!.key) ? '' : undefined
                              }
                              aria-expanded="false"
                              aria-label={t('treeSelect.expand')}
                              onClick={(e) => {
                                e.stopPropagation()
                                const key = treeMeta!.key
                                if (lazyLoading().has(key)) return
                                // First expand fetches the children: loading is
                                // tracked in the signal (drives the spinner
                                // caret); a throwing load stays retryable (the
                                // key is not cached).
                                setLazyLoading((prev) => new Set(prev).add(key))
                                const clearLoading = (): void => {
                                  setLazyLoading((prev) => {
                                    const next = new Set(prev)
                                    next.delete(key)
                                    return next
                                  })
                                }
                                try {
                                  const epoch = lazyEpoch
                                  props.lazyLoad!(row, (children) => {
                                    // Stale fetch: the data source changed while
                                    // this load was in flight — drop the result
                                    // (and do NOT clear the loading flag, which
                                    // may belong to a newer fetch of the same
                                    // key).
                                    if (epoch !== lazyEpoch) return
                                    lazyChildren.set(key, children)
                                    if (children && children.length > 0) {
                                      expansion.toggle(key)
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
                                padding: '0',
                                'margin-right': '4px',
                                font: 'inherit',
                                color: 'var(--iris-foreground)',
                                transform: 'none',
                                transition: 'transform 150ms',
                              }}
                            >
                              ▶
                            </button>
                          ) : (
                            <span
                              aria-hidden="true"
                              style={{ display: 'inline-block', width: '16px' }}
                            />
                          )
                        }
                      >
                        <button
                          type="button"
                          data-iris-table-tree-toggle=""
                          aria-expanded={expandedKeys().includes(treeMeta!.key)}
                          aria-label={t(
                            expandedKeys().includes(treeMeta!.key)
                              ? 'treeSelect.collapse'
                              : 'treeSelect.expand',
                          )}
                          onClick={(e) => {
                            e.stopPropagation()
                            expansion.toggle(treeMeta!.key)
                          }}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            padding: '0',
                            'margin-right': '4px',
                            font: 'inherit',
                            color: 'var(--iris-foreground)',
                            transform: expandedKeys().includes(treeMeta!.key)
                              ? 'rotate(90deg)'
                              : 'none',
                            transition: 'transform 150ms',
                          }}
                        >
                          ▶
                        </button>
                      </Show>
                    </span>
                  </Show>
                  <Show
                    when={isEditing()}
                    fallback={
                      <Show when={col.renderCell} fallback={displayText()}>
                        {col.renderCell!(liveRow(), index)}
                      </Show>
                    }
                  >
                    <Show
                      when={rowSession()}
                      // The singleton cell-mode editor is INLINE (NOT a hoisted
                      // fragment): a `const cellEditor = (<>…</>)` compiles to an
                      // eagerly-instantiated template in the DOM build — its
                      // `<input>` hydration node has no server counterpart, so
                      // SSR→hydrate mismatches. Inline JSX stays inside the
                      // fallback getter (created only when this branch renders).
                      fallback={
                        <>
                          <input
                            type={col.editor === 'number' ? 'number' : 'text'}
                            value={editingDraft()}
                            data-iris-table-editor=""
                            aria-invalid={editError() ? 'true' : undefined}
                            aria-describedby={editError() ? `${cid}-error` : undefined}
                            onInput={(e) =>
                              cellEditing.setCellDraft((e.target as HTMLInputElement).value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                commitEdit(row, col, index)
                              } else if (e.key === 'Escape') {
                                e.preventDefault()
                                cancelEdit()
                              }
                            }}
                            onBlur={() => commitEdit(row, col, index)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '100%',
                              border: `1px solid ${
                                editError() ? 'var(--iris-danger)' : 'var(--iris-primary)'
                              }`,
                              'border-radius': 'var(--iris-radius-sm)',
                              padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
                              font: 'inherit',
                              background: 'var(--iris-background)',
                              color: 'var(--iris-foreground)',
                              outline: 'none',
                            }}
                          />
                          <Show when={merged.editPreview && col.formatter}>
                            <div
                              data-iris-edit-preview=""
                              style={{
                                'flex-basis': '100%',
                                'min-width': '0',
                                'margin-top': 'var(--iris-space-xxs, 4px)',
                                'font-size': 'var(--iris-font-size-xs, 12px)',
                                color: 'var(--iris-muted)',
                              }}
                            >
                              {editPreviewText(row, col, editingDraft())}
                            </div>
                          </Show>
                          <Show when={editError()}>
                            <div
                              id={`${cid}-error`}
                              role="alert"
                              data-iris-table-editor-error=""
                              style={{
                                'margin-top': '2px',
                                'font-size': 'var(--iris-font-size-xs, 12px)',
                                color: 'var(--iris-danger)',
                              }}
                            >
                              {editError()}
                            </div>
                          </Show>
                        </>
                      }
                    >
                      {(session) => (
                        <>
                          <input
                            ref={(el) => {
                              if (el) rowEditorRefs.set(col.key, el)
                              else rowEditorRefs.delete(col.key)
                            }}
                            type={col.editor === 'number' ? 'number' : 'text'}
                            value={session().draft()}
                            data-iris-table-editor=""
                            aria-invalid={session().error() ? 'true' : undefined}
                            aria-describedby={session().error() ? `${cid}-error` : undefined}
                            onInput={(e) =>
                              session().setDraft((e.currentTarget as HTMLInputElement).value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                commitRowSession(session(), row, id)
                              } else if (e.key === 'Escape') {
                                e.preventDefault()
                                cancelRowEdit()
                              } else if (e.key === 'Tab') {
                                e.preventDefault()
                                handleRowTab(row, col, session(), id, e.shiftKey ? -1 : 1)
                              }
                            }}
                            onBlur={() => commitRowSession(session(), row, id)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '100%',
                              border: `1px solid ${
                                session().error() ? 'var(--iris-danger)' : 'var(--iris-primary)'
                              }`,
                              'border-radius': 'var(--iris-radius-sm)',
                              padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
                              font: 'inherit',
                              background: 'var(--iris-background)',
                              color: 'var(--iris-foreground)',
                              outline: 'none',
                            }}
                          />
                          <Show when={merged.editPreview && col.formatter}>
                            <div
                              data-iris-edit-preview=""
                              style={{
                                'flex-basis': '100%',
                                'min-width': '0',
                                'margin-top': 'var(--iris-space-xxs, 4px)',
                                'font-size': 'var(--iris-font-size-xs, 12px)',
                                color: 'var(--iris-muted)',
                              }}
                            >
                              {editPreviewText(row, col, session().draft())}
                            </div>
                          </Show>
                          <Show when={session().error()}>
                            <div
                              id={`${cid}-error`}
                              role="alert"
                              data-iris-table-editor-error=""
                              style={{
                                'margin-top': '2px',
                                'font-size': 'var(--iris-font-size-xs, 12px)',
                                color: 'var(--iris-danger)',
                              }}
                            >
                              {session().error()}
                            </div>
                          </Show>
                        </>
                      )}
                    </Show>
                  </Show>
                </div>
              </Show>
            )
          }}
        </For>
      </div>
    )
  }

  return (
    <>
      <TableTabs
        tabs={merged.tableTabs}
        activeKey={tableViews.activeTab}
        onApply={tableViews.applyTableTab}
      />
      <TableViews
        config={merged.views}
        views={tableViews.viewList}
        activeKey={tableViews.activeViewKey}
        onSelect={tableViews.selectView}
        onSave={tableViews.saveView}
        onDelete={tableViews.deleteView}
      />
      <TableForm
        config={merged.formConfig}
        draft={formDraft}
        setValue={setFormValue}
        onSubmit={handleFormSubmit}
        onReset={handleFormReset}
        t={t}
      />

      <TableToolbar
        toolbar={merged.toolbar}
        selectable={merged.selectable}
        selection={displaySelection}
        refresh={() => {
          if (proxy) void proxy.refetch()
        }}
        t={t}
        importPreview={merged.importPreview}
        densityToggle={merged.densityToggle}
        effectiveDensity={effectiveDensity}
        onDensityToggle={cycleDensity}
        undo={merged.undo}
        canUndo={undoController.canUndo}
        canRedo={undoController.canRedo}
        onUndo={undoController.undo}
        onRedo={undoController.redo}
      />

      <div
        ref={rootRef}
        // A keyboard-navigable hierarchical table is a `treegrid`; otherwise the
        // grid/table role as before (treegrid implies managed cell focus).
        role={merged.keyboardNavigation ? (treeMode() ? 'treegrid' : 'grid') : 'table'}
        data-iris-table=""
        data-density={effectiveDensity()}
        data-printable={merged.printable ? 'true' : undefined}
        data-column-virtualized={merged.columnVirtualization ? 'true' : undefined}
        onKeyDown={
          merged.keyboardNavigation || merged.cellRange || merged.clipConfig
            ? (e: KeyboardEvent) => {
                if (merged.keyboardNavigation) handleGridKey(e)
                if (merged.cellRange) handleCellRangeKey(e)
                handleClipboardKey(e)
              }
            : undefined
        }
        onPointerMove={
          merged.rowDrag || merged.columnDrag
            ? (e: PointerEvent) => {
                handleRowDragPointerMove(e)
                handleColDragPointerMove(e)
              }
            : undefined
        }
        onPointerUp={
          merged.rowDrag || merged.columnDrag
            ? () => {
                handleRowDragPointerUp()
                handleColDragPointerUp()
              }
            : undefined
        }
        onPointerLeave={merged.rowDrag ? handleRowDragPointerLeave : undefined}
        onScroll={
          merged.columnVirtualization
            ? (e: Event) => setScrollLeft((e.currentTarget as HTMLElement).scrollLeft)
            : undefined
        }
        style={{
          background: 'var(--iris-background)',
          color: 'var(--iris-foreground)',
          // React parity (batch AF): the root pins the base table font so
          // inherited contexts (seq/expand/drag/selection cells + headers)
          // render md like React instead of the page's body size.
          'font-size': 'var(--iris-font-size-md, 14px)',
          border: merged.bordered ? '1px solid var(--iris-border)' : 'none',
          'border-radius': 'var(--iris-radius-md)',
          // Column virtualization and responsive overflow turn the table into
          // a horizontal scroll container.
          overflow: merged.columnVirtualization || responsiveOverflow() ? 'auto' : 'hidden',
          ...(responsiveOverflow() ? { 'overflow-x': 'auto' } : {}),
          ...(merged.style ?? {}),
        }}
      >
        <Show when={merged.clipConfig && merged.clipConfig.copy !== false && activeCellRange()}>
          <button type="button" data-iris-table-range-copy="" onClick={copyActiveRange}>
            {t('table.range.copy')}
          </button>
        </Show>
        <TableGroupedHeader
          grouped={grouped}
          matrix={headerMatrix}
          gridTemplate={gridTemplate}
          rowDrag={merged.rowDrag}
          seq={merged.seq}
          hasDetail={hasDetail}
          selectable={merged.selectable}
          selection={props.selection}
          allSelected={allSelected}
          someSelected={someSelected}
          toggleAll={toggleAll}
          t={t}
          columnDrag={merged.columnDrag}
          columnDragActive={colDragActive}
          columnDragOver={colDragOver}
          handleColumnDragPointerDown={handleColDragPointerDown}
          handleHeaderClick={handleHeaderClick}
          sortAria={sortAria}
          sortIndicator={sortIndicator}
          renderFilterTrigger={renderFilterTrigger}
          pinnedDrag={merged.pinnedDrag}
          pinnedBoundaryKey={pinnedBoundaryKey}
          resolvePinnedCount={resolvePinnedCount}
          commitPinnedCount={commitPinnedCount}
        />

        <TableFlatHeader
          grouped={grouped}
          columns={displayColumns}
          gridTemplate={gridTemplate}
          rowDrag={merged.rowDrag}
          seq={merged.seq}
          hasDetail={hasDetail}
          selectable={merged.selectable}
          selection={props.selection}
          allSelected={allSelected}
          someSelected={someSelected}
          toggleAll={toggleAll}
          t={t}
          visibleColSet={visibleColSet}
          colTrack={colTrack}
          columnDrag={merged.columnDrag}
          columnDragActive={colDragActive}
          columnDragOver={colDragOver}
          handleColumnDragPointerDown={handleColDragPointerDown}
          handleHeaderClick={handleHeaderClick}
          sortAria={sortAria}
          sortIndicator={sortIndicator}
          renderFilterTrigger={renderFilterTrigger}
          pinnedDrag={merged.pinnedDrag}
          pinnedBoundaryKey={pinnedBoundaryKey}
          resolvePinnedCount={resolvePinnedCount}
          commitPinnedCount={commitPinnedCount}
          resizableColumns={merged.resizableColumns}
          widthOf={widthOf}
          minWidth={(col) => col.minWidth ?? DEFAULT_MIN_WIDTH}
          maxWidth={(col) => col.maxWidth ?? Infinity}
          setColumnWidths={setColumnWidths}
          effectiveWidths={effectiveWidths}
        />

        {/* Body */}
        <Show
          when={!tableError() && !tableLoading()}
          fallback={
            <Show
              when={tableError()}
              fallback={
                <div
                  role="row"
                  aria-busy="true"
                  data-iris-table-row="loading"
                  style={stateRowStyle}
                >
                  {props.loadingState ?? t('table.loading')}
                </div>
              }
            >
              <div role="row" data-iris-table-row="error" style={stateRowStyle}>
                <span
                  style={{
                    'margin-inline-end': props.onRetry ? 'var(--iris-space-sm, 12px)' : '0px',
                  }}
                >
                  {props.errorState ?? t('table.error')}
                </span>
                <Show when={props.onRetry || hasProxy()}>
                  <button
                    type="button"
                    data-iris-table-retry=""
                    onClick={() => {
                      // Proxy mode: the built-in retry re-queries (vxe parity).
                      if (proxy) void proxy.refetch()
                      props.onRetry?.()
                    }}
                    style={{
                      border: '1px solid var(--iris-border)',
                      background: 'var(--iris-surface)',
                      color: 'var(--iris-foreground)',
                      'border-radius': 'var(--iris-radius-sm, 4px)',
                      padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                      'font-size': 'var(--iris-font-size-sm, 13px)',
                      cursor: 'pointer',
                    }}
                  >
                    {t('table.retry')}
                  </button>
                </Show>
              </div>
            </Show>
          }
        >
          <Show
            when={bodyRows().length > 0}
            fallback={
              <div role="row" data-iris-table-row="empty" style={stateRowStyle}>
                {props.emptyState ?? t('table.empty')}
              </div>
            }
          >
            <Show
              when={merged.virtualScroll && (!treeMode() || !hasDetail())}
              fallback={
                <div role="rowgroup" data-iris-table-body="">
                  <For each={bodyEntries()}>
                    {(entry, indexAccessor) => {
                      const row = entry.row
                      const treeMeta = entry.meta
                      const index = indexAccessor()
                      const id = rowId(row, index)
                      const expanded = (): boolean => expandedKeys().includes(String(id))
                      const expandable = (): boolean => isRowExpandable(row, index)
                      return (
                        <>
                          {renderRow(row, index, treeMeta)}
                          {/* Full-width detail panel beneath an expanded, expandable
                            row (spans all grid tracks). Only in the non-virtual path. */}
                          <Show when={hasDetail() && expandable() && expanded()}>
                            <div
                              role="row"
                              data-iris-table-row-detail={String(id)}
                              style={{
                                display: 'grid',
                                'grid-template-columns': gridTemplate(),
                              }}
                            >
                              <div
                                role="cell"
                                data-iris-table-detail-cell=""
                                style={{
                                  'grid-column': '1 / -1',
                                  padding: '8px 12px',
                                  'border-bottom': '1px solid var(--iris-border)',
                                }}
                              >
                                {props.renderDetail!(row, index)}
                              </div>
                            </div>
                          </Show>
                        </>
                      )
                    }}
                  </For>
                </div>
              }
            >
              {/* Virtualize flat mode, and tree mode too — tree rows are uniform
                height, so the only thing that bars it is variable-height detail
                panels, hence the `!hasDetail()` guard. `bodyRows()` is the flattened
                visible rows (= sortedRows() in flat mode); `flatTree()?.[idx]`
                supplies each row's tree meta (depth + toggle), with `idx` the
                absolute row index the scroller passes its render callback. */}
              <IrisVirtualScroll
                items={bodyRows()}
                itemHeight={merged.virtualScroll!.itemHeight}
                height={merged.virtualScroll!.height}
                buffer={merged.virtualScroll!.buffer}
                keyOf={(row, idx) => rowId(row, idx)}
                renderItem={(row, idx) => renderRow(row, idx, flatTree()?.[idx] ?? null)}
              />
            </Show>
          </Show>
        </Show>

        {/* Summary / footer row stays in a dedicated renderer so its leading
          tracks cannot drift from the body grid. */}
        <Show when={!tableError() && !tableLoading()}>
          <TableSummary
            bodyRows={bodyRows}
            leafColumns={leafColumns}
            visibleColSet={visibleColSet}
            gridTemplate={gridTemplate}
            colTrack={colTrack}
            getCellValue={resolveTableCellValue}
            rowDrag={merged.rowDrag}
            seq={merged.seq}
            hasDetail={hasDetail}
            selectable={merged.selectable}
          />
        </Show>

        <TablePager
          enabled={hasProxy}
          config={merged.pagerConfig}
          state={proxyState}
          setParams={(partial) => {
            proxy?.setParams(partial)
          }}
          onPageChange={props.proxyConfig?.onPageChange}
          t={t}
        />
        <TableScrollTop
          root={() => rootRef}
          enabled={() => merged.scrollToTop === true && !merged.printable}
          hasVirtual={() => merged.virtualScroll !== undefined}
          rows={() => bodyRows().length}
          loading={() => tableLoading()}
          error={() => tableError()}
        />
      </div>

      <Show when={merged.responsive && responsiveOverflow() && !merged.printable}>
        <div
          data-iris-scroll-hint=""
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            'align-items': 'center',
            gap: 'var(--iris-space-xxs, 4px)',
            padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
            color: 'var(--iris-muted)',
            background: 'var(--iris-surface)',
            'border-inline': '1px solid var(--iris-border)',
            'border-bottom': '1px solid var(--iris-border)',
            'font-size': 'var(--iris-font-size-sm, 13px)',
          }}
        >
          <span aria-hidden="true">⇆</span>
          <span>{t('table.scrollHint')}</span>
        </div>
      </Show>

      {/* Right-click context menu (vxe contextMenu parity): portaled to body,
        positioned at the cursor via the virtual anchor. */}
      <Show when={contextMenuState()}>
        {(state) => (
          <TableOverlayContextMenu
            open={state().open}
            anchor={contextAnchor}
            items={state().items}
            params={state().params}
            onSelect={(key, params) => merged.contextMenu?.onSelect(key, params)}
            onClose={closeContextMenu}
          />
        )}
      </Show>

      {/* Header filter panel (vxe filterConfig parity): keyed Show on the
        state object identity → each open remounts the panel so its draft
        checkbox state re-seeds from the applied filterValues. */}
      <Show when={filterPanelState()}>
        {(state) => {
          const fcol = displayColumns().find((c) => c.key === state().colKey)
          if (!fcol || !fcol.filterable) return null
          return (
            <TableOverlayFilterPanel
              open={state().open}
              anchor={filterAnchor}
              columnKey={fcol.key}
              options={fcol.filterOptions ?? []}
              initialChecked={effectiveFilterValues()[fcol.key] ?? []}
              onApply={applyFilterValues}
              onClear={clearFilterValues}
              onClose={closeFilterPanel}
              t={t}
            />
          )
        }}
      </Show>
    </>
  )
}
