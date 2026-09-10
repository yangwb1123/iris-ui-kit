import type {
  IrisTableColumnWidths,
  IrisTableFilterValues,
  IrisTableSortState,
  IrisTableViewSnapshot,
} from './types'

interface CaptureTableViewSnapshotOptions {
  multiSort: boolean
  multiSortState: IrisTableSortState[]
  filters?: Record<string, string>
  filterValues?: IrisTableFilterValues
  columnWidths?: IrisTableColumnWidths
  expandedRowKeys?: string[]
  pageSize?: number
}

interface ApplyTableViewSnapshotOptions {
  multiSort: boolean
  setMultiSort: (sorts: IrisTableSortState[]) => void
  setFilters?: (filters: Record<string, string>) => void
  setFilterValues?: (values: IrisTableFilterValues) => void
  setColumnWidths?: (widths: IrisTableColumnWidths) => void
  setExpandedRowKeys?: (keys: string[]) => void
  requestPageSize?: (pageSize: number) => void
}

function isViewRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Capture the additional view-owned channels that IrisTable can replay. */
export function captureTableViewSnapshot(
  options: CaptureTableViewSnapshotOptions,
): Omit<Partial<IrisTableViewSnapshot>, 'sort'> {
  const snapshot: Omit<Partial<IrisTableViewSnapshot>, 'sort'> = {}
  if (options.multiSort) snapshot.multiSort = options.multiSortState.map((sort) => ({ ...sort }))
  if (options.filters) snapshot.filters = { ...options.filters }
  if (options.filterValues) snapshot.filterValues = { ...options.filterValues }
  if (options.columnWidths) snapshot.columnWidths = { ...options.columnWidths }
  if (options.expandedRowKeys) snapshot.expandedRowKeys = [...options.expandedRowKeys]
  if (typeof options.pageSize === 'number' && options.pageSize > 0)
    snapshot.pageSize = options.pageSize
  return snapshot
}

/** Replay a named view snapshot through the table's existing adapter channels. */
export function applyTableViewSnapshot(
  snapshot: IrisTableViewSnapshot,
  options: ApplyTableViewSnapshotOptions,
): void {
  if (
    options.multiSort &&
    Array.isArray(snapshot.multiSort) &&
    snapshot.multiSort.every(
      (sort) =>
        sort !== null &&
        typeof sort.key === 'string' &&
        (sort.direction === 'asc' || sort.direction === 'desc'),
    )
  ) {
    options.setMultiSort(snapshot.multiSort.map((sort) => ({ ...sort })))
  }
  if (options.setFilters && isViewRecord(snapshot.filters)) {
    options.setFilters(snapshot.filters as Record<string, string>)
  }
  if (options.setFilterValues && isViewRecord(snapshot.filterValues)) {
    options.setFilterValues(snapshot.filterValues as IrisTableFilterValues)
  }
  if (options.setColumnWidths && isViewRecord(snapshot.columnWidths)) {
    options.setColumnWidths(snapshot.columnWidths as IrisTableColumnWidths)
  }
  if (options.setExpandedRowKeys && Array.isArray(snapshot.expandedRowKeys)) {
    options.setExpandedRowKeys(snapshot.expandedRowKeys.map(String))
  }
  if (options.requestPageSize && typeof snapshot.pageSize === 'number' && snapshot.pageSize > 0) {
    options.requestPageSize(snapshot.pageSize)
  }
}
