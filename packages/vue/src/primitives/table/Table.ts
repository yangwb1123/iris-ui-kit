import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onScopeDispose,
  ref,
  shallowRef,
  Teleport,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type PropType,
  type Ref,
  type VNode,
} from 'vue'
import {
  aggregate,
  buildFormValues,
  buildHeaderMatrix,
  computeVirtualRange,
  createCellRange,
  createExpansion,
  createRemoteTableSource,
  createSelectionModel,
  createSortable,
  createTreeSelection,
  flattenLeafColumns,
  flattenTree,
  mergeFormFilters,
  nextGridCell,
  seedFormValues,
  validateEditRulesAsync,
  withSortedChildren,
  type CellRangeState,
  type GridNavKey,
  type RemoteTableParams,
  type RemoteTableSource,
  type RemoteTableSourceState,
  type SortableRect,
  type SortableState,
  type TreeSelectionNode,
  type TreeRow,
} from '@iris-ui-kit/core'
import { useI18n } from '../../i18n'
import { IrisButton } from '../button/Button'
import { IrisCheckbox } from '../checkbox/Checkbox'
import { useDrag } from '../drag/useDrag'
import { useDismiss } from '../floating/useDismiss'
import { useFloating } from '../floating/useFloating'
import { IrisFormField } from '../form-field/FormField'
import { IrisInput } from '../input/Input'
import { IrisPagination } from '../pagination/Pagination'
import { IrisSelect } from '../select/Select'
import { IrisVirtualScroll } from '../virtual-scroll/VirtualScroll'
import { tableControlProps } from './controlProps'
import { useTableSort } from './useTableSort'
import type {
  IrisTableCellEditEvent,
  IrisTableColumn,
  IrisTableColumnDrag,
  IrisTableColumnVisibility,
  IrisTableColumnWidths,
  IrisTableContextMenuConfig,
  IrisTableContextMenuParams,
  IrisTableExpose,
  IrisTableFilterValues,
  IrisTableFormConfig,
  IrisTableProxyConfig,
  IrisTableRenderDetail,
  IrisTableRowDrag,
  IrisTableRowExpandable,
  IrisTableSortDirection,
  IrisTableSortState,
  IrisTableSpan,
  IrisTableSpanMethodParams,
  IrisTableToolbarConfig,
  IrisTableVirtualOptions,
} from './types'

function getCellValue<Row extends Record<string, unknown>>(
  row: Row,
  column: IrisTableColumn<Row>,
): unknown {
  const key = (column.dataIndex ?? column.key) as keyof Row
  return row[key]
}

/**
 * Fold the checked filter sets into the query filter map as comma-joined
 * strings (vxe filter-multiple remote serialization parity, batch Z). Keys
 * with an empty checked set are left untouched.
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

const SELECTION_COL_WIDTH = 40
const EXPAND_COL_WIDTH = 40
const SEQ_COL_WIDTH = 40
const DRAG_COL_WIDTH = 40
const DEFAULT_COL_WIDTH = 140
const DEFAULT_MIN_WIDTH = 60
const RESIZE_STEP = 16

/**
 * spanMethod (vxe span-method parity, batch Y): resolve the span for one body
 * cell against the per-render-pass occupy set (cleared once per body render
 * pass, React parity). Returns null when the cell is covered by an earlier
 * spanning cell — the caller skips it; otherwise the covered cells are marked
 * so they render null too.
 */
function resolveSpan(
  occupy: Set<string>,
  rowIndex: number,
  columnIndex: number,
  method: ((params: IrisTableSpanMethodParams) => IrisTableSpan | null) | undefined,
): { rowspan: number; colspan: number } | null {
  if (!method) return { rowspan: 1, colspan: 1 }
  const key = `${rowIndex}:${columnIndex}`
  if (occupy.has(key)) return null
  const span = method({ rowIndex, columnIndex })
  const rowspan = span?.rowspan ?? 1
  const colspan = span?.colspan ?? 1
  if (rowspan > 1) {
    for (let r = 1; r < rowspan; r += 1) occupy.add(`${rowIndex + r}:${columnIndex}`)
  }
  if (colspan > 1) {
    for (let c = 1; c < colspan; c += 1) occupy.add(`${rowIndex}:${columnIndex + c}`)
  }
  return { rowspan, colspan }
}

function resolveInitialWidth(col: IrisTableColumn): number {
  if (typeof col.width === 'number') return col.width
  if (typeof col.width === 'string') {
    const m = col.width.match(/^(\d+(?:\.\d+)?)px$/)
    if (m) return Number(m[1])
  }
  return DEFAULT_COL_WIDTH
}

export interface UseTableProxyOptions<Row extends Record<string, unknown>> {
  proxyConfig: MaybeRefOrGetter<IrisTableProxyConfig<Row> | undefined>
  /** Whether sort changes re-query the server (proxyConfig.remoteSort). */
  remoteSort?: MaybeRefOrGetter<boolean>
  /** Whether filter changes re-query the server (proxyConfig.remoteFilter). */
  remoteFilter?: MaybeRefOrGetter<boolean>
  /** Multi-column sort mode (seeds the `sorts` channel of the initial params). */
  multiSort?: MaybeRefOrGetter<boolean | undefined>
  /** Controlled single-column sort state (initial params seed). */
  sort?: MaybeRefOrGetter<IrisTableSortState | null | undefined>
  defaultSort?: IrisTableSortState | null
  /** Controlled multi-column sort state (initial params seed). */
  multiSortState?: MaybeRefOrGetter<IrisTableSortState[] | undefined>
  defaultMultiSort?: IrisTableSortState[] | undefined
  /**
   * Checked filter sets (batch Z): comma-joined into the initial query
   * `filters` map when remoteFilter is on (vxe filter-multiple remote
   * serialization parity, React parity).
   */
  filterValues?: MaybeRefOrGetter<IrisTableFilterValues | undefined>
}

export interface UseTableProxyResult<Row extends Record<string, unknown>> {
  /** Controller instance, or null while no proxyConfig is present. */
  proxy: ComputedRef<RemoteTableSource<Row> | null>
  /** Live controller state (rows / total / loading / error / params). */
  state: ComputedRef<RemoteTableSourceState<Row>>
  /** Proxy rows → local editable copy: edit write-back sticks until the next
   * refetch replaces it (React liveData parity). */
  liveData: Ref<Row[]>
  /** Merge partial params and re-request (sort/filter value changes reset the
   * page to 1, vxe behavior). Returns false when nothing changed. */
  setParams: (partial: Partial<RemoteTableParams>) => boolean
  /** Re-fetch the current page (retry / refresh). */
  refetch: () => Promise<void>
}

/**
 * Bridges the core `createRemoteTableSource` controller into Vue reactivity for
 * the table's proxyConfig surface (vxe-grid proxyConfig parity, query slice).
 * The controller is created ONCE per proxy PRESENCE — an inline proxyConfig
 * object with a fresh identity each render never destroys/recreates it — and is
 * torn down when the proxy disappears or the setup scope disposes, so a late
 * response never writes back to a dead instance. State flows controller →
 * shallowRef via store subscribe: the same bridge pattern as the selection /
 * expansion / cell-range bridges.
 */
export function useTableProxy<Row extends Record<string, unknown>>(
  options: UseTableProxyOptions<Row>,
): UseTableProxyResult<Row> {
  const cfg = computed(() => toValue(options.proxyConfig))
  // The latest query closure is read at request time, so a parent that swaps
  // the query never leaves a stale closure behind.
  const queryRef = ref<IrisTableProxyConfig<Row>['query'] | undefined>(undefined)
  watch(
    () => cfg.value?.query,
    (query) => {
      queryRef.value = query
    },
    { immediate: true },
  )

  const proxy = shallowRef<RemoteTableSource<Row> | null>(null)
  const state = shallowRef<RemoteTableSourceState<Row>>({
    data: [],
    total: 0,
    loading: false,
    error: null,
    params: { page: 1, pageSize: 10, sort: null, filters: {} },
  })
  let unsubscribe: (() => void) | null = null
  // SSR/hydration: the first fetch is kicked from onMounted (like the React
  // adapter's effect) so renderToString never runs the user query and the
  // server HTML (initial state) hydrates with the client's first render.
  let mounted = false

  const attach = (ctrl: RemoteTableSource<Row>): void => {
    unsubscribe?.()
    proxy.value = ctrl
    state.value = ctrl.getState()
    unsubscribe = ctrl.subscribe((s) => {
      state.value = s
    })
  }

  const detach = (): void => {
    unsubscribe?.()
    unsubscribe = null
    proxy.value?.destroy()
    proxy.value = null
    state.value = {
      data: [],
      total: 0,
      loading: false,
      error: null,
      params: { page: 1, pageSize: 10, sort: null, filters: {} },
    }
  }

  // Keyed on proxy PRESENCE (not identity): a proxyConfig that arrives after
  // the first render still auto-loads, and an inline-object proxyConfig does
  // not destroy/recreate the controller on every change.
  watch(
    () => cfg.value === undefined,
    (absent) => {
      if (absent) {
        detach()
        return
      }
      if (proxy.value) return
      const config = cfg.value!
      const remoteSort = toValue(options.remoteSort) === true
      const multiSort = toValue(options.multiSort) === true
      const ctrl = createRemoteTableSource<Row>({
        // The latest query closure is read at request time (see queryRef).
        query: (params) => queryRef.value!(params),
        // Kicked below — never fire a fetch during setup.
        autoLoad: false,
        initialParams: {
          page: config.defaultPage ?? 1,
          pageSize: config.pageSize ?? 10,
          sort: remoteSort ? (toValue(options.sort) ?? options.defaultSort ?? null) : null,
          sorts:
            remoteSort && multiSort
              ? (toValue(options.multiSortState) ?? options.defaultMultiSort ?? [])
              : undefined,
          filters: remoteSort ? mergeFilterValues({}, toValue(options.filterValues) ?? {}) : {},
        },
      })
      attach(ctrl)
      // The auto-load kick only fires post-mount: never during renderToString
      // (server HTML stays on the initial state, hydrating cleanly) and never
      // during setup on the client (the loading row appears after mount, like
      // the React adapter's effect). `mounted` is set in onMounted below.
      if (mounted && config.autoLoad !== false) void ctrl.request()
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    detach()
  })

  // First fetch after the component is attached (client-only, like an effect)
  // — a proxyConfig that was present at setup loads here; one that arrives
  // later loads from the presence watch above (mounted is already true).
  onMounted(() => {
    mounted = true
    const config = cfg.value
    if (config && proxy.value && config.autoLoad !== false) void proxy.value.request()
  })

  // Proxy rows feed a local editable copy; a new page/refetch reference
  // replaces it wholesale (edits survive until then, React liveData parity).
  const liveData = shallowRef<Row[]>([])
  watch(
    state,
    (s) => {
      liveData.value = s.data
    },
    { immediate: true },
  )

  return {
    proxy: computed(() => proxy.value),
    state: computed(() => state.value),
    liveData,
    setParams: (partial) => {
      if (!proxy.value) return false
      return proxy.value.setParams(partial)
    },
    refetch: () => {
      if (!proxy.value) return Promise.resolve()
      return proxy.value.refetch()
    },
  }
}

/**
 * Data-driven table. Renders as a CSS-grid layout under the hood (no native
 * `<table>` element) so it can support virtual scrolling and column resize
 * uniformly. ARIA roles (`role="table" / "row" / "columnheader" / "cell"`)
 * are wired explicitly for screen readers.
 *
 * **Features**:
 *   - Column-driven rendering with optional `#header.<key>` and `#cell.<key>` slots
 *   - Row activation via `rowClick` and `rowDblclick` events
 *   - Sorting (controlled or uncontrolled, cycles `none → asc → desc → none`)
 *   - Row selection (single / multi) with master checkbox + indeterminate
 *   - **Column resize** (`resizable-columns`) — draggable handle on each
 *     column boundary, `v-model:columnWidths` exposes the map
 *   - **Virtual scrolling** (`:virtual-scroll="{ itemHeight, height }"`) —
 *     renders only the visible row window; viable for 100k+ rows
 *
 * @example
 *   <IrisTable
 *     :columns="cols"
 *     :data="rows"
 *     row-key="id"
 *     selectable="multi"
 *     resizable-columns
 *     :virtual-scroll="{ itemHeight: 36, height: 480 }"
 *   />
 */
export const IrisTable = defineComponent({
  name: 'IrisTable',
  inheritAttrs: false,
  props: {
    columns: {
      type: Array as PropType<IrisTableColumn<Record<string, unknown>>[]>,
      required: true,
    },
    data: {
      type: Array as PropType<Array<Record<string, unknown>>>,
      required: false,
      default: undefined,
    },
    rowKey: { type: String, default: 'id' },
    ...tableControlProps,
    /** Multi-column sort (vxe sort-config.multiple parity): header clicks
     * append/cycle columns in click order instead of replacing. Default false. */
    multiSort: { type: Boolean, default: false },
    /** Controlled multi-column sort state (multiSort mode). */
    multiSortState: {
      type: Array as PropType<IrisTableSortState[]>,
      default: undefined,
    },
    /** Default multi-column sort (multiSort mode, uncontrolled). */
    defaultMultiSort: {
      type: Array as PropType<IrisTableSortState[]>,
      default: undefined,
    },
    striped: { type: Boolean, default: false },
    editConfig: {
      type: Object as PropType<{
        trigger?: 'click' | 'dblclick' | 'manual'
        showAsterisk?: boolean
        autoClear?: boolean
        /** Edit mode (vxe editConfig.mode parity, batch Z): `'cell'` (default) edits one cell at a time; `'row'` opens every editable column of the clicked row together — Enter/blur commits THAT column, Escape cancels the whole row, clicking another row commits the current row's open editors first. */
        mode?: 'cell' | 'row'
      }>,
      default: undefined,
    },
    bordered: { type: Boolean, default: true },
    /** Enable per-column resize handles. Combine with `v-model:columnWidths` for persistence. */
    resizableColumns: { type: Boolean, default: false },
    /** Controlled column widths in px. */
    columnWidths: {
      type: Object as PropType<IrisTableColumnWidths>,
      default: undefined,
    },
    /** Enable virtual scrolling for the body. */
    virtualScroll: {
      type: Object as PropType<IrisTableVirtualOptions>,
      default: undefined,
    },
    /** Show the loading state instead of rows. */
    loading: { type: Boolean, default: false },
    /** Show the error state instead of rows (takes precedence over loading). */
    error: { type: Boolean, default: false },
    onRetry: { type: Function as PropType<(() => void) | undefined>, default: undefined },
    /** Render only the horizontally-visible columns (+ pinned + overscan) for wide tables. */
    columnVirtualization: { type: Boolean, default: false },
    /**
     * Enable WAI-ARIA grid keyboard navigation: the table becomes `role="grid"`
     * and Arrow / Home / End / Page Up·Down move a roving cell focus across the
     * data cells. Off by default; opt-in and additive (no effect on mouse / Tab
     * behavior). Pairs best without virtualization (the focused cell must be
     * rendered) and does not hijack keystrokes while a cell is being edited.
     */
    keyboardNavigation: { type: Boolean, default: false },
    /**
     * Enable rectangular cell-range selection (Excel-style). Click starts a
     * range; Shift+Click or Shift+Arrow extends it; Escape clears it.
     * Cells within the range get `data-iris-cell-selected="true"`.
     */
    cellRange: { type: Boolean, default: false },
    /**
     * Render an expandable detail panel beneath a row. Providing this adds a
     * leading expand-toggle column; clicking it reveals a full-width detail row.
     * (Not applied in the virtual-scroll path.)
     */
    renderDetail: {
      type: Function as PropType<IrisTableRenderDetail<Record<string, unknown>>>,
      default: undefined,
    },
    /** Which rows can expand a detail panel. Defaults to all rows when `renderDetail` is set. */
    rowExpandable: {
      type: Function as PropType<IrisTableRowExpandable<Record<string, unknown>>>,
      default: undefined,
    },
    /** Initially-expanded row keys (uncontrolled). */
    defaultExpandedRowKeys: {
      type: Array as PropType<Array<string | number>>,
      default: undefined,
    },
    /**
     * Read a row's child rows to render the table as a TREE. Providing this
     * enables tree mode: `data` is treated as the root rows, each row's first
     * cell gains a depth indent + an expand/collapse toggle (when it has
     * children), and the expand state reuses `defaultExpandedRowKeys` /
     * `expandedRowsChange`. Column sort reorders siblings hierarchically (each
     * level sorted, structure kept), and tree rows virtualize like flat rows
     * when `virtualScroll` is set (unless `renderDetail` is also used, since
     * detail panels are variable-height).
     */
    getSubRows: {
      type: Function as PropType<
        (row: Record<string, unknown>) => Array<Record<string, unknown>> | undefined
      >,
      default: undefined,
    },
    /**
     * Cascade multi-row selection through the complete tree supplied by
     * `getSubRows`. Selecting a branch selects every descendant (including
     * collapsed rows); partially selected branches render indeterminate.
     * Ignored outside tree mode and for non-multi selection.
     */
    treeSelectionCascade: { type: Boolean, default: false },
    /**
     * Server-side data proxy (vxe-grid proxyConfig parity, query slice). When
     * set, `data` is ignored: rows come from `query` (paged), the table renders
     * a pager below the body, and inline-edit write-back keeps working on a
     * local copy until the next refetch.
     */
    proxyConfig: {
      type: Object as PropType<IrisTableProxyConfig<Record<string, unknown>>>,
      default: undefined,
    },
    /** Search form (vxe-grid formConfig parity). */
    formConfig: {
      type: Object as PropType<IrisTableFormConfig>,
      default: undefined,
    },
    /** Toolbar (vxe-grid toolbarConfig parity, minimal built-ins). */
    toolbar: {
      type: Object as PropType<IrisTableToolbarConfig>,
      default: undefined,
    },
    /**
     * Column visibility (vxe columnConfig.visible parity). Map of column key
     * → visible (default true); `false` hides the column from every render
     * path (header / body / summary). Controlled: parent owns the map.
     */
    columnVisibility: {
      type: Object as PropType<IrisTableColumnVisibility>,
      default: undefined,
    },
    /** Client-side filters (vxe filterConfig parity, local mode): column key → filter text; rows filtered with substring, case-insensitive matching ('' entries ignored). Combines with `formConfig` values when both exist (AND). */
    filters: {
      type: Object as PropType<Record<string, string>>,
      default: undefined,
    },
    /**
     * Per-column checked filter sets (vxe filter-multiple parity, batch Z):
     * column key → values OR-matched against the raw `String(value)` of each
     * row (AND-ed with the text `filters` channel). Controlled through
     * `filterValues` / `onFilterValuesChange`. Remote-filter tables serialize
     * each non-empty set into the proxy query filters as a comma-joined string.
     */
    filterValues: {
      type: Object as PropType<IrisTableFilterValues>,
      default: undefined,
    },
    /** Controlled `filterValues` channel (parent owns the map). */
    onFilterValuesChange: {
      type: Function as PropType<(next: IrisTableFilterValues) => void>,
      default: undefined,
    },
    /**
     * Right-click context menu (vxe-grid contextMenu parity, batch Z). Opens
     * on body leaf cells only — header, seq, selection, expand, summary and
     * footer cells never open it. The menu floats at the cursor (virtual
     * anchor), closes on Escape / outside pointer-down / any scroll, and fires
     * `onSelect` with the clicked item's key and the cell's grid coordinates.
     */
    contextMenu: {
      type: Object as PropType<IrisTableContextMenuConfig<Record<string, unknown>>>,
      default: undefined,
    },
    /**
     * Lazy tree (vxe lazyLoad parity, batch Z): a row with no `getSubRows`
     * children still renders a caret; the first expand calls this and `load`
     * resolves the children (expanding the row). Loaded children win over
     * `getSubRows`; a new data source reference (parent re-feed or proxy page
     * swap) drops the cache so lazy rows reload on the next expand.
     */
    lazyLoad: {
      type: Function as PropType<
        (
          row: Record<string, unknown>,
          load: (children: Array<Record<string, unknown>>) => void,
        ) => void
      >,
      default: undefined,
    },
    /** Render a leading sequence-number column (vxe seqConfig parity). */
    seq: { type: Boolean, default: false },
    /** First sequence number (vxe seq-config.startIndex parity). Default 1. */
    seqStartIndex: { type: Number, default: 1 },
    /**
     * Cell merge (vxe spanMethod parity): return `{ rowspan, colspan }` for a
     * cell at (rowIndex, columnIndex); both default 1. Values > 1 make the
     * cell span adjacent cells (the spanned cells are skipped).
     */
    spanMethod: {
      type: Function as PropType<(params: IrisTableSpanMethodParams) => IrisTableSpan | null>,
      default: undefined,
    },
    /** Column drag-sort (vxe columnDragConfig parity). Reorders leaf columns on drop; the parent owns columns (pass the reordered array back). Grouped headers are NOT supported (documented simplification). */
    columnDrag: {
      type: Object as PropType<IrisTableColumnDrag>,
      default: undefined,
    },
    /** Row drag-sort (vxe rowDragConfig parity). Renders a drag handle per row; a drop reorders the table's LOCAL rows and reports through `onDataChange`. */
    rowDrag: {
      type: Object as PropType<IrisTableRowDrag>,
      default: undefined,
    },
    /** Fired after any internal row operation / row-drag reorder / loadData, with the new row list (vxe-grid data-change parity). */
    onDataChange: {
      type: Function as PropType<(rows: Array<Record<string, unknown>>) => void>,
      default: undefined,
    },
  },
  emits: {
    'update:selection': (_value: Array<string | number>) => true,
    'update:sort': (_value: IrisTableSortState | null) => true,
    'update:multiSortState': (_value: IrisTableSortState[]) => true,
    multiSortChange: (_value: IrisTableSortState[]) => true,
    'update:columnWidths': (_value: IrisTableColumnWidths) => true,
    /** Controlled columnVisibility channel (parent owns the map). */
    'update:columnVisibility': (_value: IrisTableColumnVisibility) => true,
    rowClick: (_row: Record<string, unknown>, _index: number) => true,
    rowDblclick: (_row: Record<string, unknown>, _index: number) => true,
    cellEdit: (_payload: IrisTableCellEditEvent<Record<string, unknown>>) => true,
    expandedRowsChange: (_keys: Array<string | number>) => true,
  },
  setup(props, { slots, attrs, emit, expose }) {
    if (typeof document !== 'undefined' && !document.getElementById('iris-table-row-styles')) {
      const style = document.createElement('style')
      style.id = 'iris-table-row-styles'
      style.textContent = `
[data-iris-table] [role="row"]:hover {
  --iris-cell-bg: var(--iris-surface-hover);
}
[data-iris-table-row-selected="true"] {
  --iris-cell-bg: var(--iris-surface-selected);
}
`
      document.head.appendChild(style)
    }
    const { t } = useI18n()

    // -------- Multi-level (grouped) headers --------
    // A column carrying `children` is a header GROUP spanning its leaf
    // descendants; the leaves drive the body. When nothing is grouped,
    // `leafColumns` is the original `columns` (same reference) so every
    // body-affecting iteration stays byte-identical to the flat path.
    //
    // Batch Y: columnVisibility (vxe columnConfig.visible parity) filters
    // top-level columns out of every render path (header / body / summary) —
    // the flat header loop consumes `leafColumns` below. Reference-preserving:
    // without the prop `displayColumns` IS `props.columns`, so all existing
    // paths stay byte-identical.
    const displayColumns = computed<IrisTableColumn<Record<string, unknown>>[]>(() => {
      const vis = props.columnVisibility
      if (!vis) return props.columns
      return props.columns.filter((c) => vis[c.key] !== false)
    })
    const grouped = computed(() =>
      displayColumns.value.some((c) => c.children && c.children.length > 0),
    )
    const leafColumns = computed(() =>
      grouped.value ? flattenLeafColumns(displayColumns.value) : displayColumns.value,
    )
    const headerMatrix = computed(() =>
      grouped.value ? buildHeaderMatrix(displayColumns.value) : null,
    )

    // -------- Server-side proxy (vxe-grid proxyConfig parity, query slice) --------
    // The controller lives in the useTableProxy composable — created ONCE per
    // proxy PRESENCE (an inline proxyConfig object with a fresh identity each
    // render never destroys/recreates it) and torn down on scope dispose. The
    // bridge only maps controller state → refs and routes sort/filter/page
    // events back to setParams; paging / latest-wins / dedupe all live in core.
    const remoteSort = computed(() => props.proxyConfig?.remoteSort === true)
    const remoteFilter = computed(() => props.proxyConfig?.remoteFilter === true)
    const proxyCtrl = useTableProxy<Record<string, unknown>>({
      proxyConfig: () => props.proxyConfig,
      remoteSort,
      remoteFilter,
      multiSort: () => props.multiSort,
      sort: () => props.sort as IrisTableSortState | null | undefined,
      defaultSort: props.defaultSort,
      multiSortState: () => props.multiSortState,
      defaultMultiSort: props.defaultMultiSort,
      filterValues: () => props.filterValues,
    })
    // Proxy mode drives the table's loading/error UI from the controller state
    // (reusing the existing loading/error prop rendering below).
    const tableLoading = computed(() =>
      proxyCtrl.proxy.value ? proxyCtrl.state.value.loading : props.loading,
    )
    const tableError = computed(() =>
      proxyCtrl.proxy.value ? proxyCtrl.state.value.error !== null : props.error,
    )
    const handleRetry = (): void => {
      if (proxyCtrl.proxy.value) void proxyCtrl.proxy.value.refetch()
      props.onRetry?.()
    }
    const retry = computed(() => (proxyCtrl.proxy.value ? handleRetry : props.onRetry))
    // Proxy rows feed the table through a local editable copy (liveData): in
    // proxy mode `data` is ignored; committed edits write through to the copy
    // until the next refetch replaces it (React liveData parity).
    //
    // Batch Y: `localRowsOverride` gives LOCAL mode the same mutable row list
    // the proxy has (Vue has no mutable data store — React's liveData state
    // seeds from `data`). rowDrag reorders and the exposed `loadData` write
    // through it; a parent re-feed of `data` (new reference) clears the
    // override so the controlled prop wins again (React effect parity).
    const localRowsOverride = ref<Array<Record<string, unknown>> | null>(null)
    watch(
      () => props.data,
      () => {
        if (localRowsOverride.value !== null) localRowsOverride.value = null
      },
    )
    const tableData = computed(() =>
      proxyCtrl.proxy.value
        ? proxyCtrl.liveData.value
        : (localRowsOverride.value ?? props.data ?? []),
    )

    // -------- Sort (useTableSort composable) --------
    const {
      sortState: internalSort,
      cycleSort,
      sortComparator,
      sortedData: sortedRows,
      multiSortState,
      cycleMultiSort,
    } = useTableSort<Record<string, unknown>>(tableData, {
      leafColumns,
      sort: computed(() => props.sort as IrisTableSortState | null | undefined),
      defaultSort: props.defaultSort,
      onSortChange: (next) => {
        emit('update:sort', next)
        // remoteSort parity: sort changes re-query the server (page resets
        // to 1 in the core controller, vxe behavior).
        if (remoteSort.value) proxyCtrl.setParams({ sort: next })
      },
      multiSort: () => props.multiSort,
      multiSortState: () => props.multiSortState,
      defaultMultiSort: props.defaultMultiSort,
      onMultiSortChange: (next) => {
        emit('update:multiSortState', next)
        emit('multiSortChange', next)
        // remoteSort parity (multi mode): the FULL sort list re-queries the
        // server; the single `sort` param stays the single-column channel.
        if (remoteSort.value) proxyCtrl.setParams({ sorts: next })
      },
    })
    // remoteSort parity: the server owns the ordering — never re-sort locally.
    const sortedData = computed(() => (remoteSort.value ? tableData.value : sortedRows.value))
    // remoteSort parity: hand the sort state to the server. Header clicks are
    // pushed via the onSortChange/onMultiSortChange wrappers above; these
    // watches cover controlled `sort`/`multiSortState` prop updates from the
    // parent (core setParams dedupes unchanged params, so the click path does
    // not double-request — React effect parity). In multiSort mode the
    // single-column channel is inert — the multi watch below owns the sync.
    watch([internalSort, () => props.multiSort, remoteSort, () => proxyCtrl.proxy.value], () => {
      if (!proxyCtrl.proxy.value || !remoteSort.value || props.multiSort) return
      proxyCtrl.setParams({ sort: internalSort.value })
    })
    watch([multiSortState, () => props.multiSort, remoteSort, () => proxyCtrl.proxy.value], () => {
      if (!proxyCtrl.proxy.value || !remoteSort.value || !props.multiSort) return
      proxyCtrl.setParams({ sorts: multiSortState.value })
    })

    // -------- Search form (vxe-grid formConfig parity) --------
    // Draft/applied two-state: keystrokes only touch the DRAFT (never trigger a
    // query); submit/reset promote the built values into the APPLIED filters.
    // The draft is seeded from field defaultValue and re-seeded only when the
    // field set (or a default) actually changes, so an inline formConfig object
    // with a fresh identity each render never wipes user input.
    const formDraft = ref<Record<string, string>>({})
    const formApplied = ref<Record<string, string>>({})
    const formFieldSignature = computed(() =>
      (props.formConfig?.fields ?? [])
        .map((f) => `${f.key}=${f.defaultValue ?? ''}`)
        .join('\u0000'),
    )
    watch(
      formFieldSignature,
      () => {
        formDraft.value = seedFormValues(props.formConfig?.fields)
        formApplied.value = {}
      },
      { immediate: true },
    )
    const setFormValue = (key: string, value: string): void => {
      if (formDraft.value[key] === value) return
      formDraft.value = { ...formDraft.value, [key]: value }
    }
    // Batch Z: the proxy receives the text filters PLUS the comma-joined
    // checked filter sets, merged into ONE map (vxe filter-multiple remote
    // serialization parity, React parity).
    const mergedProxyFilters = (form: Record<string, string>): Record<string, string> =>
      mergeFilterValues(mergeFormFilters(props.filters ?? {}, form), props.filterValues ?? {})
    const handleFormSubmit = (): void => {
      const values = buildFormValues(props.formConfig?.fields, formDraft.value)
      props.formConfig?.onSearch?.(values)
      formApplied.value = values
      // Proxy mode: the server owns filtering — merge the form values into the
      // controller filters (page resets to 1 in core applyParams, vxe behavior).
      if (proxyCtrl.proxy.value) {
        proxyCtrl.setParams({ filters: mergedProxyFilters(values), page: 1 })
      }
    }
    const handleFormReset = (): void => {
      const defaults = seedFormValues(props.formConfig?.fields)
      formDraft.value = defaults
      const values = buildFormValues(props.formConfig?.fields, defaults)
      formApplied.value = values
      props.formConfig?.onReset?.(values)
      if (proxyCtrl.proxy.value) {
        // setParams returns false when the merged params are unchanged (e.g.
        // filters already cleared) — a reset must still re-query, so force a
        // refetch only in that no-op case (no double request when it changed).
        if (!proxyCtrl.setParams({ filters: mergedProxyFilters(values), page: 1 })) {
          void proxyCtrl.refetch()
        }
      }
    }
    // remoteFilter parity: hand the applied filter map (filters prop + form
    // values, form wins; + comma-joined checked sets, batch Z) to the server
    // and never hide rows client-side (vxe proxyConfig.filter). Live after the
    // form state so `formApplied` is referenced; setParams dedupes unchanged
    // filters.
    watch(
      [formApplied, () => props.filters, () => props.filterValues],
      () => {
        if (proxyCtrl.proxy.value && remoteFilter.value) {
          proxyCtrl.setParams({
            filters: mergedProxyFilters(formApplied.value),
          })
        }
      },
      { immediate: true },
    )

    // -------- Selection (single-sourced via core createSelectionModel) --------
    // The model owns the selected-key set plus the toggle / dedup / select-all
    // logic; the table keeps only its controlled-or-uncontrolled value shape
    // (`Array<string | number>`) and the row-id mapping. It runs in the default
    // `multiple` mode so `selectable` stays runtime-reactive — single-select is a
    // replace (`set`) and multi-select a `toggle`, matching the previous behavior.
    const selControlled = computed(() => props.selection !== undefined)
    const selectionModel = createSelectionModel<string | number>({
      defaultSelected: props.selection ?? props.defaultSelection ?? [],
      onChange: (keys) => emit('update:selection', keys),
    })
    const selectedKeys = shallowRef<Array<string | number>>(selectionModel.get())
    onBeforeUnmount(
      selectionModel.store.subscribe((keys) => {
        selectedKeys.value = keys
      }),
    )
    // Controlled: mirror the prop into the model without re-emitting onChange.
    watch(
      () => props.selection,
      (sel) => {
        if (sel !== undefined) selectionModel.sync(sel)
      },
    )
    // Controlled tables RENDER from the prop (true controlled semantics): a local
    // toggle emits update:selection, but the displayed selection only changes when
    // the parent writes `selection` back — so a parent that validates/rejects a
    // change no longer sees the row flip optimistically. Uncontrolled renders from
    // the model store as before.
    const displaySelection = computed<Array<string | number>>(() =>
      selControlled.value ? (props.selection as Array<string | number>) : selectedKeys.value,
    )
    // Re-base the model on the controlled prop before a toggle so the emitted next
    // value is computed against what the parent actually holds (not a prior,
    // possibly-rejected, optimistic value).
    const rebaseToProp = (): void => {
      if (selControlled.value) selectionModel.sync(props.selection as Array<string | number>)
    }

    // -------- Expandable detail rows (single-sourced via core createExpansion) --------
    // A leading toggle column + a full-width detail panel beneath an expanded
    // row, driven by the framework-agnostic expansion model (multiple-open). The
    // keys are the row keys as strings (matching React). Mirrors the selection
    // pattern: shallowRef + subscribe so toggling re-renders.
    const hasDetail = computed(() => props.renderDetail !== undefined)
    const expansion = createExpansion({
      mode: 'multiple',
      defaultExpanded: (props.defaultExpandedRowKeys ?? []).map(String),
      onChange: (keys) => emit('expandedRowsChange', keys),
    })
    const expandedKeys = shallowRef<string[]>(expansion.get())
    onBeforeUnmount(
      expansion.store.subscribe((keys) => {
        expandedKeys.value = keys
      }),
    )
    const isRowExpandable = (row: Record<string, unknown>, idx: number): boolean =>
      hasDetail.value && (props.rowExpandable ? props.rowExpandable(row, idx) : true)

    const rowId = (row: Record<string, unknown>, index: number): string | number => {
      const v = row[props.rowKey]
      if (typeof v === 'string' || typeof v === 'number') return v
      return index
    }

    // -------- Tree rows (opt-in via getSubRows / lazyLoad) --------
    // Flatten the nested data into the visible rows honoring the (shared)
    // expansion model. `bodyData` is the row list the body, select-all, and
    // summary all operate on — identical to `sortedRows` in flat mode, so
    // non-tree behavior is byte-identical. Tree mode is mutually exclusive with
    // detail rows and is gated off the virtual-scroll path.
    const treeMode = computed(() => props.getSubRows !== undefined || props.lazyLoad !== undefined)
    // Lazy tree (vxe lazyLoad parity, batch Z): children are fetched on first
    // expand. The loaded map wins over `getSubRows`; the loading SET drives the
    // caret render on both transitions. Both are reactive refs (the deep map
    // mutation re-walks flatTree; a new data source reference drops them —
    // React M2 parity).
    const lazyChildren = ref<Map<string, Array<Record<string, unknown>>>>(new Map())
    const lazyLoading = ref<Set<string>>(new Set())
    // Bumped whenever the data source reference changes (cache + loading set
    // cleared). A lazy-load callback captures the epoch at call time and drops
    // its result if a refresh happened while the fetch was in flight — stale
    // children must never re-seed the cleared cache (React M2 parity).
    let lazyEpoch = 0
    // The source refs (not the live copy) drive the cache lifecycle: internal
    // write-backs (edit commits / rowDrag / loadData) replace the live rows,
    // not the source arrays, so they keep the cache (React parity).
    watch(
      () => (proxyCtrl.proxy.value ? proxyCtrl.state.value.data : props.data),
      () => {
        lazyChildren.value = new Map()
        lazyLoading.value = new Set()
        lazyEpoch += 1
      },
    )
    const lazyChildrenOf = (
      row: Record<string, unknown>,
    ): Array<Record<string, unknown>> | undefined => {
      const key = String(row[props.rowKey])
      return lazyChildren.value.get(key) ?? props.getSubRows?.(row)
    }
    const flatTree = computed<Array<TreeRow<Record<string, unknown>>> | null>(() =>
      treeMode.value
        ? flattenTree(sortedData.value, {
            getKey: (r) => String(r[props.rowKey]),
            // With an active sort, sort each level's children by the same
            // comparator so the whole tree reorders hierarchically. Lazy-loaded
            // children win over `getSubRows` and still participate.
            getChildren: sortComparator.value
              ? withSortedChildren(lazyChildrenOf, sortComparator.value)
              : lazyChildrenOf,
            isExpanded: (k) => expandedKeys.value.includes(k),
          })
        : null,
    )
    // Local-mode filtering (vxe filterConfig + formConfig parity, local): the
    // `filters` prop and the applied form values merge (form wins, neither
    // input is mutated) and rows match substring, case-insensitive over
    // displayColumns ('' entries ignored) — batch X semantics, extended with
    // the `filters` prop. Remote-filter tables never hide rows locally (the
    // server owns filtering — the merged map was pushed via setParams below).
    // In proxy mode the server owns form filtering too (the applied values
    // were pushed via setParams), so only the prop map filters the loaded page
    // (React parity, batch C behavior).
    const filteredData = computed(() => {
      if (remoteFilter.value) return sortedData.value
      const merged: Record<string, string> = proxyCtrl.proxy.value
        ? (props.filters ?? {})
        : mergeFormFilters(props.filters ?? {}, formApplied.value)
      const active = Object.entries(merged).filter(([, v]) => v != null && v !== '')
      // Batch Z: per-column checked sets OR-match the raw String(value); a set
      // applies only when non-empty. AND-ed with the text channel below.
      const checkedEntries = Object.entries(props.filterValues ?? {}).filter(
        ([, values]) => values.length > 0,
      )
      if (active.length === 0 && checkedEntries.length === 0) return sortedData.value
      return sortedData.value.filter((row) => {
        const textOk = active.every(([key, value]) => {
          const col = displayColumns.value.find((c) => c.key === key)
          if (!col) return true
          return String(getCellValue(row, col) ?? '')
            .toLowerCase()
            .includes(value.toLowerCase())
        })
        const setsOk = checkedEntries.every(([key, values]) => {
          const col = displayColumns.value.find((c) => c.key === key)
          if (!col) return true
          return values.includes(String(getCellValue(row, col) ?? ''))
        })
        return textOk && setsOk
      })
    })
    const bodyData = computed(() =>
      flatTree.value ? flatTree.value.map((t) => t.row) : filteredData.value,
    )

    const cascadingTreeSelection = computed(
      () => props.treeSelectionCascade && props.selectable === 'multi' && treeMode.value,
    )
    const treeSelectionNodes = computed<TreeSelectionNode<string | number>[]>(() => {
      const getChildren = props.getSubRows
      if (!cascadingTreeSelection.value || !getChildren) return []

      const nodes: TreeSelectionNode<string | number>[] = []
      const seen = new Set<string | number>()
      let rowIndex = 0
      const walk = (rows: Array<Record<string, unknown>>, parentKey?: string | number): void => {
        for (const row of rows) {
          const key = rowId(row, rowIndex)
          rowIndex += 1
          if (seen.has(key)) continue
          seen.add(key)
          nodes.push({ key, parentKey })
          const children = getChildren(row)
          if (children && children.length > 0) walk(children, key)
        }
      }
      walk(sortedData.value)
      return nodes
    })
    const compactTreeSelectionSeed = (keys: Array<string | number>): Array<string | number> => {
      const selected = new Set(keys)
      const parentByKey = new Map(
        treeSelectionNodes.value.map((node) => [node.key, node.parentKey]),
      )
      return keys.filter((key) => {
        const visited = new Set<string | number>()
        let parent = parentByKey.get(key)
        while (parent !== undefined && !visited.has(parent)) {
          if (selected.has(parent)) return false
          visited.add(parent)
          parent = parentByKey.get(parent)
        }
        return true
      })
    }
    const resolvedTreeSelection = computed(() =>
      cascadingTreeSelection.value
        ? createTreeSelection<string | number>({
            nodes: treeSelectionNodes.value,
            // Canonical payloads contain fully-selected branches and their
            // leaves. Seed only the highest selected ancestors so rebuilding a
            // large fully-selected tree does not cascade once per descendant.
            defaultChecked: compactTreeSelectionSeed(displaySelection.value),
          })
        : null,
    )

    const isSelected = (id: string | number) =>
      resolvedTreeSelection.value?.isChecked(id) ?? displaySelection.value.includes(id)
    const isSelectionIndeterminate = (id: string | number) =>
      resolvedTreeSelection.value?.isIndeterminate(id) ?? false
    const allRowIds = computed(() =>
      cascadingTreeSelection.value
        ? treeSelectionNodes.value.map((node) => node.key)
        : bodyData.value.map((row, index) => rowId(row, index)),
    )
    const allSelected = computed(() => {
      return allRowIds.value.length > 0 && allRowIds.value.every((id) => isSelected(id))
    })
    const someSelected = computed(() => {
      return (
        !allSelected.value &&
        allRowIds.value.some((id) => isSelected(id) || isSelectionIndeterminate(id))
      )
    })

    const toggleRow = (id: string | number) => {
      rebaseToProp()
      if (props.selectable === 'single') {
        selectionModel.set(selectionModel.isSelected(id) ? [] : [id])
      } else if (props.selectable === 'multi') {
        if (cascadingTreeSelection.value) {
          // Build an action-local model from the displayed controlled value.
          // Mutating `resolvedTreeSelection` would leave its cached render model
          // optimistic when a controlled parent rejects the emitted update.
          const treeSelection = createTreeSelection<string | number>({
            nodes: treeSelectionNodes.value,
            defaultChecked: compactTreeSelectionSeed(displaySelection.value),
          })
          treeSelection.toggle(id)
          selectionModel.set(treeSelection.getChecked())
        } else {
          selectionModel.toggle(id)
        }
      }
    }
    const toggleAll = () => {
      rebaseToProp()
      if (allSelected.value) {
        selectionModel.set([])
        return
      }
      if (cascadingTreeSelection.value) {
        const treeSelection = createTreeSelection<string | number>({
          nodes: treeSelectionNodes.value,
          defaultChecked: allRowIds.value,
        })
        selectionModel.set(treeSelection.getChecked())
        return
      }
      selectionModel.set([...allRowIds.value])
    }

    // -------- Inline editing --------
    /** Encode a unique cell identity: row id + column key. */
    const editingCellId = ref<string | null>(null)
    const editingDraft = ref<string>('')
    const editError = ref<string | null>(null)
    const editorInputRef = ref<HTMLInputElement | null>(null)

    const cellId = (rowIdent: string | number, colKey: string) => `${rowIdent}::${colKey}`

    const beginEdit = (
      row: Record<string, unknown>,
      column: IrisTableColumn,
      rowIdent: string | number,
    ) => {
      if (!column.editable) return
      editingCellId.value = cellId(rowIdent, column.key)
      const current = getCellValue(row, column)
      editingDraft.value = current == null ? '' : String(current)
      editError.value = null
      void nextTick(() => editorInputRef.value?.focus())
    }

    const commitEdit = (
      row: Record<string, unknown>,
      column: IrisTableColumn,
      rowIndex: number,
    ) => {
      if (editingCellId.value === null) return
      const oldValue = getCellValue(row, column)
      const draft = editingDraft.value
      const newValue =
        column.editor === 'number'
          ? draft === '' || Number.isNaN(Number(draft))
            ? oldValue
            : Number(draft)
          : draft
      // Declarative editRules run async (may contain async validators); the
      // legacy validate callback stays sync.
      if (column.editRules && column.editRules.length > 0) {
        validateEditRulesAsync(column.editRules, draft, row).then((r) => {
          if (!r.valid) {
            editError.value = r.messages[0] ?? null
            return
          }
          finishCommit(row, column, rowIndex, oldValue, newValue)
        })
        return
      }
      // A column validator can reject the draft: keep the editor open, surface the
      // message, and skip the commit until the value is valid (or the user cancels).
      if (column.validate) {
        const error = column.validate(newValue, row)
        if (error) {
          editError.value = error
          return
        }
      }
      finishCommit(row, column, rowIndex, oldValue, newValue)
      editError.value = null
      editingCellId.value = null
      if (newValue !== oldValue) {
        emit('cellEdit', { row, column, oldValue, newValue, rowIndex })
      }
    }

    /** Shared write-back for a committed value (both edit modes, batch Z):
     * emits `cellEdit` and patches the proxy live copy (React liveData
     * parity — committed edits survive until the next refetch replaces the
     * list wholesale). */
    const writeCellValue = (
      row: Record<string, unknown>,
      column: IrisTableColumn,
      rowIndex: number,
      oldValue: unknown,
      newValue: unknown,
    ) => {
      if (newValue === oldValue) return
      emit('cellEdit', { row, column, oldValue, newValue, rowIndex })
      if (proxyCtrl.proxy.value) {
        const id = rowId(row, rowIndex)
        const idx = proxyCtrl.liveData.value.findIndex((r, i) => rowId(r, i) === id)
        if (idx >= 0) {
          const key = (column.dataIndex ?? column.key) as string
          const next = { ...proxyCtrl.liveData.value[idx], [key]: newValue }
          proxyCtrl.liveData.value = [
            ...proxyCtrl.liveData.value.slice(0, idx),
            next,
            ...proxyCtrl.liveData.value.slice(idx + 1),
          ]
        }
      }
    }

    const finishCommit = (
      row: Record<string, unknown>,
      column: IrisTableColumn,
      rowIndex: number,
      oldValue: unknown,
      newValue: unknown,
    ) => {
      editError.value = null
      editingCellId.value = null
      writeCellValue(row, column, rowIndex, oldValue, newValue)
    }

    const cancelEdit = () => {
      editError.value = null
      editingCellId.value = null
    }

    // -------- Row edit mode (vxe editConfig.mode='row' parity, batch Z) --------
    // Extends the bespoke single-session cell machinery above into a reactive
    // session MAP keyed by cellId — one `{ draft, error }` per editable column
    // of the clicked row, sharing the same commit core (`writeCellValue`). Cell
    // mode stays byte-identical; row mode commits PER CELL (Enter/blur closes
    // just that column), never the whole row at once — Escape cancels the whole
    // row, clicking another row commits the current row's open editors first
    // (React parity). Drafts/errors live in the map (deep-reactive), so the
    // per-cell editor render reads its own session.
    const rowMode = computed(() => props.editConfig?.mode === 'row')
    interface RowEditSession {
      draft: string
      error: string | null
    }
    const rowSessions = ref<Map<string, RowEditSession>>(new Map())
    const rowEditing = ref<{ k: string | number; idx: number } | null>(null)
    // Per-column editor inputs (focus targets for beginRowEdit / reopen).
    const rowEditorRefs = new Map<string, HTMLInputElement | null>()

    /** Resolve the CURRENT row object by key (a committed column's write-back
     * replaces the proxy live row, so later commits must see the fresh object). */
    const currentRowFor = (k: string | number): Record<string, unknown> | undefined =>
      bodyData.value.find((r, i) => rowId(r, i) === k)

    const beginRowEdit = (
      row: Record<string, unknown>,
      rowIndex: number,
      focusColKey?: string,
    ): void => {
      const k = rowId(row, rowIndex)
      const editableCols = leafColumns.value.filter((c) => c.editable)
      if (editableCols.length === 0) return
      const sessions = new Map<string, RowEditSession>()
      for (const col of editableCols) {
        const current = getCellValue(row, col)
        sessions.set(cellId(k, col.key), {
          draft: current == null ? '' : String(current),
          error: null,
        })
      }
      rowSessions.value = sessions
      rowEditing.value = { k, idx: rowIndex }
      // Focus the clicked column's editor when it exists, else the first
      // editable column (the editors mount on the next render).
      const focusKey =
        focusColKey && editableCols.some((c) => c.key === focusColKey)
          ? focusColKey
          : editableCols[0]!.key
      void nextTick(() => rowEditorRefs.get(focusKey)?.focus())
    }

    /** Commit ONE open session of the row (Enter/blur on that column).
     * Async editRules validate in the background; a row cancelled (Escape)
     * while the validation is in flight drops the commit (the session is
     * gone) — React M1 parity. */
    const commitRowSession = (
      k: string | number,
      column: IrisTableColumn,
      rowIndex: number,
      id: string,
    ): void => {
      const session = rowSessions.value.get(id)
      if (!session) return
      const row = currentRowFor(k)
      if (!row) return
      const oldValue = getCellValue(row, column)
      const draft = session.draft
      const newValue =
        column.editor === 'number'
          ? draft === '' || Number.isNaN(Number(draft))
            ? oldValue
            : Number(draft)
          : draft
      if (column.editRules && column.editRules.length > 0) {
        validateEditRulesAsync(column.editRules, draft, row).then((r) => {
          if (!rowSessions.value.has(id)) return
          if (!r.valid) {
            const s = rowSessions.value.get(id)
            if (s) s.error = r.messages[0] ?? null
            return
          }
          finishRowCommit(row, column, rowIndex, oldValue, newValue, id)
        })
        return
      }
      if (column.validate) {
        const error = column.validate(newValue, row)
        if (error) {
          const s = rowSessions.value.get(id)
          if (s) s.error = error
          return
        }
      }
      finishRowCommit(row, column, rowIndex, oldValue, newValue, id)
    }

    const finishRowCommit = (
      row: Record<string, unknown>,
      column: IrisTableColumn,
      rowIndex: number,
      oldValue: unknown,
      newValue: unknown,
      id: string,
    ): void => {
      rowSessions.value.delete(id)
      // All open sessions committed → the row leaves edit mode (click re-opens).
      if (rowSessions.value.size === 0) rowEditing.value = null
      writeCellValue(row, column, rowIndex, oldValue, newValue)
    }

    /** Escape: cancel EVERY open session of the row (the whole row, vxe parity). */
    const cancelRowEdit = (): void => {
      rowSessions.value = new Map()
      rowEditing.value = null
    }

    /** Clicking another row (or starting a new row): commit each open session;
     * a SYNC validation failure keeps the row open with the error visible.
     * Async-validating sessions commit in the background and land whenever
     * they resolve (per-cell commit, vxe row mode parity). */
    const switchRowEdit = (
      row: Record<string, unknown>,
      rowIndex: number,
      focusColKey?: string,
    ): void => {
      const editing = rowEditing.value
      if (editing !== null) {
        for (const [id] of rowSessions.value) {
          const colKey = id.slice(id.indexOf('::') + 2)
          const col = leafColumns.value.find((c) => c.key === colKey)
          if (!col) continue
          commitRowSession(editing.k, col, editing.idx, id)
          if (rowSessions.value.get(id)?.error != null) return
        }
      }
      beginRowEdit(row, rowIndex, focusColKey)
    }

    /** Row-mode cell click (vxe editConfig.mode='row' parity): a click on any
     * cell of a row that has editable columns opens every editable column's
     * editor; clicking a DIFFERENT row first commits the current row's open
     * editors (vxe click-elsewhere-commits). Editors stopPropagation, so
     * interactions inside an editor never reach here. A click on a column that
     * was already committed (session closed) reopens just that column. */
    const handleRowModeCellClick = (
      row: Record<string, unknown>,
      col: IrisTableColumn,
      index: number,
      k: string | number,
    ): void => {
      if (rowEditing.value?.k === k) {
        const id = cellId(k, col.key)
        if (col.editable && !rowSessions.value.has(id)) {
          const current = getCellValue(row, col)
          rowSessions.value.set(id, {
            draft: current == null ? '' : String(current),
            error: null,
          })
          void nextTick(() => rowEditorRefs.get(col.key)?.focus())
        }
      } else {
        switchRowEdit(row, index, col.key)
      }
    }

    /** Shared editor input styling (both modes, batch Z) — extracted so the
     * per-mode builders below stay read-only views over their state slots. */
    const editorInputStyle = (error: string | null): Record<string, string> => ({
      width: '100%',
      border: `1px solid ${error ? 'var(--iris-danger)' : 'var(--iris-primary)'}`,
      borderRadius: 'var(--iris-radius-sm)',
      padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
      font: 'inherit',
      background: 'var(--iris-background)',
      color: 'var(--iris-foreground)',
      outline: 'none',
      boxShadow: '0 0 0 3px color-mix(in srgb, var(--iris-primary) 18%, transparent)',
    })

    const editorErrorVNode = (editCellId: string, error: string): VNode =>
      h(
        'div',
        {
          id: `${editCellId}-error`,
          role: 'alert',
          'data-iris-table-editor-error': '',
          style: {
            marginTop: 'var(--iris-space-xxs, 4px)',
            fontSize: 'var(--iris-font-size-xs, 12px)',
            color: 'var(--iris-danger)',
          },
        },
        error,
      )

    /** Row-mode editor content: reads its session from the row session MAP.
     * Enter/blur commit THAT session; Escape cancels the whole row. */
    const buildRowSessionContent = (
      col: IrisTableColumn,
      index: number,
      k: string | number,
      editCellId: string,
      session: RowEditSession,
    ): VNode | VNode[] => {
      const error = session.error
      const input = h('input', {
        ref: (el: unknown) => {
          rowEditorRefs.set(col.key, (el ?? null) as HTMLInputElement | null)
        },
        type: col.editor === 'number' ? 'number' : 'text',
        value: session.draft,
        'data-iris-table-editor': '',
        'aria-invalid': error ? 'true' : undefined,
        'aria-describedby': error ? `${editCellId}-error` : undefined,
        onInput: (e: Event) => {
          session.draft = (e.target as HTMLInputElement).value
        },
        onKeydown: (e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitRowSession(k, col, index, editCellId)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            cancelRowEdit()
          }
        },
        onBlur: () => commitRowSession(k, col, index, editCellId),
        onClick: (e: MouseEvent) => e.stopPropagation(),
        onDblclick: (e: MouseEvent) => e.stopPropagation(),
        style: editorInputStyle(error),
      })
      return error ? [input, editorErrorVNode(editCellId, error)] : input
    }

    /** Cell-mode editor content (singleton refs, byte-identical to the
     * pre-batch-Z path). */
    const buildCellEditContent = (
      row: Record<string, unknown>,
      col: IrisTableColumn,
      index: number,
      editCellId: string,
    ): VNode | VNode[] => {
      const error = editError.value
      const input = h('input', {
        ref: (el: unknown) => {
          editorInputRef.value = (el ?? null) as HTMLInputElement | null
        },
        type: col.editor === 'number' ? 'number' : 'text',
        value: editingDraft.value,
        'data-iris-table-editor': '',
        'aria-invalid': error ? 'true' : undefined,
        'aria-describedby': error ? `${editCellId}-error` : undefined,
        onInput: (e: Event) => {
          editingDraft.value = (e.target as HTMLInputElement).value
        },
        onKeydown: (e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitEdit(row, col, index)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            cancelEdit()
          }
        },
        onBlur: () => commitEdit(row, col, index),
        onClick: (e: MouseEvent) => e.stopPropagation(),
        onDblclick: (e: MouseEvent) => e.stopPropagation(),
        style: editorInputStyle(error),
      })
      return error ? [input, editorErrorVNode(editCellId, error)] : input
    }

    /** Tree caret (vxe tree lazyLoad parity, batch Z): parents toggle the
     * shared expansion model; childless rows with a lazyLoad configured show a
     * caret that fetches children on first expand. Loading is tracked in the
     * `lazyLoading` set (drives `data-iris-tree-loading`); a throwing load
     * stays retryable; a stale fetch whose data source epoch moved is dropped
     * so the cleared cache is never re-seeded (React M2 parity). */
    const buildTreeIndent = (
      treeMeta: TreeRow<Record<string, unknown>>,
      row: Record<string, unknown>,
    ): VNode =>
      h(
        'span',
        {
          'data-iris-table-tree-indent': '',
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            flex: 'none',
            paddingLeft: `${treeMeta.depth * 16}px`,
          },
        },
        treeMeta.hasChildren ||
          (props.lazyLoad !== undefined && !lazyChildren.value.has(treeMeta.key))
          ? [
              h(
                'button',
                {
                  type: 'button',
                  'data-iris-table-tree-toggle': '',
                  'data-iris-tree-loading': lazyLoading.value.has(treeMeta.key) ? '' : undefined,
                  'aria-expanded': treeMeta.expanded ? 'true' : 'false',
                  'aria-label': t(treeMeta.expanded ? 'treeSelect.collapse' : 'treeSelect.expand'),
                  onClick: (e: MouseEvent) => {
                    e.stopPropagation()
                    if (treeMeta.hasChildren) {
                      expansion.toggle(treeMeta.key)
                      return
                    }
                    // Lazy leaf: first expand fetches the children; a second
                    // click while loading is a no-op (no double fetch).
                    if (lazyLoading.value.has(treeMeta.key)) return
                    lazyLoading.value = new Set(lazyLoading.value).add(treeMeta.key)
                    const clearLoading = () => {
                      const next = new Set(lazyLoading.value)
                      next.delete(treeMeta.key)
                      lazyLoading.value = next
                    }
                    try {
                      const epoch = lazyEpoch
                      props.lazyLoad!(row, (children) => {
                        // Stale fetch: the data source changed while this load
                        // was in flight — drop the result so the cleared cache
                        // is not re-seeded (and keep the loading flag, which
                        // may belong to a newer fetch of the same key).
                        if (epoch !== lazyEpoch) return
                        lazyChildren.value.set(treeMeta.key, children)
                        if (children && children.length > 0) {
                          expansion.toggle(treeMeta.key)
                        }
                        clearLoading()
                      })
                    } catch {
                      clearLoading()
                    }
                  },
                  style: {
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: '0',
                    marginRight: '4px',
                    font: 'inherit',
                    color: 'var(--iris-foreground)',
                    transform: treeMeta.expanded ? 'rotate(90deg)' : 'none',
                    transition: 'transform 150ms',
                  },
                },
                '▶',
              ),
            ]
          : [
              h('span', {
                'aria-hidden': 'true',
                style: { display: 'inline-block', width: '16px' },
              }),
            ],
      )

    // -------- Column widths --------
    const internalWidths = ref<IrisTableColumnWidths>({})
    // Seed internal widths from the LEAF columns when uncontrolled (a header
    // group column carries no body width; only its leaves do).
    watch(
      () => leafColumns.value,
      (cols) => {
        const seeded = { ...internalWidths.value }
        for (const col of cols) {
          if (seeded[col.key] === undefined) seeded[col.key] = resolveInitialWidth(col)
        }
        internalWidths.value = seeded
      },
      { immediate: true, deep: false },
    )
    const effectiveWidths = computed<IrisTableColumnWidths>(() => {
      if (props.columnWidths) return props.columnWidths
      return internalWidths.value
    })
    const setColumnWidths = (next: IrisTableColumnWidths) => {
      if (props.columnWidths === undefined) internalWidths.value = next
      emit('update:columnWidths', next)
    }

    const onHeaderClick = (column: IrisTableColumn) => {
      // Multi mode appends/cycles/removes columns; single mode replaces.
      if (props.multiSort) cycleMultiSort(column)
      else cycleSort(column)
    }

    /** Multi mode: click-order sequence badge on non-primary sort columns (vxe
     * sort-config sequence parity). */
    const multiSortSeq = (col: IrisTableColumn): VNode | null => {
      if (!props.multiSort) return null
      const idx = multiSortState.value.findIndex((s) => s.key === col.key)
      if (idx <= 0) return null
      return h(
        'span',
        {
          'data-iris-sort-seq': '',
          style: {
            marginInlineStart: 'var(--iris-space-xxs, 4px)',
            fontSize: 'var(--iris-font-size-xs, 12px)',
            color: 'var(--iris-muted)',
          },
        },
        String(idx + 1),
      )
    }

    const ariaSortFor = (col: IrisTableColumn): 'ascending' | 'descending' | 'none' | undefined => {
      const state = props.multiSort
        ? (multiSortState.value.find((s) => s.key === col.key) ?? null)
        : internalSort.value
      if (state?.key === col.key) return state.direction === 'asc' ? 'ascending' : 'descending'
      return col.sortable ? 'none' : undefined
    }

    const sortIndicator = (col: IrisTableColumn): VNode | null => {
      if (!col.sortable) return null
      const state = props.multiSort
        ? (multiSortState.value.find((s) => s.key === col.key) ?? null)
        : internalSort.value
      const isActive = state?.key === col.key
      const direction: IrisTableSortDirection | null = isActive ? state!.direction : null
      const color = isActive ? 'var(--iris-primary)' : 'var(--iris-muted)'
      return h(
        'span',
        {
          'aria-hidden': 'true',
          style: {
            display: 'inline-flex',
            flexDirection: 'column',
            marginInlineStart: 'var(--iris-space-xxs, 4px)',
            lineHeight: '0.6',
            fontSize: 'var(--iris-font-size-xs, 12px)',
            color,
          },
        },
        [
          h('span', { style: { opacity: direction === 'asc' ? '1' : '0.45' } }, '▲'),
          h('span', { style: { opacity: direction === 'desc' ? '1' : '0.45' } }, '▼'),
        ],
      )
    }

    /** Header filter trigger (vxe filterConfig parity, batch Z): a small icon
     * button at the end of the title; active (--iris-primary) when the column
     * has a non-empty checked set. stopPropagation keeps it from sorting.
     * Leaf-only — group headers never carry a trigger (React parity). */
    const renderFilterTrigger = (col: IrisTableColumn, leaf: boolean): VNode | null => {
      if (!leaf || !col.filterable) return null
      const active = (props.filterValues?.[col.key]?.length ?? 0) > 0
      return h(
        'button',
        {
          type: 'button',
          'data-iris-filter-trigger': col.key,
          'aria-label': t('table.filter'),
          'aria-haspopup': 'true',
          'aria-expanded':
            filterPanelState.value?.open === true && filterPanelState.value.colKey === col.key
              ? 'true'
              : undefined,
          'data-iris-filter-active': active ? 'true' : undefined,
          onClick: (e: MouseEvent) => openFilterPanel(e, col.key),
          onKeydown: (e: KeyboardEvent) => e.stopPropagation(),
          style: {
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            padding: '0',
            marginInlineStart: 'var(--iris-space-xxs, 4px)',
            fontSize: 'var(--iris-font-size-xs, 12px)',
            lineHeight: '1',
            color: active ? 'var(--iris-primary)' : 'var(--iris-muted)',
          },
        },
        '⏷',
      )
    }

    /** Build the grid-template-columns string for the current widths. Batch Y:
     * rowDrag / seq render EXPLICIT leading tracks (deliberate deviation from
     * React's auto-placement — deterministic alignment in every combination,
     * including columnVirtualization and grouped headers). */
    const leadTrackCount = (): number =>
      (props.rowDrag ? 1 : 0) +
      (props.seq ? 1 : 0) +
      (hasDetail.value ? 1 : 0) +
      (props.selectable !== 'none' ? 1 : 0)
    const gridTemplate = computed(() => {
      const parts: string[] = []
      if (props.rowDrag) parts.push(`${DRAG_COL_WIDTH}px`)
      if (props.seq) parts.push(`${SEQ_COL_WIDTH}px`)
      if (hasDetail.value) parts.push(`${EXPAND_COL_WIDTH}px`)
      if (props.selectable !== 'none') parts.push(`${SELECTION_COL_WIDTH}px`)
      for (const col of leafColumns.value) {
        parts.push(`${effectiveWidths.value[col.key] ?? resolveInitialWidth(col)}px`)
      }
      return parts.join(' ')
    })

    // -------- Cell-range selection (opt-in via `cellRange`) --------
    // The controller is created once and bridged into Vue reactivity via a
    // shallowRef subscribed to the store.
    const cellRangeCtrl = createCellRange()
    const cellRangeState = shallowRef<CellRangeState>(cellRangeCtrl.getState())
    onBeforeUnmount(
      cellRangeCtrl.subscribe((s) => {
        cellRangeState.value = s
      }),
    )
    const isInRange = (row: number, col: number): boolean => {
      const { anchor, active } = cellRangeState.value
      if (!anchor || !active) return false
      const minRow = Math.min(anchor.row, active.row)
      const maxRow = Math.max(anchor.row, active.row)
      const minCol = Math.min(anchor.col, active.col)
      const maxCol = Math.max(anchor.col, active.col)
      return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol
    }

    // -------- Grid keyboard navigation (opt-in via keyboardNavigation) --------
    // Roving 2D cell focus: exactly one data cell is tabbable; Arrow/Home/End/
    // Page keys move the focus via the core `nextGridCell` math. Off by default
    // (the table stays `role="table"` with byte-identical behavior). The actual
    // `.focus()` is delegated to the adapter by querying the root for the cell.
    const rootRef = ref<HTMLElement | null>(null)
    const focusedCell = ref<{ row: number; col: number } | null>(null)
    const GRID_NAV_KEYS = new Set<string>([
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
      if (!props.keyboardNavigation || !GRID_NAV_KEYS.has(e.key)) return
      // Only navigate from a grid cell — never hijack arrows inside an editing
      // cell's <input> (which carries no data-grid-row).
      const target = e.target as HTMLElement
      if (target.dataset.gridRow === undefined) return
      e.preventDefault()
      const current = focusedCell.value ?? { row: 0, col: 0 }
      const next = nextGridCell(current, e.key as GridNavKey, {
        rowCount: bodyData.value.length,
        colCount: leafColumns.value.length,
        pageSize: 10,
      })
      focusedCell.value = next
      const cell = rootRef.value?.querySelector<HTMLElement>(
        `[data-grid-row="${next.row}"][data-grid-col="${next.col}"]`,
      )
      cell?.focus()
    }

    // Cell-range keyboard handler: Shift+Arrow extends, Escape clears.
    const CELL_RANGE_ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
    const handleCellRangeKey = (e: KeyboardEvent): void => {
      if (!props.cellRange) return
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
      const anchor = cellRangeCtrl.getState().anchor
      const active = anchor
        ? (cellRangeCtrl.getState().active ?? { row: Number(rowAttr), col: Number(colAttr) })
        : { row: Number(rowAttr), col: Number(colAttr) }
      let nextRow = active.row
      let nextCol = active.col
      if (e.key === 'ArrowUp') nextRow = Math.max(0, nextRow - 1)
      else if (e.key === 'ArrowDown') nextRow = Math.min(bodyData.value.length - 1, nextRow + 1)
      else if (e.key === 'ArrowLeft') nextCol = Math.max(0, nextCol - 1)
      else nextCol = Math.min(leafColumns.value.length - 1, nextCol + 1)
      cellRangeCtrl.extendRange(nextRow, nextCol)
    }

    // -------- Column virtualization (opt-in) --------
    const scrollLeft = ref(0)
    const viewportWidth = ref(0)
    const colTrack = (i: number): number => leadTrackCount() + 1 + i

    if (typeof ResizeObserver !== 'undefined') {
      let ro: ResizeObserver | null = null
      onMounted(() => {
        if (!props.columnVirtualization || !rootRef.value) return
        const measure = () => {
          if (rootRef.value) viewportWidth.value = rootRef.value.clientWidth
        }
        measure()
        ro = new ResizeObserver(measure)
        ro.observe(rootRef.value)
      })
      onBeforeUnmount(() => {
        ro?.disconnect()
        ro = null
      })
    }

    // Column indices to render: visible window + overscan ∪ pinned. `null` ⇒ all.
    const visibleColSet = computed<Set<number> | null>(() => {
      if (!props.columnVirtualization) return null
      const cols = leafColumns.value
      const w = computeVirtualRange({
        itemCount: cols.length,
        scrollTop: scrollLeft.value,
        viewportSize: viewportWidth.value,
        itemSize: (i) => effectiveWidths.value[cols[i].key] ?? resolveInitialWidth(cols[i]),
        buffer: 2,
      })
      const set = new Set<number>()
      for (let i = w.startIndex; i <= w.endIndex; i += 1) set.add(i)
      cols.forEach((col, i) => {
        if (col.pinned) set.add(i)
      })
      return set
    })

    // Sticky offsets for pinned columns (mirrors the React adapter): accumulate
    // resolved widths between each pinned column and its edge (+ selection col).
    const pinnedOffsets = computed(() => {
      const map: Record<string, { side: 'left' | 'right'; offset: number }> = {}
      const widthOf = (col: IrisTableColumn) =>
        effectiveWidths.value[col.key] ?? resolveInitialWidth(col)
      let left =
        (props.rowDrag ? DRAG_COL_WIDTH : 0) +
        (props.seq ? SEQ_COL_WIDTH : 0) +
        (hasDetail.value ? EXPAND_COL_WIDTH : 0) +
        (props.selectable !== 'none' ? SELECTION_COL_WIDTH : 0)
      for (const col of leafColumns.value) {
        if (col.pinned === 'left') {
          map[col.key] = { side: 'left', offset: left }
          left += widthOf(col)
        }
      }
      let right = 0
      for (let i = leafColumns.value.length - 1; i >= 0; i -= 1) {
        const col = leafColumns.value[i]
        if (col?.pinned === 'right') {
          map[col.key] = { side: 'right', offset: right }
          right += widthOf(col)
        }
      }
      return map
    })
    const pinnedStyle = (key: string): Record<string, string> => {
      const p = pinnedOffsets.value[key]
      if (!p) return {}
      return {
        position: 'sticky',
        [p.side]: `${p.offset}px`,
        zIndex: '1',
        background: 'var(--iris-background)',
      }
    }

    // -------- Resize handle (one ref per column for useDrag) --------
    const resizeHandles = new Map<string, ReturnType<typeof ref<HTMLElement | null>>>()
    const getHandleRef = (key: string) => {
      let r = resizeHandles.get(key)
      if (!r) {
        r = ref<HTMLElement | null>(null)
        resizeHandles.set(key, r)
      }
      return r
    }
    // Track which columns have been wired so we don't double-attach useDrag.
    const wiredKeys = new Set<string>()

    /** Wire a useDrag for the given column key. Idempotent per key. */
    const wireResize = (col: IrisTableColumn) => {
      if (!props.resizableColumns) return
      if (wiredKeys.has(col.key)) return
      wiredKeys.add(col.key)
      const handle = getHandleRef(col.key)
      let startWidth = 0
      useDrag({
        handle,
        onStart: () => {
          startWidth = effectiveWidths.value[col.key] ?? resolveInitialWidth(col)
        },
        onDrag: ({ dx }) => {
          const minW = col.minWidth ?? DEFAULT_MIN_WIDTH
          const maxW = col.maxWidth ?? Infinity
          const nextW = Math.max(minW, Math.min(maxW, startWidth + dx))
          setColumnWidths({ ...effectiveWidths.value, [col.key]: nextW })
        },
      })
    }

    // -------- Row/column drag-sort (vxe rowDragConfig/columnDragConfig
    // parity, batch Y) --------
    // Both reorders are composed over the core `createSortable` controller
    // (press → threshold → moveOver by closestCenter over ref-synced rects →
    // end → commit) with container-level pointer handling — the same bridge
    // the React adapter uses. The controllers own only `{ activeId, overId }`;
    // the adapter owns the DOM (collecting rects, feeding pointer coords).
    const rowDragCtrl = createSortable()
    const rowDragState = shallowRef<SortableState>(rowDragCtrl.getState())
    onBeforeUnmount(
      rowDragCtrl.subscribe((s) => {
        rowDragState.value = s
      }),
    )
    const colDragCtrl = createSortable()
    const colDragState = shallowRef<SortableState>(colDragCtrl.getState())
    onBeforeUnmount(
      colDragCtrl.subscribe((s) => {
        colDragState.value = s
      }),
    )
    const rowRectsRef = ref<SortableRect[]>([])
    const colRectsRef = ref<SortableRect[]>([])

    const handleRowDragPointerDown = (e: PointerEvent, rowId: string): void => {
      if (!props.rowDrag || e.button !== 0) return
      e.preventDefault()
      rowDragCtrl.press(rowId, e.clientX, e.clientY)
    }
    const handleRowDragPointerMove = (e: PointerEvent): void => {
      if (!props.rowDrag) return
      if (rowDragCtrl.isPending()) {
        const started = rowDragCtrl.tryStart(e.clientX, e.clientY)
        if (started) {
          // Drop targets are collected once, at the moment the drag crosses
          // the threshold (rects are captured then reused). Each drag handle
          // carries its row's id as the attribute VALUE.
          const rects: SortableRect[] = []
          rootRef.value?.querySelectorAll('[data-iris-row-drag-handle]').forEach((el) => {
            const r = (el as HTMLElement).getBoundingClientRect()
            const id = (el as HTMLElement).getAttribute('data-iris-row-drag-handle')
            if (id) rects.push({ id, left: r.left, top: r.top, width: r.width, height: r.height })
          })
          rowRectsRef.value = rects
        }
      }
      if (rowDragCtrl.getState().activeId !== null) {
        rowDragCtrl.moveOver({ x: e.clientX, y: e.clientY }, rowRectsRef.value)
      }
    }
    const handleRowDragPointerUp = (): void => {
      if (!props.rowDrag) return
      if (rowDragCtrl.isPending()) {
        rowDragCtrl.cancel()
        return
      }
      const { activeId, overId } = rowDragCtrl.end()
      if (activeId !== null && overId !== null && activeId !== overId) {
        const rows = [...bodyData.value] as Array<Record<string, unknown>>
        const from = rows.findIndex((r, i) => String(rowId(r, i)) === activeId)
        const to = rows.findIndex((r, i) => String(rowId(r, i)) === overId)
        if (from >= 0 && to >= 0 && from !== to) {
          const [moved] = rows.splice(from, 1)
          rows.splice(to, 0, moved)
          // Reorder through the LOCAL rows ref (proxy liveData / local
          // override) so the table renders the new order immediately, then
          // report through onDataChange + the config callback (React parity).
          if (proxyCtrl.proxy.value) proxyCtrl.liveData.value = rows
          else localRowsOverride.value = rows
          props.onDataChange?.(rows)
          props.rowDrag.onReorder(rows)
        }
      }
      rowRectsRef.value = []
    }
    const handleRowDragPointerLeave = (): void => {
      if (props.rowDrag && rowDragCtrl.getState().activeId !== null) {
        rowDragCtrl.cancel()
      }
    }

    const handleColDragPointerDown = (e: PointerEvent, colKey: string): void => {
      if (!props.columnDrag || e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      colDragCtrl.press(colKey, e.clientX, e.clientY)
    }
    const handleColDragPointerMove = (e: PointerEvent): void => {
      if (!props.columnDrag) return
      if (colDragCtrl.isPending()) {
        const started = colDragCtrl.tryStart(e.clientX, e.clientY)
        if (started) {
          const rects: SortableRect[] = []
          rootRef.value?.querySelectorAll('[data-iris-table-header]').forEach((el) => {
            const r = (el as HTMLElement).getBoundingClientRect()
            const id = (el as HTMLElement).getAttribute('data-iris-table-header')
            if (id) rects.push({ id, left: r.left, top: r.top, width: r.width, height: r.height })
          })
          colRectsRef.value = rects
        }
      }
      if (colDragCtrl.getState().activeId !== null) {
        colDragCtrl.moveOver({ x: e.clientX, y: e.clientY }, colRectsRef.value)
      }
    }
    const handleColDragPointerUp = (): void => {
      if (!props.columnDrag) return
      if (colDragCtrl.isPending()) {
        colDragCtrl.cancel()
        return
      }
      const { activeId, overId } = colDragCtrl.end()
      if (activeId !== null && overId !== null && activeId !== overId) {
        const next = [...leafColumns.value]
        const from = next.findIndex((c) => c.key === activeId)
        const to = next.findIndex((c) => c.key === overId)
        if (from >= 0 && to >= 0 && from !== to) {
          const [moved] = next.splice(from, 1)
          next.splice(to, 0, moved)
          props.columnDrag.onReorder(next as IrisTableColumn<Record<string, unknown>>[])
        }
      }
      colRectsRef.value = []
    }

    // -------- spanMethod (vxe span-method parity, batch Y) --------
    // Occupied-set skip across rows: the set is cleared once per body render
    // pass and marks the cells a spanning cell covers (React parity). Plain
    // (non-reactive) Set — mutated only during render.
    const spanOccupy = new Set<string>()

    // -------- Imperative proxy methods (vxe loadData/reloadData/commitProxy/
    // getProxyInfo parity, batch Y) --------
    // Bridge the batch-X proxy controller (createRemoteTableSource): loadData
    // writes the live row list WITHOUT a query (proxy liveData / local-mode
    // override, React commitRowList parity — fires onDataChange), reloadData
    // re-fetches the current page, commitProxy merges params and re-requests,
    // getProxyInfo snapshots the controller state (null without a proxy).
    const tableExpose: IrisTableExpose<Record<string, unknown>> = {
      loadData: (rows) => {
        if (proxyCtrl.proxy.value) proxyCtrl.liveData.value = rows
        else localRowsOverride.value = rows
        props.onDataChange?.(rows)
      },
      reloadData: () => {
        void proxyCtrl.refetch()
      },
      commitProxy: (overrides) => {
        proxyCtrl.setParams(overrides)
      },
      getProxyInfo: () => {
        if (!proxyCtrl.proxy.value) return null
        const s = proxyCtrl.state.value
        return { page: s.params.page, pageSize: s.params.pageSize, total: s.total }
      },
    }
    expose(tableExpose)

    // -------- Section builders (vxe-grid formConfig / toolbarConfig / pager
    // parity, batch X) --------
    // The search form and toolbar render ABOVE the table root; the pager
    // renders BELOW the body — fragment siblings around the root (like React).
    // All are opt-in and additive: no config renders nothing, so the root stays
    // byte-identical to the pre-batch-X single-div structure. Extracted from
    // render so its lint complexity stays within the adapter budget.
    const toolbarBtnStyle = {
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      color: 'var(--iris-muted)',
      fontSize: 'var(--iris-font-size-md, 14px)',
    }

    const buildFormSection = (): VNode | null => {
      const fc = props.formConfig
      if (!fc) return null
      return h(
        'form',
        {
          'data-iris-table-form': '',
          onSubmit: (e: Event) => {
            e.preventDefault()
            handleFormSubmit()
          },
          onReset: (e: Event) => {
            e.preventDefault()
            handleFormReset()
          },
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 'var(--iris-space-sm, 12px)',
            padding: 'var(--iris-space-sm, 12px)',
            border: '1px solid var(--iris-border)',
            borderBottom: 'none',
            background: 'var(--iris-surface)',
            fontSize: 'var(--iris-font-size-sm, 13px)',
          },
        },
        [
          ...fc.fields.map((field) =>
            h(
              'div',
              {
                key: field.key,
                'data-iris-table-form-field': field.key,
                style: { minWidth: 180 },
              },
              [
                h(
                  IrisFormField,
                  { label: field.label, size: 'sm' },
                  {
                    default: () =>
                      field.type === 'select'
                        ? h(IrisSelect, {
                            items: (field.options ?? []).map((o) => ({
                              value: o.value,
                              label: o.label,
                            })),
                            modelValue: formDraft.value[field.key] ?? '',
                            placeholder: field.placeholder ?? t('select.placeholder'),
                            size: 'sm',
                            'onUpdate:modelValue': (v: unknown) =>
                              setFormValue(field.key, String(v ?? '')),
                          })
                        : h(IrisInput, {
                            modelValue: formDraft.value[field.key] ?? '',
                            placeholder: field.placeholder,
                            size: 'sm',
                            'onUpdate:modelValue': (v: string | number) =>
                              setFormValue(field.key, String(v ?? '')),
                          }),
                  },
                ),
              ],
            ),
          ),
          h('div', { style: { display: 'flex', gap: 'var(--iris-space-xs, 8px)' } }, [
            h(
              IrisButton,
              { type: 'submit', size: 'sm', 'data-iris-table-form-submit': '' },
              { default: () => fc.submitText ?? t('table.formSubmit') },
            ),
            h(
              IrisButton,
              {
                type: 'reset',
                variant: 'outline',
                size: 'sm',
                'data-iris-table-form-reset': '',
              },
              { default: () => fc.resetText ?? t('table.formReset') },
            ),
          ]),
        ],
      )
    }

    const buildToolbarSection = (): VNode | null => {
      const tb = props.toolbar
      if (!tb) return null
      const toolChildren: VNode[] = []
      if (tb.title) {
        toolChildren.push(
          h('span', { style: { fontWeight: 600, color: 'var(--iris-foreground)' } }, tb.title),
        )
      }
      toolChildren.push(h('div', { style: { flex: '1' } }))
      if (tb.onRefresh) {
        toolChildren.push(
          h(
            'button',
            {
              type: 'button',
              'data-iris-table-toolbar-refresh': '',
              'aria-label': t('table.refresh'),
              title: t('table.refresh'),
              onClick: () => {
                tb.onRefresh?.()
                // proxy mode: the built-in refresh also re-queries (vxe parity)
                void proxyCtrl.refetch()
              },
              style: toolbarBtnStyle,
            },
            '↻',
          ),
        )
      }
      if (tb.onExport) {
        toolChildren.push(
          h(
            'button',
            {
              type: 'button',
              'data-iris-table-toolbar-export': '',
              'aria-label': t('table.export'),
              title: t('table.export'),
              onClick: () => tb.onExport?.(),
              style: toolbarBtnStyle,
            },
            '⇩',
          ),
        )
      }
      if (tb.batch && props.selectable === 'multi' && displaySelection.value.length > 0) {
        toolChildren.push(
          h(
            'button',
            {
              type: 'button',
              'data-iris-table-toolbar-batch': '',
              'aria-label': tb.batch.label,
              title: tb.batch.label,
              onClick: () => tb.batch!.onClick([...displaySelection.value]),
              style: {
                border: 'none',
                cursor: 'pointer',
                background: 'var(--iris-primary)',
                color: 'var(--iris-primary-foreground)',
                fontSize: 'var(--iris-font-size-md, 14px)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--iris-space-xxs, 4px)',
                padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                borderRadius: 'var(--iris-radius-sm, 4px)',
              },
            },
            [
              tb.batch.icon
                ? h(
                    'span',
                    {
                      'aria-hidden': 'true',
                      style: { fontSize: 'var(--iris-font-size-sm, 13px)' },
                    },
                    tb.batch.icon,
                  )
                : null,
              tb.batch.label,
            ],
          ),
        )
      }
      if (tb.buttons && tb.buttons.length > 0) {
        for (const btn of tb.buttons) {
          toolChildren.push(
            h(
              'button',
              {
                key: btn.key,
                type: 'button',
                'data-iris-table-toolbar-button': btn.key,
                [`data-iris-table-toolbar-button-${btn.key}`]: '',
                'aria-label': btn.label,
                title: btn.label,
                onClick: btn.onClick,
                style: {
                  ...toolbarBtnStyle,
                  color: 'var(--iris-foreground)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--iris-space-xxs, 4px)',
                  padding: '0 var(--iris-space-xxs, 4px)',
                },
              },
              [
                btn.icon
                  ? h(
                      'span',
                      {
                        'aria-hidden': 'true',
                        style: { fontSize: 'var(--iris-font-size-sm, 13px)' },
                      },
                      btn.icon,
                    )
                  : null,
                btn.label,
              ],
            ),
          )
        }
      }
      return h(
        'div',
        {
          'data-iris-table-toolbar': '',
          style: {
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
          },
        },
        toolChildren,
      )
    }

    // Server-side pager (vxe-grid proxyConfig parity): driven by the
    // controller's page/pageSize/total; page changes call setParams and
    // proxyConfig.onPageChange. pageSizes is NOT part of batch X (documented
    // as deferred — the pager is page-only).
    const buildPagerSection = (): VNode | null => {
      if (!proxyCtrl.proxy.value) return null
      const st = proxyCtrl.state.value
      return h(
        'div',
        {
          'data-iris-table-pager': '',
          style: {
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
            borderTop: '1px solid var(--iris-border)',
            background: 'var(--iris-surface)',
          },
        },
        [
          h(IrisPagination, {
            modelValue: st.params.page,
            total: st.total,
            pageSize: st.params.pageSize,
            size: 'sm',
            'onUpdate:modelValue': (page: number) => {
              proxyCtrl.setParams({ page })
              props.proxyConfig?.onPageChange?.(page, proxyCtrl.state.value.params.pageSize)
            },
          }),
        ],
      )
    }

    // -------- Right-click context menu (vxe contextMenu parity, batch Z) --------
    // Transient state: items + params are computed ONCE per open from the
    // callback; the cursor coordinates live in a virtual floating anchor (a
    // fake element whose getBoundingClientRect returns the zero-size cursor
    // rect). useFloating's watch unwraps the anchor ref, so re-assigning the
    // fake anchor on a right-click while the menu is open repositions it at
    // the new cursor — no remount token needed (React uses a seq key for the
    // same reason). Dismissal: Escape + outside pointer-down (useDismiss) and
    // any scroll (capture-phase document listener). Teleported to body so the
    // table's overflow clipping never cuts it.
    const contextMenuState = ref<{
      open: boolean
      items: Array<{ key: string; label: string; disabled?: boolean }>
      params: IrisTableContextMenuParams<Record<string, unknown>>
    } | null>(null)
    const contextAnchorRef = ref<HTMLElement | null>(null)
    const contextMenuRef = ref<HTMLElement | null>(null)
    const closeContextMenu = (): void => {
      if (contextMenuState.value) contextMenuState.value.open = false
    }
    const handleContextMenu = (
      e: MouseEvent,
      row: Record<string, unknown>,
      col: IrisTableColumn,
      idx: number,
      ci: number,
    ): void => {
      if (!props.contextMenu) return
      e.preventDefault()
      contextAnchorRef.value = {
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
      const params: IrisTableContextMenuParams<Record<string, unknown>> = {
        row,
        column: col,
        rowIndex: idx,
        columnIndex: ci,
      }
      contextMenuState.value = { open: true, items: props.contextMenu.items(params), params }
    }
    const contextMenuOpen = computed(() => contextMenuState.value?.open === true)
    const { floatingStyles: contextMenuStyles } = useFloating({
      anchor: contextAnchorRef,
      floating: contextMenuRef,
      open: contextMenuOpen,
      placement: 'bottom-start',
      // Cursor-anchored menu, vxe parity: with a zero-size anchor at the
      // viewport edge, flip/shift would clamp the coordinates away from the
      // cursor (React parity — deliberately disabled).
      flip: false,
      shift: false,
    })
    useDismiss({
      enabled: contextMenuOpen,
      exclude: [contextMenuRef],
      onDismiss: closeContextMenu,
    })
    // Scroll anywhere closes the menu. Capture phase so scrolling inside any
    // nested scroll container (or the table itself) also counts.
    watch(contextMenuOpen, (open) => {
      if (typeof document === 'undefined') return
      if (open) document.addEventListener('scroll', closeContextMenu, true)
      else document.removeEventListener('scroll', closeContextMenu, true)
    })
    onScopeDispose(() => {
      if (typeof document === 'undefined') return
      document.removeEventListener('scroll', closeContextMenu, true)
    })

    const buildContextMenuSection = (): VNode | null => {
      const st = contextMenuState.value
      if (!st || !st.open) return null
      const node = h(
        'div',
        {
          ref: (el: unknown) => {
            contextMenuRef.value = (el ?? null) as HTMLElement | null
          },
          role: 'menu',
          'data-iris-table-context-menu': '',
          style: {
            ...contextMenuStyles.value,
            zIndex: 'var(--iris-z-popover, 1000)',
            background: 'var(--iris-surface-floating, var(--iris-surface))',
            color: 'var(--iris-foreground)',
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-md, 6px)',
            boxShadow: 'var(--iris-shadow-lg)',
            padding: 'var(--iris-space-xxs, 4px)',
            minWidth: '160px',
            display: 'flex',
            flexDirection: 'column',
          },
        },
        st.items.map((item) =>
          h(
            'button',
            {
              key: item.key,
              type: 'button',
              role: 'menuitem',
              'data-iris-table-context-menu-item': item.key,
              disabled: item.disabled,
              'aria-disabled': item.disabled ? 'true' : undefined,
              onClick: () => {
                props.contextMenu!.onSelect(item.key, st.params)
                closeContextMenu()
              },
              style: {
                border: 'none',
                background: 'transparent',
                cursor: item.disabled ? 'default' : 'pointer',
                color: item.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
                font: 'inherit',
                textAlign: 'start',
                padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
                borderRadius: 'var(--iris-radius-sm, 4px)',
              },
            },
            item.label,
          ),
        ),
      )
      return h(Teleport, { to: 'body' }, [node])
    }

    // -------- Header filter panel (vxe filterConfig parity, batch Z) --------
    // One panel at a time, keyed by the column whose trigger was clicked. The
    // anchor is the trigger BUTTON itself (a real DOM node), captured at click
    // time. Opening re-seeds the draft from the applied `filterValues`;
    // 确认 (confirm) applies the draft, 清除 (clear) applies an empty set
    // immediately, and any dismissal discards the draft.
    const filterPanelState = ref<{ open: boolean; colKey: string } | null>(null)
    const filterAnchorRef = ref<HTMLButtonElement | null>(null)
    const filterPanelRef = ref<HTMLElement | null>(null)
    const filterDraft = ref<string[]>([])
    const closeFilterPanel = (): void => {
      if (filterPanelState.value) filterPanelState.value.open = false
    }
    const openFilterPanel = (e: MouseEvent, colKey: string): void => {
      // Never let the trigger click reach the header cell (which would sort).
      e.stopPropagation()
      filterAnchorRef.value = e.currentTarget as HTMLButtonElement
      filterDraft.value = [...(props.filterValues?.[colKey] ?? [])]
      filterPanelState.value = { open: true, colKey }
    }
    const filterPanelOpen = computed(() => filterPanelState.value?.open === true)
    const { floatingStyles: filterPanelStyles } = useFloating({
      anchor: filterAnchorRef,
      floating: filterPanelRef,
      open: filterPanelOpen,
      placement: 'bottom-start',
    })
    useDismiss({
      enabled: filterPanelOpen,
      exclude: [filterPanelRef, filterAnchorRef],
      onDismiss: closeFilterPanel,
    })
    watch(filterPanelOpen, (open) => {
      if (typeof document === 'undefined') return
      if (open) document.addEventListener('scroll', closeFilterPanel, true)
      else document.removeEventListener('scroll', closeFilterPanel, true)
    })
    onScopeDispose(() => {
      if (typeof document === 'undefined') return
      document.removeEventListener('scroll', closeFilterPanel, true)
    })
    const applyFilterValues = (colKey: string, values: string[]): void => {
      props.onFilterValuesChange?.({ ...(props.filterValues ?? {}), [colKey]: values })
    }
    const clearFilterValues = (colKey: string): void => {
      const next = { ...(props.filterValues ?? {}) }
      delete next[colKey]
      props.onFilterValuesChange?.(next)
    }
    const toggleFilterDraft = (value: string): void => {
      filterDraft.value = filterDraft.value.includes(value)
        ? filterDraft.value.filter((v) => v !== value)
        : [...filterDraft.value, value]
    }

    const buildFilterPanelSection = (): VNode | null => {
      const st = filterPanelState.value
      if (!st || !st.open) return null
      const col = displayColumns.value.find((c) => c.key === st.colKey)
      if (!col || !col.filterable) return null
      const options = col.filterOptions ?? []
      const node = h(
        'div',
        {
          ref: (el: unknown) => {
            filterPanelRef.value = (el ?? null) as HTMLElement | null
          },
          role: 'dialog',
          'aria-label': t('table.filter'),
          'data-iris-table-filter-panel': '',
          'data-iris-table-filter-column': st.colKey,
          style: {
            ...filterPanelStyles.value,
            zIndex: 'var(--iris-z-popover, 1000)',
            background: 'var(--iris-surface-floating, var(--iris-surface))',
            color: 'var(--iris-foreground)',
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-md, 6px)',
            boxShadow: 'var(--iris-shadow-lg)',
            padding: 'var(--iris-space-sm, 12px)',
            minWidth: '180px',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--iris-space-xxs, 4px)',
          },
        },
        [
          ...options.map((opt) =>
            h(
              'div',
              {
                key: opt.value,
                'data-iris-filter-option': opt.value,
                style: { display: 'flex', alignItems: 'center' },
              },
              [
                h(
                  IrisCheckbox,
                  {
                    modelValue: filterDraft.value.includes(opt.value),
                    size: 'sm',
                    'onUpdate:modelValue': () => toggleFilterDraft(opt.value),
                  },
                  { default: () => opt.label },
                ),
              ],
            ),
          ),
          h(
            'div',
            {
              style: {
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 'var(--iris-space-xs, 8px)',
                marginTop: 'var(--iris-space-xs, 8px)',
              },
            },
            [
              h(
                'button',
                {
                  type: 'button',
                  'data-iris-filter-clear': '',
                  onClick: () => {
                    clearFilterValues(st.colKey)
                    closeFilterPanel()
                  },
                  style: {
                    border: '1px solid var(--iris-border)',
                    background: 'transparent',
                    color: 'var(--iris-foreground)',
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: 'var(--iris-font-size-sm, 13px)',
                    padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
                    borderRadius: 'var(--iris-radius-sm, 4px)',
                  },
                },
                t('table.filterClear'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  'data-iris-filter-confirm': '',
                  onClick: () => {
                    applyFilterValues(st.colKey, filterDraft.value)
                    closeFilterPanel()
                  },
                  style: {
                    border: '1px solid var(--iris-primary)',
                    background: 'var(--iris-primary)',
                    color: 'var(--iris-primary-foreground, #fff)',
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: 'var(--iris-font-size-sm, 13px)',
                    padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
                    borderRadius: 'var(--iris-radius-sm, 4px)',
                  },
                },
                t('table.filterConfirm'),
              ),
            ],
          ),
        ],
      )
      return h(Teleport, { to: 'body' }, [node])
    }

    return () => {
      const showSelection = props.selectable !== 'none'
      const showDetail = hasDetail.value
      const showDrag = props.rowDrag !== undefined
      const showSeq = props.seq === true
      // spanMethod occupy set: cleared once per body render pass (React
      // parity), marked by the spanning cells as they render. Unconditional
      // clear — the set is only mutated under a spanMethod guard, so clearing
      // an unused set costs nothing.
      spanOccupy.clear()

      // Lead placeholder cells (batch Y): seq / drag render EXPLICIT leading
      // tracks (deliberate deviation from React's CSS auto-placement —
      // deterministic alignment in every combination, including
      // columnVirtualization and grouped headers), so the flat header and
      // summary rows render matching placeholders. `data-iris-table-header`
      // carries the drag-target id; drops onto placeholders are no-ops (their
      // keys never match a real column).
      const leadFlatHeaderCells = (): VNode[] => {
        const cells: VNode[] = []
        if (showDrag) {
          cells.push(
            h('div', {
              role: 'columnheader',
              key: '__drag__',
              'data-iris-table-header': '__drag',
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                background: 'var(--iris-surface)',
                borderBottom: '1px solid var(--iris-border)',
              },
            }),
          )
        }
        if (showSeq) {
          cells.push(
            h('div', {
              role: 'columnheader',
              key: '__seq__',
              'data-iris-table-header': '__seq',
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                background: 'var(--iris-surface)',
                borderBottom: '1px solid var(--iris-border)',
              },
            }),
          )
        }
        return cells
      }
      const leadSummaryCells = (): VNode[] => {
        const cells: VNode[] = []
        if (showDrag) {
          cells.push(
            h('div', {
              key: '__drag',
              role: 'cell',
              'data-iris-table-cell': '__drag',
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 12px',
              },
            }),
          )
        }
        if (showSeq) {
          cells.push(
            h('div', {
              key: '__seq',
              role: 'cell',
              'data-iris-table-cell': '__seq',
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 12px',
              },
            }),
          )
        }
        if (showSelection) {
          cells.push(
            h('div', {
              key: '__selection',
              role: 'cell',
              'data-iris-table-cell': '__selection',
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 12px',
              },
            }),
          )
        }
        return cells
      }

      // -------- Grouped (multi-level) header --------
      // When any column carries `children`, render the header as a CSS grid of
      // `headerMatrix.length` rows; each cell placed by its leaf-column span
      // (colStart/colSpan) and row span. Leaf header cells keep the full sort
      // behavior; group cells are spanning labels. The single-row (flat) header
      // below is rendered unchanged otherwise.
      const buildGroupedHeader = (matrix: NonNullable<typeof headerMatrix.value>): VNode => {
        const lead =
          (showDrag ? 1 : 0) + (showSeq ? 1 : 0) + (showDetail ? 1 : 0) + (showSelection ? 1 : 0)
        const cells: VNode[] = []
        if (showDrag) {
          cells.push(
            h('div', {
              key: '__drag__',
              role: 'columnheader',
              'data-iris-table-header': '__drag',
              style: { gridColumn: '1', gridRow: '1 / -1' },
            }),
          )
        }
        if (showSeq) {
          cells.push(
            h('div', {
              key: '__seq__',
              role: 'columnheader',
              'data-iris-table-header': '__seq',
              style: { gridColumn: showDrag ? '2' : '1', gridRow: '1 / -1' },
            }),
          )
        }
        if (showDetail) {
          cells.push(
            h('div', {
              key: '__expand__',
              role: 'columnheader',
              style: {
                gridColumn: `${(showDrag ? 1 : 0) + (showSeq ? 1 : 0) + 1}`,
                gridRow: '1 / -1',
              },
            }),
          )
        }
        if (showSelection) {
          cells.push(
            h(
              'div',
              {
                key: '__select__',
                role: 'columnheader',
                'data-iris-table-header': '',
                style: {
                  gridColumn: `${(showDrag ? 1 : 0) + (showSeq ? 1 : 0) + (showDetail ? 1 : 0) + 1}`,
                  gridRow: '1 / -1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 12px',
                  background: 'var(--iris-surface)',
                  borderBottom: '1px solid var(--iris-border)',
                },
              },
              props.selectable === 'multi'
                ? [
                    [
                      h(IrisCheckbox, {
                        modelValue: allSelected.value
                          ? true
                          : someSelected.value
                            ? 'indeterminate'
                            : false,
                        size: 'sm',
                        ariaLabel: t('table.selectAll'),
                        'onUpdate:modelValue': toggleAll,
                      }),
                      props.selection && props.selection.length > 0
                        ? h(
                            'span',
                            {
                              'data-iris-table-selected-count': '',
                              style: {
                                marginInlineStart: 'var(--iris-space-xs, 8px)',
                                fontSize: 'var(--iris-font-size-sm, 13px)',
                                color: 'var(--iris-muted)',
                                whiteSpace: 'nowrap',
                              },
                            },
                            t('table.selectedCount', { count: String(props.selection.length) }),
                          )
                        : null,
                    ],
                  ]
                : '',
            ),
          )
        }
        for (const rowCells of matrix) {
          for (const cell of rowCells) {
            const col = cell.column
            const isLeaf = !col.children || col.children.length === 0
            const sortable = isLeaf && col.sortable
            const align = col.align ?? 'left'
            const headerSlot = slots[`header.${col.key}`]
            const title = headerSlot?.({ column: col }) ?? col.title
            cells.push(
              h(
                'div',
                {
                  key: `${col.key}-${cell.level}`,
                  role: 'columnheader',
                  'data-iris-table-header': col.key,
                  'data-iris-table-header-group': isLeaf ? undefined : '',
                  'aria-colspan': cell.colSpan,
                  onClick: sortable ? () => onHeaderClick(col) : undefined,
                  'aria-sort': sortable ? ariaSortFor(col) : undefined,
                  style: {
                    gridColumn: `${lead + cell.colStart} / span ${cell.colSpan}`,
                    gridRow: `${cell.level + 1} / span ${cell.rowSpan}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isLeaf
                      ? align === 'right'
                        ? 'flex-end'
                        : align === 'center'
                          ? 'center'
                          : 'flex-start'
                      : 'center',
                    padding: '8px var(--iris-padding-md)',
                    cursor: sortable ? 'pointer' : 'default',
                    userSelect: sortable ? 'none' : 'auto',
                    background: 'var(--iris-surface)',
                    borderBottom: '1px solid var(--iris-border)',
                    fontWeight: '600',
                    fontSize: 'var(--iris-font-size-md, 14px)',
                    color: 'var(--iris-foreground)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  },
                },
                [
                  title,
                  sortable ? sortIndicator(col) : null,
                  multiSortSeq(col),
                  renderFilterTrigger(col, isLeaf),
                ],
              ),
            )
          }
        }
        return h(
          'div',
          {
            role: 'row',
            'data-iris-table-row': 'header',
            'data-iris-table-header-row': '',
            'data-iris-table-header-grouped': '',
            style: {
              display: 'grid',
              gridTemplateColumns: gridTemplate.value,
              gridTemplateRows: `repeat(${matrix.length}, auto)`,
            },
          },
          cells,
        )
      }

      const headerCells: VNode[] = leadFlatHeaderCells()
      if (showDetail) {
        headerCells.push(
          h('div', {
            role: 'columnheader',
            key: '__expand__',
            'data-iris-table-header': '__expand',
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              background: 'var(--iris-surface)',
              borderBottom: '1px solid var(--iris-border)',
            },
          }),
        )
      }
      if (showSelection) {
        headerCells.push(
          h(
            'div',
            {
              role: 'columnheader',
              key: '__select__',
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 12px',
                background: 'var(--iris-surface)',
                borderBottom: '1px solid var(--iris-border)',
              },
            },
            props.selectable === 'multi'
              ? [
                  h(IrisCheckbox, {
                    modelValue: allSelected.value
                      ? true
                      : someSelected.value
                        ? 'indeterminate'
                        : false,
                    size: 'sm',
                    ariaLabel: t('table.selectAll'),
                    'onUpdate:modelValue': toggleAll,
                  }),
                ]
              : '',
          ),
        )
      }
      for (let ci = 0; ci < leafColumns.value.length; ci += 1) {
        const col = leafColumns.value[ci]
        if (visibleColSet.value && !visibleColSet.value.has(ci)) continue
        const align = col.align ?? 'left'
        const headerSlot = slots[`header.${col.key}`]
        const title = headerSlot?.({ column: col }) ?? col.title
        wireResize(col)
        const handle = props.resizableColumns
          ? h('span', {
              ref: (el: unknown) => {
                getHandleRef(col.key).value = (el ?? null) as HTMLElement | null
              },
              role: 'separator',
              'aria-orientation': 'vertical',
              'aria-label': `Resize ${col.title}`,
              tabindex: 0,
              'data-iris-table-resize-handle': '',
              'data-column-key': col.key,
              onClick: (e: MouseEvent) => e.stopPropagation(),
              onKeydown: (e: KeyboardEvent) => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
                e.preventDefault()
                e.stopPropagation()
                const minW = col.minWidth ?? DEFAULT_MIN_WIDTH
                const maxW = col.maxWidth ?? Infinity
                const cur = effectiveWidths.value[col.key] ?? resolveInitialWidth(col)
                const delta = e.key === 'ArrowRight' ? RESIZE_STEP : -RESIZE_STEP
                setColumnWidths({
                  ...effectiveWidths.value,
                  [col.key]: Math.max(minW, Math.min(maxW, cur + delta)),
                })
              },
              style: {
                position: 'absolute',
                right: '0',
                top: '0',
                bottom: '0',
                width: '6px',
                cursor: 'col-resize',
                touchAction: 'none',
                userSelect: 'none',
                zIndex: '1',
              },
            })
          : null

        headerCells.push(
          h(
            'div',
            {
              key: col.key,
              role: 'columnheader',
              'data-iris-table-header': col.key,
              'data-iris-table-pinned': col.pinned,
              // Column drag-sort (vxe columnDragConfig parity, batch Y): the
              // header cell is the press target; grouped headers are NOT
              // supported (documented simplification — the reorder maps leaf
              // columns back to the parent, which a group column cannot do).
              'data-iris-col-drag-active':
                props.columnDrag && colDragState.value.activeId === col.key ? 'true' : undefined,
              'data-iris-col-drag-over':
                props.columnDrag && colDragState.value.overId === col.key ? 'true' : undefined,
              onPointerdown:
                props.columnDrag && !grouped.value
                  ? (e: PointerEvent) => handleColDragPointerDown(e, col.key)
                  : undefined,
              onClick: () => onHeaderClick(col),
              style: {
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent:
                  align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
                padding: '8px var(--iris-padding-md)',
                cursor: col.sortable ? 'pointer' : 'default',
                userSelect: col.sortable ? 'none' : 'auto',
                background: 'var(--iris-surface)',
                borderBottom: '1px solid var(--iris-border)',
                fontWeight: '600',
                fontSize: 'var(--iris-font-size-md, 14px)',
                color: 'var(--iris-foreground)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                ...(visibleColSet.value ? { gridColumnStart: String(colTrack(ci)) } : {}),
                ...(col.pinned
                  ? { ...pinnedStyle(col.key), background: 'var(--iris-surface)' }
                  : {}),
              },
              'aria-sort': ariaSortFor(col),
            },
            [title, sortIndicator(col), multiSortSeq(col), renderFilterTrigger(col, true), handle],
          ),
        )
      }

      const headerRow =
        grouped.value && headerMatrix.value
          ? buildGroupedHeader(headerMatrix.value)
          : h(
              'div',
              {
                role: 'row',
                'data-iris-table-header-row': '',
                style: {
                  display: 'grid',
                  gridTemplateColumns: gridTemplate.value,
                },
              },
              headerCells,
            )

      const renderRow = (
        row: Record<string, unknown>,
        index: number,
        style?: Record<string, string>,
        treeMeta?: TreeRow<Record<string, unknown>>,
      ): VNode => {
        const id = rowId(row, index)
        const selected = isSelected(id)
        const cells: VNode[] = []
        if (showDrag) {
          const rowDragActive = rowDragState.value.activeId === String(id)
          const rowDragOver = rowDragState.value.overId === String(id)
          cells.push(
            h(
              'div',
              {
                key: '__drag',
                role: 'cell',
                'data-iris-table-cell': '__drag',
                // The drag handle carries the row's id as its attribute VALUE
                // (rect collection for closestCenter reads it back).
                'data-iris-row-drag-handle': String(id),
                'data-iris-row-drag-active': rowDragActive ? 'true' : undefined,
                'data-iris-row-drag-over': rowDragOver ? 'true' : undefined,
                onPointerdown: (e: PointerEvent) => handleRowDragPointerDown(e, String(id)),
                onClick: (e: MouseEvent) => e.stopPropagation(),
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--iris-border)',
                  cursor: 'grab',
                  color: 'var(--iris-muted)',
                  background: rowDragActive
                    ? 'var(--iris-surface-hover)'
                    : rowDragOver
                      ? 'var(--iris-surface-selected, rgba(99,102,241,0.12))'
                      : 'transparent',
                },
              },
              [
                h(
                  'span',
                  {
                    'aria-hidden': 'true',
                    style: { fontSize: 'var(--iris-font-size-sm, 13px)' },
                  },
                  '⠿',
                ),
              ],
            ),
          )
        }
        if (showSeq) {
          cells.push(
            h(
              'div',
              {
                key: '__seq',
                role: 'cell',
                'data-iris-table-cell': '__seq',
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--iris-border)',
                  color: 'var(--iris-muted)',
                  userSelect: 'none',
                },
              },
              String(index + props.seqStartIndex),
            ),
          )
        }
        if (showDetail) {
          const rowExpandable = isRowExpandable(row, index)
          const isExpanded = expandedKeys.value.includes(String(id))
          cells.push(
            h(
              'div',
              {
                key: '__expand',
                role: 'cell',
                'data-iris-table-cell': '__expand',
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--iris-border)',
                },
              },
              rowExpandable
                ? [
                    h(
                      'button',
                      {
                        type: 'button',
                        'data-iris-table-expand-toggle': '',
                        'aria-expanded': isExpanded ? 'true' : 'false',
                        'aria-label': t(isExpanded ? 'treeSelect.collapse' : 'treeSelect.expand'),
                        onClick: (e: MouseEvent) => {
                          e.stopPropagation()
                          expansion.toggle(String(id))
                        },
                        style: {
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          padding: '0',
                          font: 'inherit',
                          color: 'var(--iris-foreground)',
                          transform: isExpanded ? 'rotate(90deg)' : 'none',
                          transition: 'transform 150ms',
                        },
                      },
                      '▶',
                    ),
                  ]
                : '',
            ),
          )
        }
        if (showSelection) {
          cells.push(
            h(
              'div',
              {
                role: 'cell',
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--iris-border)',
                },
              },
              [
                h(IrisCheckbox, {
                  modelValue: isSelectionIndeterminate(id) ? 'indeterminate' : selected,
                  size: 'sm',
                  ariaLabel: t('table.selectRow', { key: id }),
                  'onUpdate:modelValue': () => toggleRow(id),
                  onClick: (e: MouseEvent) => e.stopPropagation(),
                }),
              ],
            ),
          )
        }
        for (let ci = 0; ci < leafColumns.value.length; ci += 1) {
          const col = leafColumns.value[ci]
          if (visibleColSet.value && !visibleColSet.value.has(ci)) continue
          // spanMethod (vxe span-method parity, batch Y): the occupy set is
          // cleared once per body render pass; spanning cells mark the cells
          // they cover, which then render null (React parity).
          const span = resolveSpan(spanOccupy, index, ci, props.spanMethod)
          if (span === null) continue
          const rowspan = span.rowspan
          const colspan = span.colspan
          const align = col.align ?? 'left'
          const cellSlot = slots[`cell.${col.key}`]
          // Batch Z row mode: the cell is part of an open row-edit session map
          // (per editable column) — cell mode keeps the singleton refs.
          const isRowEditing =
            rowMode.value &&
            rowEditing.value !== null &&
            rowEditing.value.k === id &&
            rowSessions.value.has(cellId(id, col.key))
          const isEditing = isRowEditing || editingCellId.value === cellId(id, col.key)

          let content: unknown
          if (isEditing) {
            const editCellId = cellId(id, col.key)
            content = isRowEditing
              ? buildRowSessionContent(
                  col,
                  index,
                  id,
                  editCellId,
                  rowSessions.value.get(editCellId)!,
                )
              : buildCellEditContent(row, col, index, editCellId)
          } else {
            content =
              cellSlot?.({ row, index, value: getCellValue(row, col) }) ??
              String(getCellValue(row, col) ?? '')
          }

          // Tree mode: in the first data cell, prepend a depth-indent span that
          // holds an expand/collapse toggle (parents) or a fixed-width spacer
          // (leaves, so they align). Renders before the cell's content.
          const treeIndent: VNode | null =
            treeMeta && ci === 0 ? buildTreeIndent(treeMeta, row) : null

          const cellChildren: VNode | VNode[] | string = treeIndent
            ? [treeIndent, ...(Array.isArray(content) ? content : [content as VNode | string])]
            : (content as VNode | VNode[] | string)

          cells.push(
            h(
              'div',
              {
                key: col.key,
                role: 'cell',
                'data-iris-table-cell': col.key,
                'data-iris-table-pinned': col.pinned,
                'data-editable': col.editable ? '' : undefined,
                'data-editing': isEditing ? '' : undefined,
                // Grid keyboard navigation (opt-in): grid coords + roving tabindex
                // (exactly one cell is 0) + an onFocus that syncs the focused cell.
                ...(props.keyboardNavigation
                  ? {
                      'data-grid-row': index,
                      'data-grid-col': ci,
                      tabindex: (
                        focusedCell.value
                          ? focusedCell.value.row === index && focusedCell.value.col === ci
                          : index === 0 && ci === 0
                      )
                        ? 0
                        : -1,
                      onFocus: () => {
                        focusedCell.value = { row: index, col: ci }
                      },
                    }
                  : {}),
                // Cell-range selection (opt-in): data attributes + click handler.
                ...(props.cellRange
                  ? {
                      'data-iris-cell-row': index,
                      'data-iris-cell-col': ci,
                      'data-iris-cell-selected': isInRange(index, ci) ? 'true' : undefined,
                      onClick: (e: MouseEvent) => {
                        if (e.shiftKey) {
                          cellRangeCtrl.extendRange(index, ci)
                        } else {
                          cellRangeCtrl.startRange(index, ci)
                        }
                      },
                    }
                  : {}),
                onDblclick: rowMode.value
                  ? () => switchRowEdit(row, index, col.key)
                  : col.editable
                    ? () => beginEdit(row, col, id)
                    : undefined,
                onClick: rowMode.value
                  ? () => handleRowModeCellClick(row, col, index, id)
                  : col.editable && props.editConfig?.trigger === 'click'
                    ? () => beginEdit(row, col, id)
                    : undefined,
                onContextmenu: props.contextMenu
                  ? (e: MouseEvent) => handleContextMenu(e, row, col, index, ci)
                  : undefined,
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent:
                    align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
                  background: 'var(--iris-cell-bg, transparent)',
                  padding: isEditing
                    ? 'var(--iris-space-xxs, 4px)'
                    : 'var(--iris-space-xs, 8px) var(--iris-padding-md)',
                  borderBottom: '1px solid var(--iris-border)',
                  fontSize: 'var(--iris-font-size-md, 14px)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  cursor: col.editable ? 'cell' : 'default',
                  ...(props.cellRange && isInRange(index, ci)
                    ? { background: 'var(--iris-surface-selected, rgba(99,102,241,0.12))' }
                    : {}),
                  ...(visibleColSet.value ? { gridColumnStart: String(colTrack(ci)) } : {}),
                  ...(colspan > 1 ? { gridColumnEnd: `span ${colspan}` } : {}),
                  ...(rowspan > 1 ? { gridRowEnd: `span ${rowspan}` } : {}),
                  ...pinnedStyle(col.key),
                },
              },
              cellChildren,
            ),
          )
        }
        return h(
          'div',
          {
            key: String(id),
            role: 'row',
            // Announce selection to assistive tech (parity with the React
            // adapter); `data-state` below stays as the styling hook.
            'aria-selected': props.selectable !== 'none' ? selected : undefined,
            // Tree depth/position for screen readers (1-based); the toggle button
            // carries aria-expanded for the control itself.
            'aria-level': treeMeta ? treeMeta.depth + 1 : undefined,
            'aria-setsize': treeMeta ? treeMeta.setSize : undefined,
            'aria-posinset': treeMeta ? treeMeta.posInset : undefined,
            'data-iris-table-row': '',
            'data-iris-row-editing':
              rowMode.value && rowEditing.value?.k === id ? 'true' : undefined,
            'data-state': selected ? 'selected' : undefined,
            onClick: () => emit('rowClick', row, index),
            onDblclick: () => emit('rowDblclick', row, index),
            style: {
              display: 'grid',
              gridTemplateColumns: gridTemplate.value,
              background: selected ? 'var(--iris-surface-hover)' : 'transparent',
              transition: 'background-color 120ms ease',
              cursor: 'default',
              ...style,
            },
          },
          cells,
        )
      }

      // State row style shared by error / loading / empty.
      const stateRowStyle = {
        padding: '32px 12px',
        textAlign: 'center',
        color: 'var(--iris-muted)',
      }

      let bodyNode: VNode
      // Precedence: error → loading → empty → rows.
      if (tableError.value) {
        bodyNode = h('div', { role: 'row', 'data-iris-table-row': 'error', style: stateRowStyle }, [
          h(
            'span',
            { style: { marginInlineEnd: props.onRetry ? 'var(--iris-space-sm, 12px)' : '0px' } },
            slots.error ? slots.error() : t('table.error'),
          ),
          retry.value
            ? h(
                'button',
                {
                  type: 'button',
                  'data-iris-table-retry': '',
                  onClick: retry.value,
                  style: {
                    border: '1px solid var(--iris-border)',
                    background: 'var(--iris-surface)',
                    color: 'var(--iris-foreground)',
                    borderRadius: 'var(--iris-radius-sm, 4px)',
                    padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                    fontSize: 'var(--iris-font-size-sm, 13px)',
                    cursor: 'pointer',
                  },
                },
                t('table.retry'),
              )
            : null,
        ])
      } else if (tableLoading.value) {
        bodyNode = h(
          'div',
          {
            role: 'row',
            'aria-busy': 'true',
            'data-iris-table-row': 'loading',
            style: stateRowStyle,
          },
          slots.loading ? slots.loading() : t('table.loading'),
        )
      } else if (bodyData.value.length === 0) {
        bodyNode = h(
          'div',
          { role: 'row', 'data-iris-table-row': 'empty', style: stateRowStyle },
          slots.empty ? slots.empty() : t('table.empty'),
        )
      } else if (props.virtualScroll && (!treeMode.value || !hasDetail.value)) {
        // Virtualize flat mode, and tree mode too — tree rows are uniform
        // height, so the only thing that bars it is variable-height detail
        // panels, hence the `!hasDetail` guard. `bodyData` is the flattened
        // visible rows (= `sortedRows` in flat mode); `flatTree?.[index]`
        // supplies each row's tree meta (depth + toggle), with `index` the
        // absolute row index from the scroller.
        bodyNode = h(
          IrisVirtualScroll,
          {
            items: bodyData.value,
            itemHeight: props.virtualScroll.itemHeight,
            height: props.virtualScroll.height,
            buffer: props.virtualScroll.buffer,
            'data-iris-table-body': '',
            style: { width: '100%' },
          },
          {
            item: ({ item, index }: { item: Record<string, unknown>; index: number }) =>
              renderRow(item, index, undefined, flatTree.value?.[index]),
          },
        )
      } else {
        const bodyChildren: VNode[] = []
        bodyData.value.forEach((row, i) => {
          bodyChildren.push(renderRow(row, i, undefined, flatTree.value?.[i]))
          // Full-width detail panel beneath an expanded, expandable row (spans
          // all grid tracks). Only in the non-virtualized path.
          if (showDetail && isRowExpandable(row, i)) {
            const id = rowId(row, i)
            if (expandedKeys.value.includes(String(id))) {
              bodyChildren.push(
                h(
                  'div',
                  {
                    key: `${String(id)}::detail`,
                    role: 'row',
                    'data-iris-table-row-detail': String(id),
                    style: {
                      display: 'grid',
                      gridTemplateColumns: gridTemplate.value,
                    },
                  },
                  [
                    h(
                      'div',
                      {
                        role: 'cell',
                        'data-iris-table-detail-cell': '',
                        style: {
                          gridColumn: '1 / -1',
                          padding: '8px 12px',
                          borderBottom: '1px solid var(--iris-border)',
                        },
                      },
                      [props.renderDetail!(row, i)],
                    ),
                  ],
                ),
              )
            }
          }
        })
        bodyNode = h(
          'div',
          {
            role: 'rowgroup',
            'data-iris-table-body': '',
          },
          bodyChildren,
        )
      }

      // -------- Summary / footer row --------
      // Each column with a `summary` op aggregates over the FULL sorted dataset
      // (the same array the body maps), via the core `aggregate` material. The
      // footer appears only when there is data and at least one column opts in.
      let summaryRow: VNode | null = null
      if (
        !tableError.value &&
        !tableLoading.value &&
        bodyData.value.length > 0 &&
        leafColumns.value.some((c) => c.summary)
      ) {
        const summaryCells: VNode[] = leadSummaryCells()
        for (let ci = 0; ci < leafColumns.value.length; ci += 1) {
          const col = leafColumns.value[ci]
          if (visibleColSet.value && !visibleColSet.value.has(ci)) continue
          const align = col.align ?? 'left'
          const op = col.summary
          const value = op ? aggregate(bodyData.value, (r) => getCellValue(r, col), op) : null
          // Columns without a summary op render an empty cell.
          const summaryContent: VNode | VNode[] | string =
            op != null && value != null
              ? col.renderSummary
                ? (col.renderSummary(value, bodyData.value) as VNode | VNode[] | string)
                : String(value)
              : ''
          summaryCells.push(
            h(
              'div',
              {
                key: col.key,
                role: 'cell',
                'data-iris-table-cell': col.key,
                'data-iris-table-summary-cell': op ? '' : undefined,
                'data-iris-table-pinned': col.pinned,
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent:
                    align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
                  padding: 'var(--iris-space-xs, 8px) var(--iris-padding-md)',
                  fontSize: 'var(--iris-font-size-md, 14px)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  ...(visibleColSet.value ? { gridColumnStart: String(colTrack(ci)) } : {}),
                  ...pinnedStyle(col.key),
                },
              },
              summaryContent,
            ),
          )
        }
        summaryRow = h(
          'div',
          {
            role: 'row',
            'data-iris-table-row': 'summary',
            style: {
              display: 'grid',
              gridTemplateColumns: gridTemplate.value,
              fontWeight: '600',
              borderTop: '2px solid var(--iris-border)',
              background: 'var(--iris-surface)',
            },
          },
          summaryCells,
        )
      }

      // Section nodes: form + toolbar render ABOVE the table root, pager BELOW
      // the body. Without any section the table div IS the single root —
      // byte-identical to the pre-batch-X structure.
      const rootNodes = [
        buildFormSection(),
        buildToolbarSection(),
        h(
          'div',
          {
            ...attrs,
            ref: (el: unknown) => {
              rootRef.value = (el ?? null) as HTMLElement | null
            },
            // A keyboard-navigable hierarchical table is a `treegrid`; otherwise the
            // grid/table role as before (treegrid implies managed cell focus).
            role: props.keyboardNavigation ? (treeMode.value ? 'treegrid' : 'grid') : 'table',
            'data-iris-table': '',
            'data-virtual': props.virtualScroll ? '' : undefined,
            'data-column-virtualized': props.columnVirtualization ? 'true' : undefined,
            onKeydown:
              props.keyboardNavigation || props.cellRange
                ? (e: KeyboardEvent) => {
                    if (props.keyboardNavigation) handleGridKey(e)
                    if (props.cellRange) handleCellRangeKey(e)
                  }
                : undefined,
            onScroll: props.columnVirtualization
              ? (e: Event) => {
                  scrollLeft.value = (e.currentTarget as HTMLElement).scrollLeft
                }
              : undefined,
            // Row/column drag-sort (batch Y): container-level pointer handling
            // for both reorders (React parity) — press happens on the row
            // handle / header cell, move/up resolve at the container.
            onPointermove:
              props.rowDrag || props.columnDrag
                ? (e: PointerEvent) => {
                    handleRowDragPointerMove(e)
                    handleColDragPointerMove(e)
                  }
                : undefined,
            onPointerup:
              props.rowDrag || props.columnDrag
                ? () => {
                    handleRowDragPointerUp()
                    handleColDragPointerUp()
                  }
                : undefined,
            onPointerleave: props.rowDrag ? handleRowDragPointerLeave : undefined,
            style: {
              background: 'var(--iris-background)',
              color: 'var(--iris-foreground)',
              fontSize: 'var(--iris-font-size-md, 14px)',
              border: props.bordered ? '1px solid var(--iris-border)' : 'none',
              borderRadius: 'var(--iris-radius-md)',
              // Column virtualization turns the table into a horizontal scroll container.
              overflow: props.columnVirtualization ? 'auto' : 'hidden',
              ...((attrs.style as Record<string, string> | undefined) ?? {}),
            },
          },
          [headerRow, bodyNode, summaryRow, buildPagerSection()],
        ),
        buildContextMenuSection(),
        buildFilterPanelSection(),
      ].filter((n): n is VNode => n !== null)
      return rootNodes.length === 1 ? rootNodes[0] : rootNodes
    }
  },
})

/** Public input/event surface inferred from the runtime Vue component. */
export type IrisTableProps = InstanceType<typeof IrisTable>['$props']
