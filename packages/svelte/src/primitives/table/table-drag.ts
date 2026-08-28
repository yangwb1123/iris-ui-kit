import { createSortable, type SortableController, type SortableRect } from '@iris-ui-kit/core'
import type { IrisTableColumn, IrisTableColumnDrag, IrisTableRowDrag } from './types'

export interface TableDragBridgeOptions {
  getRoot: () => HTMLElement | null
  getRows: () => Array<Record<string, unknown>>
  getColumns: () => IrisTableColumn[]
  getRowId: (row: Record<string, unknown>, index: number) => string | number
  isGrouped: () => boolean
  getRowDrag: () => IrisTableRowDrag | undefined
  getColumnDrag: () => IrisTableColumnDrag | undefined
  /** Resolve a drag into canonical source rows; `null` rejects the drop. */
  reorderRows?: (activeId: string, overId: string) => Array<Record<string, unknown>> | null
  /** Commit a drag directly through the rows feature and return its snapshot. */
  commitReorderRows?: (activeId: string, overId: string) => Array<Record<string, unknown>> | null
  /** Commit rows returned by the legacy `reorderRows` resolver. */
  commitRows?: (rows: Array<Record<string, unknown>>) => void
  /** Commit a column-order proposal only when the adapter has an explicit owner. */
  commitColumnOrder?: (order: string[]) => void
  onDataChange?: (rows: Array<Record<string, unknown>>) => void
}

export interface TableDragBridge {
  rowController: SortableController
  columnController: SortableController
  rowPointerDown: (event: PointerEvent, id: string) => void
  rowPointerMove: (event: PointerEvent) => void
  rowPointerUp: () => void
  columnPointerDown: (event: PointerEvent, key: string) => void
  columnPointerMove: (event: PointerEvent) => void
  columnPointerUp: () => void
  pointerMove: (event: PointerEvent) => void
  pointerUp: () => void
  cancel: () => void
}

function rectsFor(root: HTMLElement | null, selector: string, attr: string): SortableRect[] {
  const rects: SortableRect[] = []
  root?.querySelectorAll<HTMLElement>(selector).forEach((node) => {
    const id = node.getAttribute(attr)
    if (!id) return
    const rect = node.getBoundingClientRect()
    rects.push({ id, left: rect.left, top: rect.top, width: rect.width, height: rect.height })
  })
  return rects
}

export function createTableDragBridge(options: TableDragBridgeOptions): TableDragBridge {
  const rowController = createSortable()
  const columnController = createSortable()
  const rowRects: SortableRect[] = []
  const columnRects: SortableRect[] = []

  function rowPointerDown(event: PointerEvent, id: string): void {
    if (!options.getRowDrag() || event.button !== 0) return
    event.preventDefault()
    rowController.press(id, event.clientX, event.clientY)
  }

  function rowPointerMove(event: PointerEvent): void {
    if (!options.getRowDrag()) return
    if (rowController.isPending() && rowController.tryStart(event.clientX, event.clientY)) {
      rowRects.splice(
        0,
        rowRects.length,
        ...rectsFor(options.getRoot(), '[data-iris-row-drag-handle]', 'data-iris-row-drag-handle'),
      )
    }
    if (rowController.getState().activeId !== null) {
      rowController.moveOver({ x: event.clientX, y: event.clientY }, rowRects)
    }
  }

  function rowPointerUp(): void {
    const config = options.getRowDrag()
    if (!config) return
    if (rowController.isPending()) {
      rowController.cancel()
      rowRects.length = 0
      return
    }
    const { activeId, overId } = rowController.end()
    if (activeId !== null && overId !== null && activeId !== overId) {
      const directCommit = options.commitReorderRows !== undefined
      const rows = directCommit
        ? options.commitReorderRows!(activeId, overId)
        : options.reorderRows
          ? options.reorderRows(activeId, overId)
          : (() => {
              const next = [...options.getRows()]
              const from = next.findIndex(
                (row, index) => String(options.getRowId(row, index)) === activeId,
              )
              const to = next.findIndex(
                (row, index) => String(options.getRowId(row, index)) === overId,
              )
              if (from < 0 || to < 0 || from === to) return null
              const [moved] = next.splice(from, 1)
              next.splice(to, 0, moved!)
              return next
            })()
      if (rows) {
        if (!directCommit) options.commitRows?.(rows)
        options.onDataChange?.(rows)
        config.onReorder(rows)
      }
    }
    rowRects.length = 0
  }

  function columnPointerDown(event: PointerEvent, key: string): void {
    if (!options.getColumnDrag() || options.isGrouped() || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    columnController.press(key, event.clientX, event.clientY)
  }

  function columnPointerMove(event: PointerEvent): void {
    if (!options.getColumnDrag() || options.isGrouped()) return
    if (columnController.isPending() && columnController.tryStart(event.clientX, event.clientY)) {
      columnRects.splice(
        0,
        columnRects.length,
        ...rectsFor(
          options.getRoot(),
          '[data-iris-table-header-drag-target]',
          'data-iris-table-header-drag-target',
        ),
      )
    }
    if (columnController.getState().activeId !== null) {
      columnController.moveOver({ x: event.clientX, y: event.clientY }, columnRects)
    }
  }

  function columnPointerUp(): void {
    const config = options.getColumnDrag()
    if (!config || options.isGrouped()) return
    if (columnController.isPending()) {
      columnController.cancel()
      columnRects.length = 0
      return
    }
    const { activeId, overId } = columnController.end()
    if (activeId !== null && overId !== null && activeId !== overId) {
      const columns = [...options.getColumns()]
      const from = columns.findIndex((column) => column.key === activeId)
      const to = columns.findIndex((column) => column.key === overId)
      if (from >= 0 && to >= 0 && from !== to) {
        const [moved] = columns.splice(from, 1)
        columns.splice(to, 0, moved!)
        config.onReorder(columns)
        options.commitColumnOrder?.(columns.map((column) => column.key))
      }
    }
    columnRects.length = 0
  }

  function cancel(): void {
    if (rowController.isPending() || rowController.getState().activeId !== null) {
      rowController.cancel()
    }
    if (columnController.isPending() || columnController.getState().activeId !== null) {
      columnController.cancel()
    }
    rowRects.length = 0
    columnRects.length = 0
  }

  function pointerMove(event: PointerEvent): void {
    rowPointerMove(event)
    columnPointerMove(event)
  }

  function pointerUp(): void {
    rowPointerUp()
    columnPointerUp()
  }

  return {
    rowController,
    columnController,
    rowPointerDown,
    rowPointerMove,
    rowPointerUp,
    columnPointerDown,
    columnPointerMove,
    columnPointerUp,
    pointerMove,
    pointerUp,
    cancel,
  }
}
