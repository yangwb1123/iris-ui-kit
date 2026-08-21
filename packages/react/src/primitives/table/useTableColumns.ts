import * as React from 'react'
import {
  applyColumnPreset,
  buildHeaderMatrix,
  computeResponsiveColumns,
  flattenLeafColumns,
  RESPONSIVE_NARROW_WIDTH,
  type DetectedColumnType,
  type HeaderCell,
} from '@iris-ui-kit/core'
import type { IrisTableColumn, IrisTableColumnWidths } from './types'
import { EXPAND_COL_WIDTH, SELECTION_COL_WIDTH } from './styles'
import { responsiveNaturalWidth, resolvedColumnWidth } from './column-layout'

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
  columnWidths?: IrisTableColumnWidths
  defaultColumnWidths?: IrisTableColumnWidths
  onColumnWidthsChange?: (next: IrisTableColumnWidths) => void
  pinnedColumns?: Record<string, 'left' | 'right' | null>
  onColumnPinnedChange?: (key: string, side: 'left' | 'right' | null) => void
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

/** Owns column declaration, width/pin state, visibility, and responsive fit. */
export function useTableColumns<Row extends Record<string, unknown>>(
  options: UseTableColumnsOptions<Row>,
): UseTableColumnsResult<Row> {
  const hasDetail = options.renderDetail !== undefined
  const safeColumns = React.useMemo(() => options.columns ?? [], [options.columns])

  const widthsControlled = options.columnWidths !== undefined
  const [widthsInternal, setWidthsInternal] = React.useState<IrisTableColumnWidths>(
    options.defaultColumnWidths ?? {},
  )
  const columnWidths = widthsControlled
    ? (options.columnWidths as IrisTableColumnWidths)
    : widthsInternal
  const setColumnWidth = (key: string, width: number): void => {
    const next = { ...columnWidths, [key]: width }
    if (!widthsControlled) setWidthsInternal(next)
    options.onColumnWidthsChange?.(next)
  }
  const resetColumnWidths = (): void => {
    if (!widthsControlled) setWidthsInternal({})
    options.onColumnWidthsChange?.({})
  }

  const pinsControlled = options.pinnedColumns !== undefined
  const [pinsInternal, setPinsInternal] = React.useState<Record<string, 'left' | 'right' | null>>(
    {},
  )
  const pinOf = React.useCallback(
    (col: IrisTableColumn<Row>): 'left' | 'right' | null => {
      if (pinsControlled) {
        return options.pinnedColumns && col.key in options.pinnedColumns
          ? options.pinnedColumns[col.key]
          : (col.pinned ?? null)
      }
      if (pinsInternal[col.key] !== undefined) return pinsInternal[col.key]
      return col.pinned ?? null
    },
    [pinsControlled, options.pinnedColumns, pinsInternal],
  )
  const setColumnPinned = (key: string, side: 'left' | 'right' | null): void => {
    if (!pinsControlled) setPinsInternal((previous) => ({ ...previous, [key]: side }))
    options.onColumnPinnedChange?.(key, side)
  }

  const columnOrderIndex = React.useMemo(() => {
    const map = new Map<string, number>()
    options.columnOrder?.forEach((key, index) => {
      if (!map.has(key)) map.set(key, index)
    })
    return map
  }, [options.columnOrder])

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
    const applyDetected = (col: IrisTableColumn<Row>): IrisTableColumn<Row> => {
      const kind = detectedTypes[col.key]
      const next = kind
        ? {
            ...col,
            ...(kind === 'number'
              ? {
                  ...(col.align === undefined ? { align: 'right' as const } : null),
                  ...(col.sortType === undefined ? { sortType: 'number' as const } : null),
                }
              : {
                  ...(col.align === undefined ? { align: 'left' as const } : null),
                  ...(col.sortType === undefined ? { sortType: 'string' as const } : null),
                }),
          }
        : col
      return next.children && next.children.length > 0
        ? { ...next, children: next.children.map(applyDetected) }
        : next
    }
    return presetColumns.map(applyDetected)
  }, [options.autoDetectTypes, presetColumns, detectedTypes])

  const orderedColumns = React.useMemo(() => {
    if (!options.columnOrder || options.columnOrder.length === 0) return detectedColumns
    const ordered = detectedColumns.filter((col) => columnOrderIndex.has(col.key))
    const rest = detectedColumns.filter((col) => !columnOrderIndex.has(col.key))
    ordered.sort((a, b) => columnOrderIndex.get(a.key)! - columnOrderIndex.get(b.key)!)
    return [...ordered, ...rest]
  }, [detectedColumns, options.columnOrder, columnOrderIndex])

  const displayColumns = React.useMemo(() => {
    let cols = orderedColumns
    if (options.columnVisibility) {
      cols = cols.filter((col) => options.columnVisibility![col.key] !== false)
    }
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
  const responsiveDisplayColumns = React.useMemo(() => {
    if (!options.responsive) return displayColumns
    const isPinned = (col: IrisTableColumn<Row>): boolean =>
      col.children && col.children.length > 0
        ? col.children.some((child) => isPinned(child))
        : pinOf(col) !== null
    const budget =
      options.responsiveWidth > 0
        ? Math.max(1, options.responsiveWidth - responsiveLeadingWidth)
        : options.responsiveWidth
    return computeResponsiveColumns(displayColumns, budget, {
      widthOf: (col) => resolvedColumnWidth(col as IrisTableColumn<Row>, columnWidths),
      isPinned: (col) => isPinned(col as IrisTableColumn<Row>),
      narrowWidth: RESPONSIVE_NARROW_WIDTH - responsiveLeadingWidth,
    }) as IrisTableColumn<Row>[]
  }, [
    options.responsive,
    options.responsiveWidth,
    responsiveLeadingWidth,
    displayColumns,
    columnWidths,
    pinOf,
  ])
  const responsiveOverflow = React.useMemo(() => {
    if (
      !options.responsive ||
      options.responsiveWidth <= 0 ||
      options.responsiveWidth >= RESPONSIVE_NARROW_WIDTH
    ) {
      return false
    }
    const natural = responsiveDisplayColumns.reduce(
      (sum, col) => sum + responsiveNaturalWidth(col, columnWidths),
      responsiveLeadingWidth,
    )
    return natural > options.responsiveWidth
  }, [
    options.responsive,
    options.responsiveWidth,
    responsiveDisplayColumns,
    columnWidths,
    responsiveLeadingWidth,
  ])

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
