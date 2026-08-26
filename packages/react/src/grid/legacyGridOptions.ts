import type {
  GridExpansionKey,
  GridPaginationChange,
  GridRowKey,
  SelectionKey,
} from '@iris-ui-kit/core/grid'
import type { GridFilterColumn, UseGridFilteringOptions } from './useGridFiltering'
import type { UseGridColumnsOptions } from './useGridColumns'
import type { UseGridExpansionOptions } from './useGridExpansion'
import type { UseGridPaginationOptions } from './useGridPagination'
import type { UseGridRowsOptions } from './useGridRows'
import type { UseGridSelectionOptions } from './useGridSelection'
import type { GridSortColumn, UseGridSortingOptions } from './useGridSorting'

export interface LegacyGridRowsProps<Row extends Record<string, unknown>, Meta = unknown> {
  readonly data?: Row[]
  readonly keepSource?: boolean
  readonly rowKeyField?: string
  readonly getRowKey?: (row: Row, index: number) => GridRowKey | undefined
  readonly getChildren?: UseGridRowsOptions<Row, Meta>['getChildren']
  readonly setChildren?: UseGridRowsOptions<Row, Meta>['setChildren']
  readonly beforeChange?: UseGridRowsOptions<Row, Meta>['onBeforeRowsChange']
  readonly onChange?: UseGridRowsOptions<Row, Meta>['onRowsChange']
}

export interface LegacyGridColumnsProps {
  readonly columnVisibility?: UseGridColumnsOptions['visibility']
  readonly onColumnVisibilityChange?: UseGridColumnsOptions['onVisibilityChange']
  readonly columnOrder?: UseGridColumnsOptions['order']
  readonly onColumnOrderChange?: UseGridColumnsOptions['onOrderChange']
  readonly columnWidths?: UseGridColumnsOptions['widths']
  readonly defaultColumnWidths?: UseGridColumnsOptions['defaultWidths']
  readonly onColumnWidthsChange?: UseGridColumnsOptions['onWidthsChange']
  readonly pinnedColumns?: UseGridColumnsOptions['pinned']
  readonly onColumnPinnedChange?: UseGridColumnsOptions['onPinnedChange']
}

/** Map the four legacy column channels into one feature boundary. */
export function toGridColumnsOptions(props: LegacyGridColumnsProps): UseGridColumnsOptions {
  return {
    visibility: props.columnVisibility,
    visibilityControlled: true,
    onVisibilityChange: props.onColumnVisibilityChange,
    order: props.columnOrder,
    orderControlled: true,
    onOrderChange: props.onColumnOrderChange,
    widths: props.columnWidths,
    defaultWidths: props.defaultColumnWidths,
    onWidthsChange: props.onColumnWidthsChange,
    pinned: props.pinnedColumns,
    onPinnedChange: props.onColumnPinnedChange,
  }
}

export interface LegacyGridRowsOptions<Row extends Record<string, unknown>, Meta = unknown> {
  readonly initialRows: Row[]
  readonly options: UseGridRowsOptions<Row, Meta>
}

/** Map the legacy `data` ownership contract into the rows feature boundary. */
export function toGridRowsOptions<Row extends Record<string, unknown>, Meta = unknown>(
  props: LegacyGridRowsProps<Row, Meta>,
): LegacyGridRowsOptions<Row, Meta> {
  const rows = props.data ?? []
  return {
    initialRows: props.keepSource ? [...rows] : rows,
    options: {
      ...(props.rowKeyField === undefined ? {} : { rowKeyField: props.rowKeyField }),
      ...(props.getRowKey === undefined ? {} : { getRowKey: props.getRowKey }),
      ...(props.getChildren === undefined ? {} : { getChildren: props.getChildren }),
      ...(props.setChildren === undefined ? {} : { setChildren: props.setChildren }),
      onBeforeRowsChange: props.beforeChange,
      onRowsChange: props.onChange,
    },
  }
}

export interface LegacyGridSelectionProps<K extends SelectionKey = string> {
  readonly selectable?: 'none' | 'single' | 'multi'
  readonly selection?: K[]
  readonly defaultSelection?: K[]
  readonly onSelectionChange?: (keys: K[]) => void
}

/** `none` still uses a dormant multiple model, matching the legacy Table. */
export function toGridSelectionOptions<K extends SelectionKey = string>(
  props: LegacyGridSelectionProps<K>,
): UseGridSelectionOptions<K> {
  return {
    mode: props.selectable === 'single' ? 'single' : 'multiple',
    value: props.selection,
    defaultValue: props.defaultSelection,
    onChange: props.onSelectionChange,
  }
}

export interface LegacyGridExpansionProps<K extends GridExpansionKey = string> {
  readonly defaultExpandedRowKeys?: readonly K[]
  readonly onChange?: (keys: string[]) => void
}

export function toGridExpansionOptions<K extends GridExpansionKey = string>(
  props: LegacyGridExpansionProps<K>,
): UseGridExpansionOptions<string> {
  return {
    mode: 'multiple',
    defaultValue: (props.defaultExpandedRowKeys ?? []).map(String),
    onChange: props.onChange,
  }
}

export interface LegacyGridPaginationProxyConfig {
  readonly defaultPage?: number
  readonly pageSize?: number
  readonly onPageChange?: (page: number, pageSize: number) => void
}

export interface LegacyGridPaginationState {
  readonly page: number
  readonly pageSize: number
  readonly total: number
}

export interface LegacyGridPaginationProps {
  readonly proxyConfig?: LegacyGridPaginationProxyConfig
  readonly state?: LegacyGridPaginationState
  readonly request?: (pagination: Pick<LegacyGridPaginationState, 'page' | 'pageSize'>) => void
}

/** Map proxy pagination into a controlled feature; request policy stays outside core. */
export function toGridPaginationOptions(
  props: LegacyGridPaginationProps,
): UseGridPaginationOptions {
  const state = props.state
  const onChange = state
    ? (change: GridPaginationChange) => {
        props.request?.({ page: change.page, pageSize: change.pageSize })
        props.proxyConfig?.onPageChange?.(change.page, change.pageSize)
      }
    : undefined
  return {
    page: state?.page,
    pageSize: state?.pageSize,
    total: state?.total,
    defaultPage: props.proxyConfig?.defaultPage,
    defaultPageSize: props.proxyConfig?.pageSize,
    onChange,
  }
}

export interface LegacyGridSortingProps<Row extends Record<string, unknown>> {
  readonly columns: GridSortColumn<Row>[]
  readonly sort?: UseGridSortingOptions<Row>['sort']
  readonly defaultSort?: UseGridSortingOptions<Row>['defaultSort']
  readonly onSortChange?: UseGridSortingOptions<Row>['onSortChange']
  readonly multiSort?: boolean
  readonly multiSortState?: UseGridSortingOptions<Row>['multiSortState']
  readonly defaultMultiSort?: UseGridSortingOptions<Row>['defaultMultiSort']
  readonly onMultiSortChange?: UseGridSortingOptions<Row>['onMultiSortChange']
  readonly formulaTables?: UseGridSortingOptions<Row>['formulaTables']
}

export function toGridSortingOptions<Row extends Record<string, unknown>>(
  props: LegacyGridSortingProps<Row>,
): UseGridSortingOptions<Row> {
  return {
    leafColumns: props.columns,
    sort: props.sort,
    defaultSort: props.defaultSort,
    onSortChange: props.onSortChange,
    multiSort: props.multiSort,
    multiSortState: props.multiSortState,
    defaultMultiSort: props.defaultMultiSort,
    onMultiSortChange: props.onMultiSortChange,
    formulaTables: props.formulaTables,
  }
}

export interface LegacyGridFilteringProps<
  Row extends Record<string, unknown>,
  Column extends GridFilterColumn<Row>,
> extends Omit<UseGridFilteringOptions<Row, Column>, 'controlled' | 'proxy' | 'remote'> {
  readonly proxy?: unknown
  readonly remoteFilter?: boolean
}

export function toGridFilteringOptions<
  Row extends Record<string, unknown>,
  Column extends GridFilterColumn<Row>,
>(props: LegacyGridFilteringProps<Row, Column>): UseGridFilteringOptions<Row, Column> {
  return {
    columns: props.columns,
    getValue: props.getValue,
    filters: props.filters,
    defaultFilters: props.defaultFilters,
    onFiltersChange: props.onFiltersChange,
    filterValues: props.filterValues,
    defaultFilterValues: props.defaultFilterValues,
    onFilterValuesChange: props.onFilterValuesChange,
    controlled: true,
    formFilters: props.formFilters,
    query: props.query,
    proxy: Boolean(props.proxy),
    remote: props.remoteFilter,
  }
}
