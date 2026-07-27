import * as React from 'react'
import {
  createCellRange,
  createExpansion,
  createSelectionModel,
  type CellRangeController,
  type ExpansionModel,
} from '@iris-ui-kit/core'
import { useStore } from '../../useStore'
import type {
  IrisTableCellEditEvent,
  IrisTableColumn,
  IrisTableColumnWidths,
  IrisTableSortState,
} from './types'

export interface UseTableStateOptions<Row> {
  columns: IrisTableColumn<Row>[]
  rowKey: string
  selectable: 'none' | 'single' | 'multi'
  selection?: Array<string | number>
  defaultSelection?: Array<string | number>
  onSelectionChange?: (next: Array<string | number>) => void
  sort?: IrisTableSortState | null
  defaultSort?: IrisTableSortState | null
  onSortChange?: (next: IrisTableSortState | null) => void
  resizableColumns?: boolean
  columnWidths?: IrisTableColumnWidths
  defaultColumnWidths?: IrisTableColumnWidths
  onColumnWidthsChange?: (next: IrisTableColumnWidths) => void
  onCellEdit?: (event: IrisTableCellEditEvent<Row>) => void
  renderDetail?: (row: Row, rowIndex: number) => React.ReactNode
  rowExpandable?: (row: Row, rowIndex: number) => boolean
  defaultExpandedRowKeys?: Array<string | number>
  onExpandedRowsChange?: (keys: Array<string | number>) => void
  rowKeyOf: (row: Row) => string | number
}

export interface UseTableStateResult<Row> {
  selModel: ReturnType<typeof createSelectionModel<string | number>>
  displaySelection: Array<string | number>
  toggleRow: (row: Row) => void
  toggleAll: (keys: (string | number)[]) => void
  allSelected: boolean
  someSelected: boolean
  expansion: ExpansionModel<string>
  expandedKeys: string[]
  isRowExpandable: (row: Row, idx: number) => boolean
  hasDetail: boolean
  columnWidths: IrisTableColumnWidths
  setColumnWidth: (key: string, width: number) => void
  editingCellId: string | null
  editingDraft: string
  editError: string | null
  draftRef: React.MutableRefObject<string>
  editorRef: React.RefObject<HTMLInputElement>
  cellId: (rowIdent: string | number, colKey: string) => string
  beginEdit: (row: Row, col: IrisTableColumn<Row>, rowIdent: string | number) => void
  cancelEdit: () => void
  commitEdit: (row: Row, col: IrisTableColumn<Row>, rowIndex: number) => void
  cellRangeCtrl: CellRangeController
  cellRangeState: ReturnType<CellRangeController['getState']>
  isInRange: (row: number, col: number) => boolean
  setDraft: (value: string) => void
}

export function useTableState<Row>(options: UseTableStateOptions<Row>): UseTableStateResult<Row> {
  const {
    selectable,
    selection: selectionProp,
    defaultSelection,
    onSelectionChange,
    columnWidths: columnWidthsProp,
    defaultColumnWidths,
    onColumnWidthsChange,
    onCellEdit,
    renderDetail,
    rowExpandable,
    defaultExpandedRowKeys,
    onExpandedRowsChange,
    rowKeyOf,
  } = options

  // ---- Selection ----
  const selControlled = selectionProp !== undefined
  const selModelRef = React.useRef<ReturnType<typeof createSelectionModel<string | number>> | null>(
    null,
  )
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
  React.useEffect(() => {
    if (selControlled) selModel.sync(selectionProp as Array<string | number>)
  }, [selectionProp, selControlled, selModel])
  const displaySelection = selControlled ? (selectionProp as Array<string | number>) : selection
  const rebaseToProp = React.useCallback(() => {
    if (selControlled) selModel.sync(selectionProp as Array<string | number>)
  }, [selControlled, selModel, selectionProp])
  const toggleRow = React.useCallback(
    (row: Row) => {
      if (selectable === 'none') return
      rebaseToProp()
      selModel.toggle(rowKeyOf(row))
    },
    [selectable, rebaseToProp, selModel, rowKeyOf],
  )
  const toggleAll = React.useCallback(
    (keys: (string | number)[]) => {
      if (selectable !== 'multi') return
      rebaseToProp()
      selModel.toggleAll(keys)
    },
    [selectable, rebaseToProp, selModel],
  )
  // allKeys computed in component with bodyData
  // We compute allSelected/someSelected in the component where we have bodyData

  // ---- Expansion ----
  const hasDetail = renderDetail !== undefined
  const expansionRef = React.useRef<ExpansionModel<string> | null>(null)
  if (expansionRef.current === null) {
    expansionRef.current = createExpansion({
      mode: 'multiple',
      defaultExpanded: (defaultExpandedRowKeys ?? []).map(String),
      onChange: (keys) => onExpandedRowsChange?.(keys),
    })
  }
  const expansion = expansionRef.current!
  const expandedKeys = useStore(expansion.store)
  const isRowExpandable = React.useCallback(
    (row: Row, idx: number): boolean =>
      hasDetail && (rowExpandable ? rowExpandable(row, idx) : true),
    [hasDetail, rowExpandable],
  )

  // ---- Column widths ----
  const widthsControlled = columnWidthsProp !== undefined
  const [widthsInternal, setWidthsInternal] = React.useState<IrisTableColumnWidths>(
    defaultColumnWidths ?? {},
  )
  const columnWidths = widthsControlled
    ? (columnWidthsProp as IrisTableColumnWidths)
    : widthsInternal
  const setColumnWidth = React.useCallback(
    (key: string, width: number) => {
      const next = { ...columnWidths, [key]: width }
      if (!widthsControlled) setWidthsInternal(next)
      onColumnWidthsChange?.(next)
    },
    [columnWidths, widthsControlled, onColumnWidthsChange],
  )

  // ---- Inline editing ----
  const [editingCellId, setEditingCellId] = React.useState<string | null>(null)
  const [editingDraft, setEditingDraft] = React.useState('')
  const [editError, setEditError] = React.useState<string | null>(null)
  const draftRef = React.useRef('')
  const editorRef = React.useRef<HTMLInputElement>(null)
  const cellId = React.useCallback(
    (rowIdent: string | number, colKey: string): string => `${rowIdent}::${colKey}`,
    [],
  )
  React.useEffect(() => {
    if (editingCellId !== null) editorRef.current?.focus()
  }, [editingCellId])
  const setDraft = React.useCallback((value: string) => {
    draftRef.current = value
    setEditingDraft(value)
  }, [])

  // getCellValue helper (pure, defined inline to avoid import issues)
  function getCellValue(row: Row, column: IrisTableColumn<Row>): unknown {
    const key = (column.dataIndex ?? column.key) as keyof Row
    return row[key]
  }

  const beginEdit = React.useCallback(
    (row: Row, col: IrisTableColumn<Row>, rowIdent: string | number) => {
      if (!col.editable) return
      const current = getCellValue(row, col)
      setDraft(current == null ? '' : String(current))
      setEditError(null)
      setEditingCellId(cellId(rowIdent, col.key))
    },
    [setDraft, cellId],
  )
  const cancelEdit = React.useCallback(() => {
    setEditError(null)
    setEditingCellId(null)
  }, [])
  const commitEdit = React.useCallback(
    (row: Row, col: IrisTableColumn<Row>, rowIndex: number) => {
      if (editingCellId === null) return
      const oldValue = getCellValue(row, col)
      const draft = draftRef.current
      const newValue =
        col.editor === 'number'
          ? draft === '' || Number.isNaN(Number(draft))
            ? oldValue
            : Number(draft)
          : draft
      if (col.validate) {
        const error = col.validate(newValue, row)
        if (error) {
          setEditError(error)
          return
        }
      }
      setEditError(null)
      setEditingCellId(null)
      if (newValue !== oldValue) {
        onCellEdit?.({ row, column: col, oldValue, newValue, rowIndex })
      }
    },
    [editingCellId, onCellEdit],
  )

  // ---- Cell range ----
  const cellRangeRef = React.useRef<CellRangeController | null>(null)
  if (cellRangeRef.current === null) {
    cellRangeRef.current = createCellRange()
  }
  const cellRangeCtrl = cellRangeRef.current
  const cellRangeState = React.useSyncExternalStore(
    cellRangeCtrl.subscribe,
    cellRangeCtrl.getState,
    cellRangeCtrl.getState,
  )
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

  return {
    selModel,
    displaySelection,
    toggleRow,
    toggleAll,
    allSelected: false,
    someSelected: false,
    expansion,
    expandedKeys,
    isRowExpandable,
    hasDetail,
    columnWidths,
    setColumnWidth,
    editingCellId,
    editingDraft,
    editError,
    draftRef,
    editorRef,
    cellId,
    beginEdit,
    cancelEdit,
    commitEdit,
    cellRangeCtrl,
    cellRangeState,
    isInRange,
    setDraft,
  }
}
