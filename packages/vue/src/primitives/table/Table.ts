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
  watch,
  type VNode,
} from 'vue'
import {
  applyColumnOrder,
  buildFormValues,
  buildHeaderMatrix,
  compareStates,
  applyTableMask,
  createAuditLog,
  createSortable,
  detectColumnType,
  createTreeSelection,
  flattenTreeSelectionNodes,
  flattenLeafColumns,
  flattenTree,
  mergeFormFilters,
  reconcileTreeRows,
  reorderTreeRows,
  seedFormValues,
  tableDisplayText,
  toCsvRows,
  validateEditRulesAsync,
  withSortedChildren,
  type AuditLogType,
  type DetectedColumnType,
  type SortableRect,
  type SortableState,
  type TreeSelectionNode,
  type TreeRow,
} from '@iris-ui-kit/core'
import { useI18n } from '../../i18n'
import { usePrefersReducedMotion } from '../../motion'
import {
  useGridCore,
  useGridClipboard,
  useGridColumns,
  useGridEditing,
  useGridExpansion,
  useGridFiltering,
  useGridRange,
  useGridRows,
  useGridSelection,
  useGridSorting,
} from '../../grid'
import { IrisCheckbox } from '../checkbox/Checkbox'
import { useDrag } from '../drag/useDrag'
import { useDismiss } from '../floating/useDismiss'
import { useFloating } from '../floating/useFloating'
import { IrisVirtualScroll } from '../virtual-scroll/VirtualScroll'
import { tableProps } from './props'
import { buildMultiSortComparator } from './useTableSort'
import { mergeFilterValues, useTableProxy } from './useTableProxy'
import { exportCsv as serializeTableCsv } from './exportCsv'
import { renderFormSection, renderPagerSection, renderToolbarSection } from './table-sections'
import { renderContextMenuSection, renderFilterPanelSection } from './table-overlays'
import { auditDiff, renderAuditPanelSection } from './table-audit'
import { renderImportPreviewSection } from './import-preview'
import { renderTableSummaryRow } from './table-summary-renderer'
import { createTableColumnFade } from './table-column-fade'
import { renderTableStateRow } from './table-state-renderer'
import { createTableKeyboard } from './table-keyboard'
import { computeResponsiveTableColumns } from './table-responsive'
import { ensureTableStyles } from './table-styles'
import { applyDetectedTableTypes } from './table-columns'
import { renderTableFilterTrigger } from './table-filter-trigger'
import { renderTableSortIndicator } from './table-sort-indicator'
import { createTableRowTarget } from './table-row-target'
import { createTablePinnedDrag } from './table-pinned-drag'
import { createCommittedList, createTableUndoController, replaceTableCell } from './table-undo'
import { useTableImport } from './useTableImport'
import {
  renderCellEditContent,
  renderRowSessionContent,
  type TableEditorRenderContext,
  type TableRowEditSession,
} from './table-edit-renderers'
import { renderGroupedHeader } from './table-header-renderers'
import { createTableViewsController } from './table-views'
import {
  DEFAULT_MIN_WIDTH,
  DRAG_COL_WIDTH,
  EXPAND_COL_WIDTH,
  SELECTION_COL_WIDTH,
  SEQ_COL_WIDTH,
  RESIZE_STEP,
  cellId,
  computeVisibleColSet,
  getCellValue as resolveCellValue,
  isEditableColumn,
  resolveInitialWidth,
  resolveSpan,
  withComputedFormulaCells,
} from './table-helpers'
import type {
  IrisTableCellEditEvent,
  IrisTableColumn,
  IrisTableColumnVisibility,
  IrisTableColumnWidths,
  IrisTableContextMenuConfig,
  IrisTableContextMenuParams,
  IrisTableExpose,
  IrisTableSortState,
  IrisTableDensity,
} from './types'

// Batch FS: the table back-to-top control is intentionally local to this
// adapter. It follows the React recipe without adding scroll state to core.
const SCROLL_TOP_VISIBLE_PX = 200
const PIN_LEFT_MENU_KEY = '__iris-pin-left'
const UNPIN_MENU_KEY = '__iris-unpin'
const BACK_TOP_ANCHOR_STYLE: Record<string, string> = {
  position: 'sticky',
  insetBlockEnd: '0px',
  height: '0px',
  pointerEvents: 'none',
  zIndex: '3',
}
const BACK_TOP_BUTTON_STYLE: Record<string, string> = {
  position: 'absolute',
  insetBlockEnd: '24px',
  insetInlineEnd: '24px',
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  border: '1px solid var(--iris-border)',
  background: 'var(--iris-surface, var(--iris-background))',
  color: 'var(--iris-foreground)',
  cursor: 'pointer',
  boxShadow: 'var(--iris-shadow-md)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 'var(--iris-font-size-xl, 18px)',
  pointerEvents: 'auto',
}

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

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Data-driven CSS-grid table with explicit ARIA roles, sorting, selection,
 * column resizing, virtual scrolling, and header/cell slots. */
export const IrisTable = defineComponent({
  name: 'IrisTable',
  inheritAttrs: false,
  props: tableProps,
  emits: {
    'update:selection': (_value: Array<string | number>) => true,
    'update:sort': (_value: IrisTableSortState | null) => true,
    'update:multiSortState': (_value: IrisTableSortState[]) => true,
    multiSortChange: (_value: IrisTableSortState[]) => true,
    'update:columnWidths': (_value: IrisTableColumnWidths) => true,
    /** Controlled columnVisibility channel (parent owns the map). */
    'update:columnVisibility': (_value: IrisTableColumnVisibility) => true,
    /** Controlled top-level column-order proposal channel. */
    'update:columnOrder': (_value: string[] | undefined) => true,
    rowClick: (_row: Record<string, unknown>, _index: number) => true,
    rowDblclick: (_row: Record<string, unknown>, _index: number) => true,
    cellEdit: (_payload: IrisTableCellEditEvent<Record<string, unknown>>) => true,
    expandedRowsChange: (_keys: Array<string | number>) => true,
  },
  setup(props, { slots, attrs, emit, expose }) {
    ensureTableStyles(props.columnFade)
    watch(
      () => props.columnFade,
      (enabled) => {
        if (enabled) ensureTableStyles(true)
      },
    )
    // Keep every adapter-side value consumer on the same formula-aware
    // resolver.  `formulaTables` is intentionally read at call time so a
    // parent can replace the table map without remounting the table.
    const getCellValue = (
      row: Record<string, unknown>,
      column: IrisTableColumn<Record<string, unknown>>,
    ): unknown => resolveCellValue(row, column, props.formulaTables)
    const { t } = useI18n()
    const densityState = ref<IrisTableDensity>('comfortable')
    const effectiveDensity = computed<IrisTableDensity>(() => {
      if (props.densityToggle) return densityState.value
      return props.density === 'compact' || props.density === 'cozy' ? props.density : 'comfortable'
    })
    const cycleDensity = (): void => {
      densityState.value =
        densityState.value === 'comfortable'
          ? 'compact'
          : densityState.value === 'compact'
            ? 'cozy'
            : 'comfortable'
    }
    const importController = useTableImport(
      () => props.importPreview,
      () => props.toolbar?.onImport,
    )
    const gridCore = useGridCore<Record<string, unknown>>()
    const columnsFeature = useGridColumns(gridCore, {
      pinned: props.pinnedColumns,
      onVisibilityChange: (next) => emit('update:columnVisibility', next),
      onOrderChange: (next) => emit('update:columnOrder', next),
      onWidthsChange: (next) => emit('update:columnWidths', next),
      onPinnedChange: (key, side) => props.onColumnPinnedChange?.(key, side),
    })
    // Pin state is controlled only when the prop is present. The resolver is
    // the single read throat: explicit map entries (including null) win over
    // static declarations; otherwise the Core pinned channel contains only
    // explicit uncontrolled overrides and current declarations remain the
    // live fallback, without mutating the caller's columns.
    const pinnedPropControlled = ref(props.pinnedColumns !== undefined)
    const pinOf = (column: IrisTableColumn<Record<string, unknown>>): 'left' | 'right' | null => {
      const pinned = props.pinnedColumns
      if (pinned !== undefined) {
        if (Object.prototype.hasOwnProperty.call(pinned, column.key)) {
          return pinned[column.key] ?? null
        }
        return column.pinned ?? null
      }
      const internal = columnsFeature.state.value.pinned
      if (Object.prototype.hasOwnProperty.call(internal, column.key)) {
        return internal[column.key] ?? null
      }
      return column.pinned ?? null
    }
    watch(
      () => props.pinnedColumns,
      (next) => {
        if (next !== undefined) {
          pinnedPropControlled.value = true
          columnsFeature.model.syncPinned(next)
        } else {
          // Discard controlled proposals when control is removed. Static
          // declarations stay the live fallback for a later columns replace.
          if (pinnedPropControlled.value) columnsFeature.model.syncPinned({})
          pinnedPropControlled.value = false
        }
      },
      { immediate: true, flush: 'sync' },
    )
    // A supplied order is controlled, including an empty array. Keep the
    // model mirrored silently so removing control cannot expose a rejected or
    // previously proposed order through the next render.
    const orderPropControlled = ref(props.columnOrder !== undefined)
    watch(
      () => props.columnOrder,
      (next) => {
        if (next !== undefined) {
          orderPropControlled.value = true
          columnsFeature.model.syncOrder(next)
        } else {
          if (orderPropControlled.value) columnsFeature.model.syncOrder([])
          orderPropControlled.value = false
        }
      },
      { immediate: true, flush: 'sync' },
    )
    const effectiveColumnOrder = computed<string[] | undefined>(() =>
      orderPropControlled.value ? (props.columnOrder ?? []) : columnsFeature.state.value.order,
    )
    const uncontrolledWidths = ref<IrisTableColumnWidths>({})
    const widthPropControlled = ref(props.columnWidths !== undefined)
    watch(
      () => props.columnVisibility,
      (next) => columnsFeature.model.syncVisibility(next ?? {}),
      { immediate: true },
    )
    watch(
      () => props.columnWidths,
      (next) => {
        if (next !== undefined) {
          columnsFeature.model.syncWidths(next)
        } else if (widthPropControlled.value) {
          // Preserve the pre-existing uncontrolled snapshot when a controlled
          // width map is removed; the old local owner had this behavior.
          columnsFeature.model.syncWidths(uncontrolledWidths.value)
        }
        widthPropControlled.value = next !== undefined
      },
      { immediate: true },
    )
    const responsiveWidth = ref(0)
    const effectiveWidths = computed<IrisTableColumnWidths>(() =>
      props.columnWidths !== undefined ? props.columnWidths : columnsFeature.state.value.widths,
    )
    const effectiveVisibility = computed<IrisTableColumnVisibility>(
      () => columnsFeature.state.value.visibility,
    )
    const columnFadeEnabled = computed(() => props.columnFade)
    const reducedMotion = usePrefersReducedMotion(columnFadeEnabled)
    const columnFade = createTableColumnFade({
      visibility: () => effectiveVisibility.value,
      enabled: () => columnFadeEnabled.value,
      reducedMotion,
      columns: computed(() => props.columns),
    })
    const {
      displayColumns: sourceDisplayColumns,
      columnFadeAttr,
      columnFadeStyle,
      columnFadeAttrs,
      columnFadeActive,
      fadeByLeaf,
      isCollapsed: isColumnFadeCollapsed,
    } = columnFade
    const detectedTypes = ref<Record<string, DetectedColumnType>>({})
    const detectTypesDone = ref(false)
    const detectedDisplayColumns = computed<IrisTableColumn<Record<string, unknown>>[]>(() => {
      if (!props.autoDetectTypes || Object.keys(detectedTypes.value).length === 0) {
        return sourceDisplayColumns.value
      }
      return applyDetectedTableTypes(sourceDisplayColumns.value, detectedTypes.value)
    })
    const responsiveLeadingWidth = computed(
      () =>
        (props.rowDrag ? DRAG_COL_WIDTH : 0) +
        (props.seq ? SEQ_COL_WIDTH : 0) +
        (props.renderDetail !== undefined ? EXPAND_COL_WIDTH : 0) +
        (props.selectable !== 'none' ? SELECTION_COL_WIDTH : 0),
    )
    const responsiveWidthOf = (column: IrisTableColumn<Record<string, unknown>>): number => {
      const width = effectiveWidths.value[column.key] ?? resolveInitialWidth(column)
      return Number.isFinite(width) && width >= 0 ? width : resolveInitialWidth(column)
    }
    const orderedDisplayColumns = computed<IrisTableColumn<Record<string, unknown>>[]>(() =>
      applyColumnOrder(detectedDisplayColumns.value, effectiveColumnOrder.value),
    )
    const responsiveResult = computed(() =>
      props.responsive
        ? computeResponsiveTableColumns(
            orderedDisplayColumns.value,
            responsiveWidth.value,
            responsiveLeadingWidth.value,
            responsiveWidthOf,
            pinOf,
          )
        : { columns: orderedDisplayColumns.value, overflow: false },
    )
    const responsiveDisplayColumns = computed<IrisTableColumn<Record<string, unknown>>[]>(
      () => responsiveResult.value.columns,
    )
    const responsiveOverflow = computed(() => responsiveResult.value.overflow)
    const displayColumns = computed<IrisTableColumn<Record<string, unknown>>[]>(
      () => responsiveDisplayColumns.value,
    )
    const grouped = computed(() =>
      displayColumns.value.some((c) => c.children && c.children.length > 0),
    )
    const leafColumns = computed(() =>
      grouped.value ? flattenLeafColumns(displayColumns.value) : displayColumns.value,
    )
    const headerMatrix = computed(() =>
      grouped.value ? buildHeaderMatrix(displayColumns.value) : null,
    )
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
      filters: () => props.filters,
      filterValues: () => props.filterValues,
    })
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
    // Synchronous mirror for multiple commits in one event (row-mode edit
    // sessions: Vue batches computed updates until the next flush).
    const committedList = createCommittedList(() => tableData.value)
    watch(
      [() => props.autoDetectTypes, tableData, () => props.columns],
      () => {
        if (!props.autoDetectTypes || detectTypesDone.value || tableData.value.length === 0) return
        detectTypesDone.value = true
        const next: Record<string, DetectedColumnType> = {}
        for (const column of flattenLeafColumns(props.columns)) {
          if (column.formula) continue
          next[column.key] = detectColumnType(
            tableData.value.map((row) => getCellValue(row, column)),
          )
        }
        detectedTypes.value = next
      },
      { immediate: true },
    )

    // Grid Rows is the single transaction throat for edits, paste, drag and
    // imperative row operations. The undo bridge is created below (after the
    // selection/root/editing refs exist), so this callback is assigned lazily.
    let recordUndoRows: ((rows: Array<Record<string, unknown>>) => void) | null = null
    let suppressUndoRecord = false

    // Static and lazy tree children share the Core rows source. Lazy rows use
    // the conventional `children` slot after their first load; static tables
    // continue to resolve children through the caller's `getSubRows` accessor.
    const readRowChildren = (
      row: Record<string, unknown>,
    ): readonly Record<string, unknown>[] | undefined => {
      if (props.lazyLoad !== undefined) {
        const children = row.children
        if (Array.isArray(children)) return children as Record<string, unknown>[]
      }
      return props.getSubRows?.(row)
    }
    const writeLazyChildren =
      props.lazyLoad === undefined
        ? undefined
        : (row: Record<string, unknown>, children: Record<string, unknown>[]) => ({
            ...row,
            children,
          })

    const sorting = useGridSorting<Record<string, unknown>>(gridCore, {
      mode: props.multiSort ? 'multiple' : 'single',
      defaultSort: props.defaultSort,
      defaultMultiSort: props.defaultMultiSort,
      onSortChange: (next) => {
        emit('update:sort', next)
        // remoteSort parity: sort changes re-query the server (page resets
        // to 1 in the core controller, vxe behavior).
        if (remoteSort.value) proxyCtrl.setParams({ sort: next })
      },
      onMultiSortChange: (next) => {
        emit('update:multiSortState', next)
        emit('multiSortChange', next)
        // remoteSort parity (multi mode): the FULL sort list re-queries the
        // server; the single `sort` param stays the single-column channel.
        if (remoteSort.value) proxyCtrl.setParams({ sorts: next })
      },
    })

    watch(
      () => props.sort,
      (next) => next !== undefined && sorting.model.syncSort(next ?? null),
      { immediate: true },
    )
    watch(
      () => props.multiSortState,
      (next) => next !== undefined && sorting.model.syncMultiSort(next ?? []),
      { immediate: true },
    )

    const internalSort = computed<IrisTableSortState | null>(() =>
      props.sort !== undefined ? (props.sort ?? null) : sorting.sort.value,
    )
    const multiSortState = computed<IrisTableSortState[]>(() =>
      props.multiSortState !== undefined ? props.multiSortState : sorting.multiSort.value,
    )
    const setSort = (next: IrisTableSortState | null): void => sorting.model.setSort(next)
    const cycleSort = (column: IrisTableColumn): void => {
      if (column.sortable) sorting.model.cycleSort(column.key)
    }
    const cycleMultiSort = (column: IrisTableColumn): void => {
      if (column.sortable) sorting.model.cycleMultiSort(column.key)
    }
    const sortComparator = computed<
      ((a: Record<string, unknown>, b: Record<string, unknown>) => number) | null
    >(() =>
      buildMultiSortComparator(
        leafColumns.value,
        internalSort.value ? [internalSort.value] : [],
        props.formulaTables,
      ),
    )
    const multiSortComparator = computed<
      ((a: Record<string, unknown>, b: Record<string, unknown>) => number) | null
    >(() => buildMultiSortComparator(leafColumns.value, multiSortState.value, props.formulaTables))
    const sortedRows = computed(() => {
      if (remoteSort.value) return tableData.value
      const compare = props.multiSort ? multiSortComparator.value : sortComparator.value
      return compare ? [...tableData.value].sort(compare) : tableData.value
    })

    const tableViews = createTableViewsController({
      config: () => props.views,
      sort: internalSort,
      setSort,
      onActiveViewChange: (key) => props.onActiveViewChange?.(key),
    })
    // remoteSort parity: the server owns the ordering — never re-sort locally.
    const sortedData = computed(() => (remoteSort.value ? tableData.value : sortedRows.value))

    // Filtering state is feature-owned; formApplied remains adapter-owned
    // because form keystrokes are draft-only until submit/reset.
    const filtering = useGridFiltering<Record<string, unknown>>(gridCore, {
      defaultFilters: props.filters,
      defaultFilterValues: props.filterValues,
      onFilterValuesChange: (next) => props.onFilterValuesChange?.(next),
    })
    watch(
      () => props.filters,
      (next) => next !== undefined && filtering.model.syncFilters(next),
      { immediate: true },
    )
    watch(
      () => props.filterValues,
      (next) => next !== undefined && filtering.model.syncFilterValues(next),
      { immediate: true },
    )
    const effectiveFilters = computed<Record<string, string>>(() =>
      props.filters !== undefined ? props.filters : filtering.filters.value,
    )
    const effectiveFilterValues = computed(() =>
      props.filterValues !== undefined ? props.filterValues : filtering.filterValues.value,
    )
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
      mergeFilterValues(mergeFormFilters(effectiveFilters.value, form), effectiveFilterValues.value)
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
      [formApplied, effectiveFilters, effectiveFilterValues],
      () => {
        if (proxyCtrl.proxy.value && remoteFilter.value) {
          proxyCtrl.setParams({
            filters: mergedProxyFilters(formApplied.value),
          })
        }
      },
      { immediate: true },
    )

    // -------- Selection (single-sourced via the shared Grid Core feature) --------
    // The model owns the selected-key set plus the toggle / dedup / select-all
    // logic; the table keeps only its controlled-or-uncontrolled value shape
    // (`Array<string | number>`) and the row-id mapping. It runs in the default
    // `multiple` mode so `selectable` stays runtime-reactive — single-select is a
    // replace (`set`) and multi-select a `toggle`, matching the previous behavior.
    const gridRows = useGridRows(gridCore, tableData.value, {
      getRowKey: (row, index) => rowId(row, index),
      getChildren:
        props.getSubRows !== undefined || props.lazyLoad !== undefined
          ? readRowChildren
          : undefined,
      setChildren: writeLazyChildren,
      onRowsChange: (transaction) => {
        const next = [...transaction.rows]
        committedList.sync(next)
        if (proxyCtrl.proxy.value) proxyCtrl.liveData.value = next
        else localRowsOverride.value = next
        if (!suppressUndoRecord) recordUndoRows?.(next)
      },
    })
    watch(tableData, (rows) => {
      committedList.sync(rows)
      gridRows.model.sync(rows)
    })
    const selControlled = computed(() => props.selection !== undefined)
    const { model: selectionModel, selection: selectedKeys } = useGridSelection<
      Record<string, unknown>,
      string | number
    >(gridCore, {
      mode: 'multiple',
      value: props.selection,
      defaultValue: props.defaultSelection,
      onChange: (keys) => emit('update:selection', keys),
    })
    // The bridge is installed once in setup; keep its feature-owned model in
    // sync with later prop changes too. This preserves the latest controlled
    // value when a table switches back to uncontrolled mode.
    watch(
      () => props.selection,
      (selection) => {
        if (selection === undefined) return
        const current = selectionModel.get()
        if (
          current.length !== selection.length ||
          current.some((key, index) => !Object.is(key, selection[index]))
        ) {
          selectionModel.sync(selection)
        }
      },
      { immediate: true },
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

    // -------- Expandable detail rows (single-sourced via the shared Grid Core) --------
    // A leading toggle column + a full-width detail panel beneath an expanded
    // row, driven by the framework-agnostic expansion model (multiple-open). The
    // keys are the row keys as strings (matching React). Mirrors the selection
    // pattern: shallowRef + subscribe so toggling re-renders.
    const hasDetail = computed(() => props.renderDetail !== undefined)
    const { model: expansion, expandedKeys } = useGridExpansion(gridCore, {
      mode: 'multiple',
      defaultValue: (props.defaultExpandedRowKeys ?? []).map(String),
      onChange: (keys) => emit('expandedRowsChange', keys),
    })
    const isRowExpandable = (row: Record<string, unknown>, idx: number): boolean =>
      hasDetail.value && (props.rowExpandable ? props.rowExpandable(row, idx) : true)

    const rowId = (row: Record<string, unknown>, index: number): string | number => {
      const v = row[props.rowKey]
      if (typeof v === 'string' || typeof v === 'number') return v
      return index
    }

    // -------- Built-in audit log (iris 独有, batch EN — mirror react batch
    // AT) --------
    // A core createAuditLog keeps a bounded (200) ring of ONE entry per
    // mutation commit. Three funnels record in the Vue adapter (insert/paste/
    // fill/undo have no Vue entry points yet): writeCellValue (inline + row-
    // mode cell commits) records DIRECTLY at the commit point (type 'edit' +
    // rowKey + column + old→new — a single-cell entry byte-identical to
    // React's diff for the same edit) instead of a list diff, because
    // non-proxy edits never write the row table (props.data is immutable) —
    // a stale-base diff would invert the second of two consecutive commits
    // (batch-EN F1). removeRows diffs the pre/post lists (type 'remove');
    // loadData diffs too (type 'edit' — react commitRowList default parity).
    // The controller is created once and stays inert unless the `auditLog`
    // prop is on (real-time gate — off = zero push).
    const audit = createAuditLog()
    // Previous row list for the light diff; kept in sync by EVERY row-list
    // funnel (recordAudit assigns eagerly) AND by the tableData watch below
    // (external re-feeds — parent `data` / proxy refetch / rowDrag reorder —
    // re-baseline so the next commit diff doesn't read stale rows; those
    // moves never record, react effect parity).
    const auditRowsRef = ref<Array<Record<string, unknown>>>(tableData.value)
    watch(tableData, (next) => {
      auditRowsRef.value = next
    })
    const recordAudit = (next: Array<Record<string, unknown>>, type: AuditLogType): void => {
      if (!props.auditLog) return
      const entry = auditDiff(auditRowsRef.value, next, (r, i) => rowId(r, i))
      if (entry) audit.push({ type, ...entry })
      // Eager ref sync: a following commit in the SAME flush must diff against
      // the true intermediate list (Vue defers the computed recompute).
      auditRowsRef.value = next
    }

    // -------- Tree rows (opt-in via getSubRows / lazyLoad) --------
    // Flatten the nested data into the visible rows honoring the (shared)
    // expansion model. `bodyData` is the row list the body, select-all, and
    // summary all operate on — identical to `sortedRows` in flat mode, so
    // non-tree behavior is byte-identical. Tree mode is mutually exclusive with
    // detail rows and is gated off the virtual-scroll path.
    const treeMode = computed(() => props.getSubRows !== undefined || props.lazyLoad !== undefined)
    // Lazy tree (vxe lazyLoad parity, batch Z): children are fetched on first
    // expand. Loaded children are written to the Core rows source; only the
    // loading SET remains adapter-owned because it drives the spinner.
    const lazyLoading = ref<Set<string>>(new Set())
    // Bumped whenever the data source reference changes (loading set cleared).
    // A lazy-load callback captures the epoch at call time and drops its result
    // if a refresh happened while the fetch was in flight (React M2 parity).
    let lazyEpoch = 0
    watch(
      () => (proxyCtrl.proxy.value ? proxyCtrl.state.value.data : props.data),
      () => {
        lazyLoading.value = new Set()
        lazyEpoch += 1
      },
    )
    const lazyChildrenOf = readRowChildren
    const hasLazyChildren = (row: Record<string, unknown>): boolean =>
      props.lazyLoad !== undefined && Array.isArray(row.children)
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
        ? effectiveFilters.value
        : mergeFormFilters(effectiveFilters.value, formApplied.value)
      const active = Object.entries(merged).filter(([, v]) => v != null && v !== '')
      // Batch Z: per-column checked sets OR-match the raw String(value); a set
      // applies only when non-empty. AND-ed with the text channel below.
      const checkedEntries = Object.entries(effectiveFilterValues.value).filter(
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

    /** Map clipboard's effective-row projection back to the Core row source. */
    const reconcileClipboardRows = (
      sourceRows: readonly Record<string, unknown>[],
      previousRows: readonly Record<string, unknown>[],
      rows: readonly Record<string, unknown>[],
    ): Record<string, unknown>[] => {
      const visibleKeys = new Map<Record<string, unknown>, string | number>()
      bodyData.value.forEach((row, index) => {
        visibleKeys.set(row, rowId(row, index))
      })
      const keyOf = (
        row: Record<string, unknown>,
        index: number,
        source?: readonly Record<string, unknown>[],
      ): string | number => {
        const visibleKey = visibleKeys.get(row)
        if (visibleKey !== undefined) return visibleKey
        const sourceIndex = source?.indexOf(row) ?? -1
        return rowId(row, sourceIndex >= 0 ? sourceIndex : index)
      }
      const patches = new Map<string | number, Record<string, unknown>>()
      rows.forEach((row, index) => {
        if (Object.is(row, previousRows[index])) return
        const previous = previousRows[index]
        if (!previous) return
        const sourceIndex = sourceRows.indexOf(previous)
        patches.set(keyOf(previous, sourceIndex >= 0 ? sourceIndex : index, sourceRows), row)
      })
      if (props.getSubRows !== undefined || props.lazyLoad !== undefined) {
        return reconcileTreeRows(sourceRows, patches, {
          getRowKey: (row, index) => keyOf(row, index),
          getChildren: readRowChildren,
          setChildren: writeLazyChildren,
        })
      }
      return sourceRows.map((row, index) => patches.get(keyOf(row, index, sourceRows)) ?? row)
    }

    const cascadingTreeSelection = computed(
      () => props.treeSelectionCascade && props.selectable === 'multi' && treeMode.value,
    )
    const treeSelectionNodes = computed<TreeSelectionNode<string | number>[]>(() => {
      const getChildren =
        props.getSubRows !== undefined || props.lazyLoad !== undefined ? readRowChildren : undefined
      if (!cascadingTreeSelection.value || !getChildren) return []
      let rowIndex = 0
      return flattenTreeSelectionNodes(sortedData.value, {
        // Keep the legacy fallback key's global pre-order ordinal. The core
        // helper owns recursion and duplicate/cycle protection; this closure
        // only supplies the table's existing row-id policy.
        getKey: (row) => rowId(row, rowIndex++),
        getChildren,
      })
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

    // -------- Inline editing (cell mode is Grid Core-owned) --------
    const editorInputRef = ref<HTMLInputElement | null>(null)
    const recordCellCommit = (
      row: Record<string, unknown>,
      column: IrisTableColumn,
      rowIndex: number,
      oldValue: unknown,
      newValue: unknown,
    ): void => {
      if (newValue === oldValue) return
      // Batch EN (iris 独有): record ONE audit entry per inline/row edit
      // commit AT the commit point — no list diff, because non-proxy edits
      // never write the row table and a stale-base diff would invert the
      // second of two consecutive commits (F1). The single-cell entry shape
      // (type 'edit' + rowKey + column + old→new) is byte-identical to
      // React's diff for the same edit.
      if (props.auditLog) {
        audit.push({
          type: 'edit',
          rowKey: rowId(row, rowIndex),
          column: (column.dataIndex ?? column.key) as string,
          oldValue,
          newValue,
        })
      }
      emit('cellEdit', { row, column, oldValue, newValue, rowIndex })
    }

    const cellEditing = useGridEditing<Record<string, unknown>>(gridCore, {
      getRowKey: (row, index) => rowId(row, index),
      getRowIndex: (rowKey) => {
        const index = bodyData.value.findIndex((row, rowIndex) =>
          Object.is(rowId(row, rowIndex), rowKey),
        )
        return index >= 0 ? index : undefined
      },
      getRules: (columnKey) =>
        leafColumns.value.find((column) => column.key === columnKey)?.editRules,
      getValue: (row, columnKey) => {
        const column = leafColumns.value.find((candidate) => candidate.key === columnKey)
        return column ? getCellValue(row, column) : row[columnKey]
      },
      setValue: (row, columnKey, value) => {
        const column = leafColumns.value.find((candidate) => candidate.key === columnKey)
        const key = (column?.dataIndex ?? column?.key ?? columnKey) as string
        return { ...row, [key]: value }
      },
      coerce: (draft, row, columnKey) => {
        const column = leafColumns.value.find((candidate) => candidate.key === columnKey)
        if (column?.editor !== 'number') return draft
        const text = String(draft ?? '')
        if (text === '' || Number.isNaN(Number(text))) {
          return column ? getCellValue(row, column) : draft
        }
        return Number(text)
      },
      validate: (value, row, columnKey) => {
        const column = leafColumns.value.find((candidate) => candidate.key === columnKey)
        return column?.validate?.(value, row) ?? null
      },
      isEditable: (_row, columnKey) => {
        const column = leafColumns.value.find((candidate) => candidate.key === columnKey)
        return Boolean(column && isEditableColumn(column))
      },
      onCommit: (commit) => {
        const column = leafColumns.value.find((candidate) => candidate.key === commit.columnKey)
        if (column)
          recordCellCommit(commit.row, column, commit.rowIndex, commit.oldValue, commit.value)
      },
    })
    const editingState = cellEditing.state
    const editingCellId = computed(() => {
      const target = editingState.value.editing
      return target ? cellId(target.rowKey, target.columnKey) : null
    })
    const editingColumnKey = computed(() => editingState.value.editing?.columnKey ?? null)
    const editingDraft = computed(() => String(editingState.value.draft ?? ''))
    const editError = computed(() => editingState.value.error)
    const setEditingDraft = (draft: string): void => cellEditing.setCellDraft(draft)

    const beginEdit = (
      row: Record<string, unknown>,
      column: IrisTableColumn,
      rowIdent: string | number,
    ): void => {
      // Batch EK: a formula column is display-only — never enters cell mode.
      if (!isEditableColumn(column)) return
      const current = getCellValue(row, column)
      if (cellEditing.startCellEdit(rowIdent, column.key, current == null ? '' : String(current))) {
        void nextTick(() => editorInputRef.value?.focus())
      }
    }

    const commitEdit = (
      _row: Record<string, unknown>,
      _column: IrisTableColumn,
      _rowIndex: number,
    ): void => {
      cellEditing.commitCellEdit()
    }
    const cancelEdit = (): void => cellEditing.cancelCellEdit()

    /** Shared write-back for a committed value (row mode, batch Z): emits
     * `cellEdit` and patches the proxy live copy. Cell mode commits update
     * the same source through the Grid Core rows feature. */
    const writeCellValue = (
      row: Record<string, unknown>,
      column: IrisTableColumn,
      rowIndex: number,
      oldValue: unknown,
      newValue: unknown,
    ) => {
      if (newValue === oldValue) return
      recordCellCommit(row, column, rowIndex, oldValue, newValue)
      // Row-mode sessions bypass the cell-editing engine, so write their
      // immutable row replacement through the same list mirror used by the
      // undo bridge. This also keeps consecutive column commits in one event
      // based on the freshest row list in local (non-proxy) mode.
      const current = committedList.list()
      const key = (column.dataIndex ?? column.key) as string
      const next = replaceTableCell(current, rowId(row, rowIndex), key, newValue, rowId)
      if (next !== current) {
        undoController.record(next)
        setTableRows(next)
      }
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
    const rowSessions = ref<Map<string, TableRowEditSession>>(new Map())
    const rowEditing = ref<{ k: string | number; idx: number } | null>(null)
    // Per-column editor inputs (focus targets for beginRowEdit / reopen).
    const rowEditorRefs = new Map<string, HTMLInputElement | null>()

    /** Resolve the CURRENT row object by key (a committed column's write-back
     * replaces the proxy live row, so later commits must see the fresh object). */
    const currentRowFor = (k: string | number): Record<string, unknown> | undefined =>
      // Static tree children are indexed by the shared Core rows model. Keep
      // the visible-body fallback for proxy/lazy rows owned by this adapter.
      committedList.list().find((r, i) => rowId(r, i) === k) ??
      gridRows.model.find(k) ??
      bodyData.value.find((r, i) => rowId(r, i) === k)

    const beginRowEdit = (
      row: Record<string, unknown>,
      rowIndex: number,
      focusColKey?: string,
    ): void => {
      const k = rowId(row, rowIndex)
      // Batch EK: formula columns are display-only — row mode skips them.
      const editableCols = leafColumns.value.filter(isEditableColumn)
      if (editableCols.length === 0) return
      const sessions = new Map<string, TableRowEditSession>()
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
        const context = { rows: tableData.value, columnKey: column.key }
        validateEditRulesAsync(column.editRules, draft, row, false, context).then((r) => {
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
        if (isEditableColumn(col) && !rowSessions.value.has(id)) {
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

    const editorRenderContext: TableEditorRenderContext = {
      rowEditorRefs,
      editorInputRef,
      editingDraft,
      setEditingDraft,
      editError,
      commitEdit,
      cancelEdit,
      commitRowSession,
      cancelRowEdit,
      editPreview: props.editPreview,
      previewValue: (row, col, draft) => {
        const raw =
          col.editor === 'number'
            ? draft === '' || Number.isNaN(Number(draft))
              ? getCellValue(row, col)
              : Number(draft)
            : draft
        return col.formatter?.(applyTableMask(raw, col), row) ?? ''
      },
    }
    const buildRowSessionContent = (
      row: Record<string, unknown>,
      col: IrisTableColumn,
      index: number,
      k: string | number,
      editCellId: string,
      session: TableRowEditSession,
    ): VNode | VNode[] =>
      renderRowSessionContent(editorRenderContext, row, col, index, k, editCellId, session)

    /** Cell-mode editor content (singleton refs, byte-identical to the
     * pre-batch-Z path). */
    const buildCellEditContent = (
      row: Record<string, unknown>,
      col: IrisTableColumn,
      index: number,
      editCellId: string,
    ): VNode | VNode[] => renderCellEditContent(editorRenderContext, row, col, index, editCellId)

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
        treeMeta.hasChildren || (props.lazyLoad !== undefined && !hasLazyChildren(row))
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
                        const rawKey = row[props.rowKey]
                        const lazyKey =
                          typeof rawKey === 'string' || typeof rawKey === 'number'
                            ? rawKey
                            : rowId(row, Math.max(0, treeMeta.posInset - 1))
                        suppressUndoRecord = true
                        let committed = false
                        try {
                          committed = gridRows.model.setChildren(lazyKey, children, {
                            reason: 'lazy-load',
                          })
                        } finally {
                          suppressUndoRecord = false
                        }
                        if (committed && children && children.length > 0) {
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
    // Seed the model and the compatibility snapshot from LEAF columns (a
    // header group column carries no body width; only its leaves do).
    watch(
      () => leafColumns.value,
      (cols) => {
        const seeded = { ...uncontrolledWidths.value }
        let snapshotChanged = false
        for (const col of cols) {
          if (seeded[col.key] === undefined) {
            seeded[col.key] = resolveInitialWidth(col)
            snapshotChanged = true
          }
        }
        if (snapshotChanged) uncontrolledWidths.value = seeded

        const modelWidths = { ...columnsFeature.state.value.widths }
        let modelChanged = false
        for (const col of cols) {
          if (modelWidths[col.key] === undefined) {
            modelWidths[col.key] = resolveInitialWidth(col)
            modelChanged = true
          }
        }
        if (modelChanged) columnsFeature.model.syncWidths(modelWidths)
      },
      { immediate: true, deep: false },
    )
    const setColumnWidths = (next: IrisTableColumnWidths) => {
      if (props.columnWidths === undefined) uncontrolledWidths.value = next
      columnsFeature.setWidths(next)
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

    const sortIndicator = (col: IrisTableColumn): VNode | null =>
      renderTableSortIndicator(col, {
        multiSort: props.multiSort,
        multiSortState: multiSortState.value,
        sort: internalSort.value,
      })

    const renderFilterTrigger = (col: IrisTableColumn, leaf: boolean): VNode | null =>
      renderTableFilterTrigger({
        column: col,
        leaf,
        active: (effectiveFilterValues.value[col.key]?.length ?? 0) > 0,
        open: filterPanelState.value?.open === true && filterPanelState.value.colKey === col.key,
        label: t('table.filter'),
        onOpen: openFilterPanel,
      })

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
        if (isColumnFadeCollapsed(col.key)) {
          parts.push('0px')
          continue
        }
        parts.push(`${effectiveWidths.value[col.key] ?? resolveInitialWidth(col)}px`)
      }
      return parts.join(' ')
    })

    // -------- Cell-range selection (opt-in via `cellRange`) --------
    // Range state shares the per-table Grid Core; Vue retains only the
    // reactive snapshot plus pointer/keyboard/render wiring.
    const { model: cellRangeCtrl, state: cellRangeState } = useGridRange(gridCore)
    const { serialize: serializeGridRange, paste: pasteGridRange } = useGridClipboard<
      Record<string, unknown>
    >(gridCore, {
      getRows: () => bodyData.value,
      getColumns: () => leafColumns.value,
      rowKeyField: props.rowKey,
      resolveValue: (row, column) =>
        getCellValue(row, column as IrisTableColumn<Record<string, unknown>>),
      setValue: (row, column, value) => ({
        ...row,
        [(column.dataIndex ?? column.key) as string]: value,
      }),
      isCellEditable: (_row, column) =>
        !(column as IrisTableColumn<Record<string, unknown>>).formula,
      reconcileRows: reconcileClipboardRows,
      onPaste: (change) => {
        const rows = [...change.rows]
        recordAudit(rows, 'paste')
        props.onDataChange?.(rows)
      },
    })
    const rootRef = ref<HTMLElement | null>(null)
    let tableDisposed = false
    onScopeDispose(() => {
      tableDisposed = true
    })

    // Built-in row-list undo/redo (iris parity with React). The stack stores
    // post-change snapshots; all writes still go through the Grid Rows model,
    // while the transaction callback above records ordinary user mutations.
    // Explicit replay/imperative commits use this guarded funnel so a replay
    // never records itself as a fresh undo step.
    const setTableRows = (rows: Array<Record<string, unknown>>): void => {
      committedList.sync(rows)
      suppressUndoRecord = true
      try {
        gridRows.model.commit(rows)
      } finally {
        suppressUndoRecord = false
      }
    }
    const undoController = createTableUndoController(
      () => props.undo,
      () => props.data ?? [],
      () => (proxyCtrl.proxy.value ? proxyCtrl.state.value.data : (props.data ?? [])),
      setTableRows,
      recordAudit,
      (rows) => props.onDataChange?.(rows),
      () => rootRef.value,
      () => editingCellId.value !== null || rowEditing.value !== null,
      {
        current: () => displaySelection.value,
        enabled: () => props.selectable !== 'none',
        keyOf: rowId,
        rebase: rebaseToProp,
        set: (keys) => selectionModel.set(keys),
      },
    )
    recordUndoRows = undoController.record

    // -------- Back-to-top (batch FS, iris 独有) --------
    // Keep the feature inert by default: no DOM query or native listener is
    // installed until the opt-in prop is on. Scroll events do not bubble, so
    // both possible scrollers are wired; the handler resolves the effective
    // virtual viewport at event time and therefore never strands a stale root
    // probe during an async empty → data transition.
    const scrollTopShown = ref(false)
    let scrollTopListeners: HTMLElement[] = []
    const clearScrollTopListeners = (): void => {
      for (const el of scrollTopListeners) el.removeEventListener('scroll', onScrollTop)
      scrollTopListeners = []
    }
    const onScrollTop = (): void => {
      const root = rootRef.value
      if (!root) return
      const viewport = root.querySelector<HTMLElement>('[data-iris-virtual-scroll]')
      const scroller = viewport ?? root
      scrollTopShown.value = scroller.scrollTop >= SCROLL_TOP_VISIBLE_PX
    }
    const armScrollTop = (): void => {
      clearScrollTopListeners()
      scrollTopShown.value = false
      if (!props.scrollToTop || !rootRef.value) return
      const root = rootRef.value
      const viewport = root.querySelector<HTMLElement>('[data-iris-virtual-scroll]')
      root.addEventListener('scroll', onScrollTop)
      scrollTopListeners.push(root)
      if (viewport) {
        viewport.addEventListener('scroll', onScrollTop)
        scrollTopListeners.push(viewport)
      }
      onScrollTop()
    }
    onMounted(armScrollTop)
    // The data-presence/state and virtual-mode flips are the DOM transitions
    // that can mount or replace the effective viewport. Post-flush ensures the
    // query sees the newly rendered node before attaching its listener.
    watch(
      [
        () => props.scrollToTop,
        () => Boolean(props.virtualScroll),
        bodyData,
        tableLoading,
        tableError,
      ],
      armScrollTop,
      { flush: 'post' },
    )
    onBeforeUnmount(clearScrollTopListeners)

    const scrollToTopOfTable = (): void => {
      const root = rootRef.value
      if (!root) return
      const viewport = root.querySelector<HTMLElement>('[data-iris-virtual-scroll]')
      const scroller = viewport ?? root
      const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth'
      if (typeof scroller.scrollTo === 'function') {
        try {
          scroller.scrollTo({ top: 0, behavior })
          return
        } catch {
          // Fall through for browsers/DOM shims with a throwing scrollTo.
        }
      }
      scroller.scrollTop = 0
    }
    const buildBackTopSection = (): VNode | null => {
      if (!props.scrollToTop || !scrollTopShown.value || props.printable) return null
      return h('div', { 'data-iris-back-top-anchor': '', style: BACK_TOP_ANCHOR_STYLE }, [
        h(
          'button',
          {
            type: 'button',
            'data-iris-back-top-table': '',
            'aria-label': t('backTop.label'),
            title: t('backTop.label'),
            onClick: scrollToTopOfTable,
            style: BACK_TOP_BUTTON_STYLE,
          },
          '↑',
        ),
      ])
    }

    let responsiveObserver: ResizeObserver | null = null
    const measureResponsiveWidth = (): void => {
      responsiveWidth.value = props.responsive && rootRef.value ? rootRef.value.clientWidth : 0
    }
    const updateResponsiveObserver = (): void => {
      responsiveObserver?.disconnect()
      responsiveObserver = null
      responsiveWidth.value = 0
      if (!props.responsive || !rootRef.value || typeof ResizeObserver === 'undefined') return
      measureResponsiveWidth()
      responsiveObserver = new ResizeObserver(measureResponsiveWidth)
      responsiveObserver.observe(rootRef.value)
    }
    onMounted(updateResponsiveObserver)
    watch(() => props.responsive, updateResponsiveObserver)
    onBeforeUnmount(() => {
      responsiveObserver?.disconnect()
      responsiveObserver = null
    })
    const rowTarget = createTableRowTarget(() => rootRef.value)
    const { scrollTo: scrollToRow, goTo: goToRow } = rowTarget
    onBeforeUnmount(rowTarget.dispose)
    const focusedCell = ref<{ row: number; col: number } | null>(null)
    const keyboard = createTableKeyboard({
      keyboardNavigation: () => props.keyboardNavigation,
      cellRange: () => props.cellRange,
      clipConfig: () => props.clipConfig,
      rows: () => bodyData.value,
      columns: () => leafColumns.value,
      root: () => rootRef.value,
      focused: focusedCell,
      range: cellRangeCtrl,
      rangeState: cellRangeState,
      serializeRange: serializeGridRange,
      pasteRange: (range) => {
        // Clipboard reads are asynchronous. Re-check the live feature config
        // and lifecycle after the promise resolves so a disabled or unmounted
        // table cannot commit a stale paste (the browser read may outlive it).
        const clipAtStart = props.clipConfig
        if (!clipAtStart || clipAtStart.paste === false) return
        void readClipboardText().then((text) => {
          const clip = props.clipConfig
          if (text === null || tableDisposed || !clip || clip.paste === false) return
          pasteGridRange(text, range)
        })
      },
    })
    const { handleRootKeyDown, isInRange, activeCellRange, copyActiveRange } = keyboard

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
      const visible = computeVisibleColSet(
        props.columnVirtualization,
        leafColumns.value,
        scrollLeft.value,
        viewportWidth.value,
        effectiveWidths.value,
        pinOf,
      )
      if (!visible) return null
      // A fading column must remain mounted even when it sits outside the
      // current horizontal window; its stable leaf index still controls its
      // gridColumnStart.
      const next = new Set(visible)
      leafColumns.value.forEach((column, index) => {
        if (fadeByLeaf.value[column.key]) next.add(index)
      })
      return next
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
        if (pinOf(col) === 'left') {
          map[col.key] = { side: 'left', offset: left }
          left += widthOf(col)
        }
      }
      let right = 0
      for (let i = leafColumns.value.length - 1; i >= 0; i -= 1) {
        const col = leafColumns.value[i]
        if (col && pinOf(col) === 'right') {
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

    // One write throat for every pin gesture. Controlled proposals are first
    // rebased from the parent's map so a rejected proposal never becomes the
    // basis for the next callback; Core still owns the callback and channel
    // write, while pinOf keeps controlled rendering non-optimistic.
    const setColumnPinned = (key: string, side: 'left' | 'right' | null): void => {
      if (props.pinnedColumns !== undefined) {
        columnsFeature.model.syncPinned(props.pinnedColumns)
      }
      columnsFeature.setPinned(key, side)
    }

    const pinnedDragHandle = createTablePinnedDrag({
      enabled: () => props.pinnedDrag === true,
      columns: () => leafColumns.value,
      widthOf: (column) => effectiveWidths.value[column.key] ?? resolveInitialWidth(column),
      pinOf,
      setPinned: (key, side) => {
        if (pinnedPropControlled.value) {
          columnsFeature.model.syncPinned(props.pinnedColumns ?? {})
          columnsFeature.setPinned(key, side)
        } else props.onColumnPinnedChange?.(key, side)
      },
      onPinnedCountChange: (count) => props.onPinnedCountChange?.(count),
    })

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
        const visibleRows = bodyData.value
        const fromVisible = visibleRows.findIndex(
          (row, index) => String(rowId(row, index)) === activeId,
        )
        const toVisible = visibleRows.findIndex(
          (row, index) => String(rowId(row, index)) === overId,
        )
        const fromRow = fromVisible >= 0 ? visibleRows[fromVisible] : undefined
        const toRow = toVisible >= 0 ? visibleRows[toVisible] : undefined
        const fromKey = fromRow === undefined ? undefined : rowId(fromRow, fromVisible)
        const toKey = toRow === undefined ? undefined : rowId(toRow, toVisible)
        // Prefer the rows model when the visible rows resolve to the same
        // source objects. This keeps row-drag in the canonical transaction
        // throat while preserving the adapter projection fallback for
        // index-keyed/sorted views whose visible index is not a source key.
        const modelFrom = fromKey === undefined ? undefined : gridRows.model.find(fromKey)
        const modelTo = toKey === undefined ? undefined : gridRows.model.find(toKey)
        const useRowsModel =
          fromKey !== undefined && toKey !== undefined && modelFrom === fromRow && modelTo === toRow
        if (useRowsModel) {
          const position = fromVisible < toVisible ? 'after' : 'before'
          if (gridRows.model.reorder(fromKey, toKey, { reason: 'row-drag', position })) {
            const rows = gridRows.model.get()
            props.onDataChange?.(rows)
            props.rowDrag.onReorder(rows)
            rowRectsRef.value = []
            return
          }
        }
        // A tree must be reordered in the source tree. The visible flattened
        // list is only a drag projection and must never be committed as roots.
        if (props.getSubRows !== undefined || props.lazyLoad !== undefined) {
          const visibleKeys = new Map(
            visibleRows.map((row, index) => [row, String(rowId(row, index))]),
          )
          if (fromVisible >= 0 && toVisible >= 0) {
            const result = reorderTreeRows(
              gridRows.model.get(),
              activeId,
              overId,
              {
                // Every drop target is visible; leave hidden descendants keyless
                // so a synthetic sibling index cannot mask a visible target.
                getRowKey: (row) => visibleKeys.get(row),
                getChildren: readRowChildren,
                setChildren: writeLazyChildren,
              },
              fromVisible < toVisible ? 'after' : 'before',
            )
            if (result.changed) {
              const rows = result.rows
              // Adapter-owned gesture; Grid Core owns the row-list transaction.
              gridRows.model.commit(rows, { reason: 'row-drag' })
              props.onDataChange?.(rows)
              props.rowDrag.onReorder(rows)
            }
          }
        } else {
          const rows = [...bodyData.value] as Array<Record<string, unknown>>
          const from = rows.findIndex((r, i) => String(rowId(r, i)) === activeId)
          const to = rows.findIndex((r, i) => String(rowId(r, i)) === overId)
          if (from >= 0 && to >= 0 && from !== to) {
            const [moved] = rows.splice(from, 1)
            rows.splice(to, 0, moved)
            // Adapter-owned gesture; Grid Core owns the row-list transaction.
            gridRows.model.commit(rows, { reason: 'row-drag' })
            props.onDataChange?.(rows)
            props.rowDrag.onReorder(rows)
          }
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
          // The columnDrag callback owns ordinary parent-fed column arrays. Only
          // an explicit columnOrder owner opts into the separate order channel;
          // otherwise a no-op callback must not mutate Core or emit an event.
          if (!grouped.value && orderPropControlled.value) {
            columnsFeature.setOrder(next.map((column) => column.key))
          }
        }
      }
      colRectsRef.value = []
    }

    const spanOccupy = new Set<string>()

    const tableExpose: IrisTableExpose<Record<string, unknown>> = {
      loadData: (rows) => {
        // Batch EN: loadData replaces the live row list through a commit-like
        // funnel — record the light diff (type 'edit', react commitRowList
        // default parity) before the write flips the reactive source.
        recordAudit(rows, 'edit')
        gridRows.model.loadData(rows)
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
      removeRows: (keys) => {
        const removedKeys = gridRows.model.removeMany(keys)
        if (removedKeys.length === 0) return
        const rows = gridRows.model.get()
        // Batch EN: record ONE 'remove' entry from the light diff (the first
        // removed row key carries the structural context) after the core
        // transaction has produced its immutable next snapshot.
        recordAudit(rows, 'remove')
        const selected = displaySelection.value
        const removed = new Set(removedKeys)
        const nextSelection = selected.filter((key) => !removed.has(key))
        if (nextSelection.length !== selected.length) {
          rebaseToProp()
          selectionModel.set(nextSelection)
        }
        props.onDataChange?.(rows)
      },
      getFilteredData: () => [...bodyData.value],
      exportCurrentViewCsv: () =>
        serializeTableCsv(
          withComputedFormulaCells(bodyData.value, leafColumns.value, props.formulaTables),
          leafColumns.value,
        ),
      exportMultiCsv: () => {
        const current = serializeTableCsv(
          withComputedFormulaCells(bodyData.value, leafColumns.value, props.formulaTables),
          leafColumns.value,
        )
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
      // Batch EN (iris 独有): audit trail programmatic access — a snapshot
      // (newest-first entries) and a wipe, both against the ref-once
      // controller; the seq counter never resets on clear (audit integrity).
      getAuditLog: () => audit.list(),
      clearAuditLog: () => {
        audit.clear()
      },
    }
    expose(tableExpose)

    // -------- Section builders (vxe-grid formConfig / toolbarConfig / pager
    // parity, batch X) --------
    // Render-only chrome lives in table-sections.ts; setup keeps the reactive
    // state and callbacks while the helper owns the VNode shape.
    const buildFormSection = (): VNode | null =>
      renderFormSection({
        formConfig: props.formConfig,
        t,
        formDraft,
        setFormValue,
        handleFormSubmit,
        handleFormReset,
      })

    // -------- Audit log panel (iris 独有, batch EN — mirror react batch
    // AT) --------
    // Floating panel opened from the toolbar trigger and positioned below it
    // (useFloating bottom-end, flip off / shift on — react parity). Dismissal:
    // Escape + outside pointer-down (useDismiss — the trigger is EXCLUDED so
    // a press on it toggles instead of close-then-reopen) and any scroll
    // (capture-phase document listener, context-menu precedent). The entry
    // list refreshes IN PLACE via the panel component's own subscription —
    // the table never re-renders from its own audit traffic (react
    // useSyncExternalStore parity).
    const auditOpen = ref(false)
    const auditAnchorRef = ref<HTMLButtonElement | null>(null)
    const auditPanelRef = ref<HTMLElement | null>(null)
    const toggleAuditPanel = (): void => {
      auditOpen.value = !auditOpen.value
    }
    const closeAuditPanel = (): void => {
      auditOpen.value = false
    }
    const clearAudit = (): void => {
      audit.clear()
    }
    const { floatingStyles: auditPanelStyles } = useFloating({
      anchor: auditAnchorRef,
      floating: auditPanelRef,
      open: auditOpen,
      placement: 'bottom-end',
      flip: false,
      shift: true,
    })
    useDismiss({
      enabled: auditOpen,
      exclude: [auditPanelRef, auditAnchorRef],
      onDismiss: closeAuditPanel,
    })
    // Scroll anywhere closes the panel. Capture phase so scrolling inside any
    // nested scroll container (or the table itself) also counts.
    watch(auditOpen, (open) => {
      if (typeof document === 'undefined') return
      if (open) document.addEventListener('scroll', closeAuditPanel, true)
      else document.removeEventListener('scroll', closeAuditPanel, true)
    })
    onScopeDispose(() => {
      if (typeof document === 'undefined') return
      document.removeEventListener('scroll', closeAuditPanel, true)
    })
    const buildAuditPanelSection = (): VNode | null =>
      renderAuditPanelSection({
        open: auditOpen,
        audit,
        styles: auditPanelStyles,
        panelRef: auditPanelRef,
        onClear: clearAudit,
        t,
      })
    const buildToolbarSection = (): VNode | null =>
      renderToolbarSection({
        toolbar: props.toolbar,
        selectable: props.selectable,
        displaySelection,
        proxyCtrl,
        t,
        importFileInput: importController.importFileInput,
        onImportFile: importController.handleImportFile,
        densityToggle: props.densityToggle,
        effectiveDensity: effectiveDensity.value,
        onDensityToggle: cycleDensity,
        undo: { enabled: props.undo, controller: undoController, t },
        // Batch EN: the built-in audit trigger rides the toolbar (react
        // parity — the toolbar gate admits auditLog on its own).
        auditLog: props.auditLog,
        auditOpen,
        auditAnchorRef,
        onAuditToggle: toggleAuditPanel,
      })
    const buildPagerSection = (): VNode | null =>
      renderPagerSection({ proxyCtrl, proxyConfig: props.proxyConfig })

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
    const virtualCursorAnchor = (event: MouseEvent): HTMLElement =>
      ({
        getBoundingClientRect: () => ({
          left: event.clientX,
          top: event.clientY,
          right: event.clientX,
          bottom: event.clientY,
          width: 0,
          height: 0,
          x: event.clientX,
          y: event.clientY,
          toJSON() {},
        }),
      }) as unknown as HTMLElement

    // Header pin menu state is separate from the body context-menu state, but
    // deliberately uses the same overlay renderer and floating-menu plumbing.
    // Keeping the state as a normal context-menu snapshot means the menu has
    // the same role, disabled-button behavior, dismissal and Teleport contract.
    const pinMenuState = ref<{
      open: boolean
      items: Array<{ key: string; label: string; disabled?: boolean }>
      params: IrisTableContextMenuParams<Record<string, unknown>>
    } | null>(null)
    const pinMenuAnchorRef = ref<HTMLElement | null>(null)
    const pinMenuRef = ref<HTMLElement | null>(null)
    const closePinMenu = (): void => {
      if (pinMenuState.value) pinMenuState.value.open = false
    }
    watch(
      () => props.columnPinMenu,
      (enabled) => {
        if (!enabled) closePinMenu()
      },
      { flush: 'sync' },
    )
    const pinMenuItemsFor = (column: IrisTableColumn): Array<{ key: string; label: string }> =>
      pinOf(column) === null
        ? [{ key: PIN_LEFT_MENU_KEY, label: t('table.pinLeft') }]
        : [{ key: UNPIN_MENU_KEY, label: t('table.unpin') }]
    const handleHeaderContextMenu = (event: MouseEvent, column: IrisTableColumn): void => {
      if (!props.columnPinMenu) return
      // A header context gesture must never sort or reach the browser menu.
      event.preventDefault()
      event.stopPropagation()
      // Swap menus: a header gesture closes an already-open body menu.
      closeContextMenu()
      pinMenuAnchorRef.value = virtualCursorAnchor(event)
      const params: IrisTableContextMenuParams<Record<string, unknown>> = {
        row: undefined as unknown as Record<string, unknown>,
        column,
        rowIndex: -1,
        columnIndex: leafColumns.value.findIndex((candidate) => candidate.key === column.key),
      }
      pinMenuState.value = { open: true, items: pinMenuItemsFor(column), params }
    }
    const pinMenuConfig: IrisTableContextMenuConfig<Record<string, unknown>> = {
      // The renderer receives the snapshot items above. This required config
      // member is intentionally empty: the pin menu has no caller items.
      items: () => [],
      onSelect: (key, params) => {
        const current = pinOf(params.column)
        if (key === PIN_LEFT_MENU_KEY && current === null) {
          setColumnPinned(params.column.key, 'left')
        } else if (key === UNPIN_MENU_KEY && current !== null) {
          setColumnPinned(params.column.key, null)
        }
      },
    }
    // Keep an open menu's single item aligned with a parent-controlled update
    // or an internal Core pin write that happens before the item is clicked.
    watch(
      () => {
        const state = pinMenuState.value
        if (!state?.open) return null
        const side = pinOf(state.params.column)
        const label = t(side === null ? 'table.pinLeft' : 'table.unpin')
        return `${side ?? 'none'}\u0000${label}`
      },
      () => {
        const state = pinMenuState.value
        if (state?.open) state.items = pinMenuItemsFor(state.params.column)
      },
      { flush: 'sync' },
    )

    const handleContextMenu = (
      e: MouseEvent,
      row: Record<string, unknown>,
      col: IrisTableColumn,
      idx: number,
      ci: number,
    ): void => {
      if (!props.contextMenu) return
      e.preventDefault()
      // Swap menus: a body gesture closes an already-open header pin menu.
      closePinMenu()
      contextAnchorRef.value = virtualCursorAnchor(e)
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

    const buildContextMenuSection = (): VNode | null =>
      renderContextMenuSection({
        state: contextMenuState,
        styles: contextMenuStyles,
        menuRef: contextMenuRef,
        close: closeContextMenu,
        contextMenu: props.contextMenu,
      })

    const pinMenuOpen = computed(() => props.columnPinMenu && pinMenuState.value?.open === true)
    const { floatingStyles: pinMenuStyles } = useFloating({
      anchor: pinMenuAnchorRef,
      floating: pinMenuRef,
      open: pinMenuOpen,
      placement: 'bottom-start',
      // The zero-size virtual anchor must remain at the cursor; clamping it
      // would move the context menu away from the requested coordinates.
      flip: false,
      shift: false,
    })
    useDismiss({
      enabled: pinMenuOpen,
      exclude: [pinMenuRef],
      onDismiss: closePinMenu,
    })
    watch(pinMenuOpen, (open) => {
      if (typeof document === 'undefined') return
      if (open) document.addEventListener('scroll', closePinMenu, true)
      else document.removeEventListener('scroll', closePinMenu, true)
    })
    onScopeDispose(() => {
      if (typeof document === 'undefined') return
      document.removeEventListener('scroll', closePinMenu, true)
    })

    const buildPinMenuSection = (): VNode | null => {
      if (!props.columnPinMenu) return null
      return renderContextMenuSection({
        state: pinMenuState,
        styles: pinMenuStyles,
        menuRef: pinMenuRef,
        close: closePinMenu,
        contextMenu: pinMenuConfig,
      })
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
      filterDraft.value = [...(effectiveFilterValues.value[colKey] ?? [])]
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
      filtering.model.setFilterValues({ ...effectiveFilterValues.value, [colKey]: values })
    }
    const clearFilterValues = (colKey: string): void => {
      filtering.model.clearColumnFilterValues(colKey)
    }
    const toggleFilterDraft = (value: string): void => {
      filterDraft.value = filterDraft.value.includes(value)
        ? filterDraft.value.filter((v) => v !== value)
        : [...filterDraft.value, value]
    }

    const buildFilterPanelSection = (): VNode | null =>
      renderFilterPanelSection({
        state: filterPanelState,
        styles: filterPanelStyles,
        panelRef: filterPanelRef,
        filterDraft,
        columns: displayColumns.value,
        filterValues: effectiveFilterValues.value,
        t,
        close: closeFilterPanel,
        toggle: toggleFilterDraft,
        apply: applyFilterValues,
        clear: clearFilterValues,
      })

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
        if (showDetail) {
          cells.push(
            h('div', {
              key: '__expand',
              role: 'cell',
              'data-iris-table-cell': '__expand',
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
      // Grouped header rendering is kept in a small pure VNode helper; the
      // setup closure supplies the live selection/sort/slot callbacks.
      const buildGroupedHeader = (matrix: NonNullable<typeof headerMatrix.value>): VNode =>
        renderGroupedHeader(
          {
            showDrag,
            showSeq,
            showDetail,
            showSelection,
            selectable: props.selectable,
            selection: props.selection,
            allSelected,
            someSelected,
            toggleAll,
            t,
            slots,
            onHeaderClick,
            ariaSortFor,
            sortIndicator,
            multiSortSeq,
            renderFilterTrigger,
            pinnedDragHandle,
            pinOf,
            pinnedColumnsControlled: props.pinnedColumns !== undefined,
            columnPinMenu: props.columnPinMenu,
            pinnedStyle,
            onHeaderContextMenu: props.columnPinMenu ? handleHeaderContextMenu : undefined,
            columnFadeAttr,
            columnFadeStyle,
            gridTemplate,
          },
          matrix,
        )

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
        const pinnedHandle = pinnedDragHandle(col)
        const handle =
          props.resizableColumns && !pinnedHandle
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
              'data-iris-table-pinned': pinOf(col),
              ...columnFadeAttrs(col),
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
              ...(props.columnPinMenu
                ? { onContextmenu: (event: MouseEvent) => handleHeaderContextMenu(event, col) }
                : {}),
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
                ...(columnFadeStyle(col) ?? {}),
                ...(visibleColSet.value ? { gridColumnStart: String(colTrack(ci)) } : {}),
                ...(pinOf(col) !== null
                  ? { ...pinnedStyle(col.key), background: 'var(--iris-surface)' }
                  : {}),
              },
              'aria-sort': ariaSortFor(col),
            },
            [
              title,
              sortIndicator(col),
              multiSortSeq(col),
              renderFilterTrigger(col, true),
              pinnedHandle,
              handle,
            ],
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
          const patternHint =
            (props.pattern || props.patternFill) &&
            !rowMode.value &&
            editingColumnKey.value === col.key &&
            !isEditing &&
            editingDraft.value !== '' &&
            String(getCellValue(row, col) ?? '') === editingDraft.value

          let content: unknown
          if (isEditing) {
            const editCellId = cellId(id, col.key)
            content = isRowEditing
              ? buildRowSessionContent(
                  row,
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
              tableDisplayText(row, col, getCellValue)
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
                'data-iris-table-pinned': pinOf(col),
                ...columnFadeAttrs(col),
                'data-editable': isEditableColumn(col) ? '' : undefined,
                'data-editing': isEditing ? '' : undefined,
                'data-iris-input-hint': patternHint ? 'true' : undefined,
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
                  : isEditableColumn(col)
                    ? () => beginEdit(row, col, id)
                    : undefined,
                onClick: rowMode.value
                  ? () => handleRowModeCellClick(row, col, index, id)
                  : props.cellRange
                    ? (e: MouseEvent) => {
                        if (e.shiftKey) cellRangeCtrl.extendRange(index, ci)
                        else cellRangeCtrl.startRange(index, ci)
                      }
                    : isEditableColumn(col) && props.editConfig?.trigger === 'click'
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
                  ...(isEditing ? { flexWrap: 'wrap' } : {}),
                  borderBottom: '1px solid var(--iris-border)',
                  fontSize: 'var(--iris-font-size-md, 14px)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  cursor: isEditableColumn(col) ? 'cell' : 'default',
                  ...(props.cellRange && isInRange(index, ci)
                    ? { background: 'var(--iris-surface-selected, rgba(99,102,241,0.12))' }
                    : {}),
                  ...(visibleColSet.value ? { gridColumnStart: String(colTrack(ci)) } : {}),
                  ...(colspan > 1 ? { gridColumnEnd: `span ${colspan}` } : {}),
                  ...(rowspan > 1 ? { gridRowEnd: `span ${rowspan}` } : {}),
                  ...(patternHint
                    ? {
                        backgroundImage:
                          'linear-gradient(var(--iris-input-hint, rgba(251, 191, 36, 0.16)), var(--iris-input-hint, rgba(251, 191, 36, 0.16)))',
                      }
                    : {}),
                  ...pinnedStyle(col.key),
                  ...(columnFadeStyle(col) ?? {}),
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
            'data-iris-table-row-key': String(id),
            'data-iris-row-editing':
              rowMode.value && rowEditing.value?.k === id ? 'true' : undefined,
            'data-state': selected ? 'selected' : undefined,
            onClick: () => emit('rowClick', row, index),
            onDblclick: () => emit('rowDblclick', row, index),
            style: {
              display: 'grid',
              gridTemplateColumns: gridTemplate.value,
              background: selected ? 'var(--iris-surface-hover)' : 'transparent',
              transition: columnFadeActive.value
                ? 'background-color 120ms ease, grid-template-columns var(--iris-duration-md, 200ms) ease'
                : 'background-color 120ms ease',
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

      const stateNode = renderTableStateRow({
        error: tableError.value,
        loading: tableLoading.value,
        rowCount: bodyData.value.length,
        stateRowStyle,
        errorContent: slots.error ? slots.error() : t('table.error'),
        loadingContent: slots.loading ? slots.loading() : t('table.loading'),
        emptyContent: slots.empty ? slots.empty() : t('table.empty'),
        retry: retry.value,
        onRetry: props.onRetry,
        retryLabel: t('table.retry'),
      })
      let bodyNode: VNode
      // Precedence: error → loading → empty → rows.
      if (stateNode) {
        bodyNode = stateNode
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
      // (the same array the body maps). The render-only material lives in its
      // own helper so this adapter stays focused on state and event wiring.
      const summaryRow =
        !tableError.value && !tableLoading.value
          ? renderTableSummaryRow({
              bodyData: bodyData.value,
              leafColumns: leafColumns.value,
              visibleColSet: visibleColSet.value,
              gridTemplate: gridTemplate.value,
              leadingCells: leadSummaryCells(),
              columnFadeAttr,
              columnFadeStyle,
              colTrack,
              getCellValue,
              pinOf,
              pinnedStyle,
            })
          : null

      // Section nodes: form + toolbar render ABOVE the table root, pager BELOW
      // the body. Without any section the table div IS the single root —
      // byte-identical to the pre-batch-X structure.
      const rootNodes = [
        tableViews.renderTabs(props.tableTabs),
        tableViews.renderViews(),
        buildFormSection(),
        buildToolbarSection(),
        props.clipConfig && props.clipConfig.copy !== false && activeCellRange()
          ? h(
              'button',
              { type: 'button', 'data-iris-table-range-copy': '', onClick: copyActiveRange },
              t('table.range.copy'),
            )
          : null,
        renderImportPreviewSection({
          rows: importController.importPreviewRows.value,
          t,
          onConfirm: importController.confirmImportPreview,
          onCancel: importController.cancelImportPreview,
        }),
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
            'data-iris-column-fade-active': columnFadeActive.value ? 'true' : undefined,
            'data-density': effectiveDensity.value,
            'data-printable': props.printable ? 'true' : undefined,
            'data-virtual': props.virtualScroll ? '' : undefined,
            'data-column-virtualized': props.columnVirtualization ? 'true' : undefined,
            onKeydown:
              props.keyboardNavigation || props.cellRange || props.clipConfig
                ? (e: KeyboardEvent) => handleRootKeyDown(e)
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
              // Column virtualization and responsive overflow turn the table
              // into a horizontal scroll container.
              overflow: props.columnVirtualization || responsiveOverflow.value ? 'auto' : 'hidden',
              ...(responsiveOverflow.value ? { overflowX: 'auto' } : {}),
              ...((attrs.style as Record<string, string> | undefined) ?? {}),
            },
          },
          [headerRow, bodyNode, summaryRow, buildPagerSection(), buildBackTopSection()],
        ),
        props.responsive && responsiveOverflow.value && !props.printable
          ? h(
              'div',
              {
                'data-iris-scroll-hint': '',
                role: 'status',
                'aria-live': 'polite',
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--iris-space-xxs, 4px)',
                  padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
                  color: 'var(--iris-muted)',
                  background: 'var(--iris-surface)',
                  borderInline: '1px solid var(--iris-border)',
                  borderBottom: '1px solid var(--iris-border)',
                  fontSize: 'var(--iris-font-size-sm, 13px)',
                },
              },
              [h('span', { 'aria-hidden': 'true' }, '⇆'), h('span', t('table.scrollHint'))],
            )
          : null,
        buildContextMenuSection(),
        buildPinMenuSection(),
        buildFilterPanelSection(),
        buildAuditPanelSection(),
      ].filter((n): n is VNode => n !== null)
      return rootNodes.length === 1 ? rootNodes[0] : rootNodes
    }
  },
})

/** Public input/event surface inferred from the runtime Vue component. */
export type IrisTableProps = InstanceType<typeof IrisTable>['$props']
