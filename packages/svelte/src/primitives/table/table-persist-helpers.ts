import type {
  IrisTableColumnWidths,
  IrisTablePersistPiece,
  IrisTablePersistedState,
  IrisTableSortState,
} from './types'

interface CaptureTablePersistSnapshotOptions {
  sort?: IrisTableSortState | null
  filters?: Record<string, string>
  columnWidths?: IrisTableColumnWidths
  pageSize?: number
}

interface RestoreTablePersistPieceOptions {
  applySort?: (sort: IrisTableSortState | null) => void
  applyFilters?: (filters: Record<string, string>) => void
  applyColumnWidths?: (widths: IrisTableColumnWidths) => void
  canRestorePageSize?: (pageSize: number) => boolean
}

function isPersistRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Build the persisted adapter snapshot from the currently eligible channels. */
export function captureTablePersistSnapshot(
  options: CaptureTablePersistSnapshotOptions,
): IrisTablePersistedState {
  const snapshot: IrisTablePersistedState = {}
  if (options.sort !== undefined) snapshot.sort = options.sort
  if (options.filters !== undefined) snapshot.filters = options.filters
  if (options.columnWidths !== undefined) snapshot.columnWidths = options.columnWidths
  if (options.pageSize !== undefined) snapshot.pageSize = options.pageSize
  return snapshot
}

function restoreSort(
  value: unknown,
  applySort: RestoreTablePersistPieceOptions['applySort'],
): boolean {
  if (!applySort) return false
  if (value !== null && !isPersistRecord(value)) return false
  applySort(value as IrisTableSortState | null)
  return true
}

function restoreFilters(
  value: unknown,
  applyFilters: RestoreTablePersistPieceOptions['applyFilters'],
): boolean {
  if (!applyFilters || !isPersistRecord(value)) return false
  applyFilters(value as Record<string, string>)
  return true
}

function restoreColumnWidths(
  value: unknown,
  applyColumnWidths: RestoreTablePersistPieceOptions['applyColumnWidths'],
): boolean {
  if (!applyColumnWidths || !isPersistRecord(value)) return false
  applyColumnWidths(value as IrisTableColumnWidths)
  return true
}

function restorePageSize(
  value: unknown,
  canRestorePageSize: RestoreTablePersistPieceOptions['canRestorePageSize'],
): boolean {
  return typeof value === 'number' && value > 0 && (canRestorePageSize?.(value) ?? false)
}

/** Type-guard and replay one persisted state piece through the live table channels. */
export function restoreTablePersistPiece(
  piece: IrisTablePersistPiece,
  value: unknown,
  options: RestoreTablePersistPieceOptions,
): boolean {
  switch (piece) {
    case 'sort':
      return restoreSort(value, options.applySort)
    case 'filters':
      return restoreFilters(value, options.applyFilters)
    case 'columnVisibility':
      return false
    case 'columnOrder':
      return false
    case 'columnWidths':
      return restoreColumnWidths(value, options.applyColumnWidths)
    case 'pageSize':
      return restorePageSize(value, options.canRestorePageSize)
    default:
      return false
  }
}
