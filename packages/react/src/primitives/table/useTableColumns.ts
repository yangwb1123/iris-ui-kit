import * as React from 'react'
import {
  applyColumnOrder,
  applyColumnPreset,
  applyDetectedColumnDefaults,
  applyColumnVisibility,
  buildHeaderMatrix,
  computeResponsiveColumnLayout,
  flattenLeafColumns,
  resolveColumnWidth,
  type DetectedColumnType,
  type HeaderCell,
} from '@iris-ui-kit/core'
import type { IrisTableColumn, IrisTableColumnWidths } from './types'
import { EXPAND_COL_WIDTH, SELECTION_COL_WIDTH } from './styles'

const SEQ_COL_WIDTH = 60
const DRAG_COL_WIDTH = 40

export interface UseTableColumnsOptions<Row extends Record<string, unknown>> {
  columns?: IrisTableColumn<Row>[]
  renderDetail?: unknown
  responsive: boolean
  responsiveWidth: number
  rowDrag?: unknown
  showRowNumbers: boolean
  selectable: 'none' | 'single' | 'multi'
  autoDetectTypes?: boolean
  columnOrder?: string[]
  columnVisibility?: Record<string, boolean>
  columnWidths: IrisTableColumnWidths
  setColumnWidth: (key: string, width: number) => void
  resetColumnWidths: () => void
  pinnedColumns: Record<string, 'left' | 'right' | null>
  setColumnPinned: (key: string, side: 'left' | 'right' | null) => void
}

export interface UseTableColumnsResult<Row extends Record<string, unknown>> {
  hasDetail: boolean
  safeColumns: IrisTableColumn<Row>[]
  presetColumns: IrisTableColumn<Row>[]
  detectedColumns: IrisTableColumn<Row>[]
  detectedTypes: Record<string, DetectedColumnType>
  setDetectedTypes: React.Dispatch<React.SetStateAction<Record<string, DetectedColumnType>>>
  detectTypesRef: React.MutableRefObject<boolean>
  orderedColumns: IrisTableColumn<Row>[]
  displayColumns: IrisTableColumn<Row>[]
  columnWidths: IrisTableColumnWidths
  setColumnWidth: (key: string, width: number) => void
  resetColumnWidths: () => void
  pinOf: (col: IrisTableColumn<Row>) => 'left' | 'right' | null
  setColumnPinned: (key: string, side: 'left' | 'right' | null) => void
  responsiveLeadingWidth: number
  responsiveDisplayColumns: IrisTableColumn<Row>[]
  responsiveOverflow: boolean
  grouped: boolean
  leafColumns: IrisTableColumn<Row>[]
  viewColumnsRef: React.MutableRefObject<IrisTableColumn<Row>[]>
  headerMatrix: HeaderCell<IrisTableColumn<Row>>[][] | null
}

/** Derives column declarations and responsive layout from Grid-owned state. */
export function useTableColumns<Row extends Record<string, unknown>>(
  options: UseTableColumnsOptions<Row>,
): UseTableColumnsResult<Row> {
  const hasDetail = options.renderDetail !== undefined
  const safeColumns = React.useMemo(() => options.columns ?? [], [options.columns])

  const columnWidths = options.columnWidths
  const setColumnWidth = options.setColumnWidth
  const resetColumnWidths = options.resetColumnWidths
  const pinOf = React.useCallback(
    (col: IrisTableColumn<Row>): 'left' | 'right' | null => {
      if (Object.prototype.hasOwnProperty.call(options.pinnedColumns, col.key)) {
        return options.pinnedColumns[col.key] ?? null
      }
      return col.pinned ?? null
    },
    [options.pinnedColumns],
  )
  const setColumnPinned = options.setColumnPinned

  const presetColumns = React.useMemo(() => {
    const hasPreset = (cols: readonly IrisTableColumn<Row>[]): boolean =>
      cols.some(
        (col) => col.preset !== undefined || (col.children ? hasPreset(col.children) : false),
      )
    const applyPreset = (col: IrisTableColumn<Row>): IrisTableColumn<Row> => {
      const resolved = col.preset ? applyColumnPreset(col, col.preset) : col
      return resolved.children && resolved.children.length > 0
        ? { ...resolved, children: resolved.children.map(applyPreset) }
        : resolved
    }
    return hasPreset(safeColumns) ? safeColumns.map(applyPreset) : safeColumns
  }, [safeColumns])

  const [detectedTypes, setDetectedTypes] = React.useState<Record<string, DetectedColumnType>>({})
  const detectTypesRef = React.useRef(false)
  const detectedColumns = React.useMemo(() => {
    if (!options.autoDetectTypes || Object.keys(detectedTypes).length === 0) return presetColumns
    return applyDetectedColumnDefaults(presetColumns, detectedTypes, { fillSortType: true })
  }, [options.autoDetectTypes, presetColumns, detectedTypes])

  const orderedColumns = React.useMemo(
    () => applyColumnOrder(detectedColumns, options.columnOrder),
    [detectedColumns, options.columnOrder],
  )

  const displayColumns = React.useMemo(() => {
    let cols = orderedColumns
    cols = applyColumnVisibility(cols, options.columnVisibility)
    if (cols.some((col) => col.visibleMethod)) {
      cols = cols.filter((col) => (col.visibleMethod ? col.visibleMethod() !== false : true))
    }
    return cols
  }, [orderedColumns, options.columnVisibility])

  const responsiveLeadingWidth =
    (options.rowDrag ? DRAG_COL_WIDTH : 0) +
    (options.showRowNumbers ? SEQ_COL_WIDTH : 0) +
    (hasDetail ? EXPAND_COL_WIDTH : 0) +
    (options.selectable !== 'none' ? SELECTION_COL_WIDTH : 0)
  const responsiveResult = React.useMemo(() => {
    if (!options.responsive) return { columns: displayColumns, overflow: false }
    return computeResponsiveColumnLayout(displayColumns, options.responsiveWidth, {
      leadingWidth: responsiveLeadingWidth,
      widthOf: (col) => resolveColumnWidth(col as IrisTableColumn<Row>, columnWidths),
      isPinnedLeaf: (col) => pinOf(col as IrisTableColumn<Row>) !== null,
    })
  }, [
    options.responsive,
    options.responsiveWidth,
    responsiveLeadingWidth,
    displayColumns,
    columnWidths,
    pinOf,
  ])
  const responsiveDisplayColumns = responsiveResult.columns as IrisTableColumn<Row>[]
  const responsiveOverflow = responsiveResult.overflow

  const grouped = React.useMemo(
    () => safeColumns.some((col) => col.children && col.children.length > 0),
    [safeColumns],
  )
  const leafColumns = React.useMemo(
    () => (grouped ? flattenLeafColumns(responsiveDisplayColumns) : responsiveDisplayColumns),
    [grouped, responsiveDisplayColumns],
  )
  const viewColumnsRef = React.useRef(leafColumns)
  viewColumnsRef.current = leafColumns
  const headerMatrix = React.useMemo(
    () => (grouped ? buildHeaderMatrix(responsiveDisplayColumns) : null),
    [grouped, responsiveDisplayColumns],
  )

  return {
    hasDetail,
    safeColumns,
    presetColumns,
    detectedColumns,
    detectedTypes,
    setDetectedTypes,
    detectTypesRef,
    orderedColumns,
    displayColumns,
    columnWidths,
    setColumnWidth,
    resetColumnWidths,
    pinOf,
    setColumnPinned,
    responsiveLeadingWidth,
    responsiveDisplayColumns,
    responsiveOverflow,
    grouped,
    leafColumns,
    viewColumnsRef,
    headerMatrix,
  }
}
