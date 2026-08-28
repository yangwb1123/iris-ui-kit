import { createSortable, type SortableRect } from '@iris-ui-kit/core'
import type { Accessor } from 'solid-js'
import { useStore } from '../../useStore'
import type { IrisTableColumn } from './types'

type TableDragConfig<Row extends Record<string, unknown>> = {
  rowDrag: Accessor<{ onReorder: (rows: Row[]) => void } | undefined>
  columnDrag: Accessor<{ onReorder: (columns: IrisTableColumn<Row>[]) => void } | undefined>
  root: Accessor<HTMLElement | undefined>
  rows: Accessor<Row[]>
  columns: Accessor<IrisTableColumn<Row>[]>
  rowId: (row: Row, index: number) => string | number
  /** Top-level column order is controlled only when this accessor is true. */
  columnOrderControlled?: Accessor<boolean>
  /** The shared Grid Columns model's controlled-order write path. */
  setColumnOrder?: (order: string[]) => void
  /** Grouped tables keep column order at the top-level and do not sync leaf drags. */
  grouped?: Accessor<boolean>
  /** Resolve a drag into the canonical source rows; `null` rejects the drop. */
  reorderRows?: (activeId: string, overId: string) => Row[] | null
  /** Commit a drag directly through the rows feature and return its snapshot. */
  commitReorderRows?: (activeId: string, overId: string) => Row[] | null
  /** Commit rows returned by the legacy `reorderRows` resolver. */
  commitRows?: (rows: Row[]) => void
  onDataChange?: (rows: Row[]) => void
}

export type TableDragResult = {
  rowActive: Accessor<string | null>
  rowOver: Accessor<string | null>
  columnActive: Accessor<string | null>
  columnOver: Accessor<string | null>
  onRowPointerDown: (event: PointerEvent, rowId: string) => void
  onRowPointerMove: (event: PointerEvent) => void
  onRowPointerUp: () => void
  onRowPointerLeave: () => void
  onColumnPointerDown: (event: PointerEvent, columnKey: string) => void
  onColumnPointerMove: (event: PointerEvent) => void
  onColumnPointerUp: () => void
}

function collectRects(
  root: HTMLElement | undefined,
  selector: string,
  attr: string,
): SortableRect[] {
  const rects: SortableRect[] = []
  root?.querySelectorAll(selector).forEach((element) => {
    const node = element as HTMLElement
    const id = node.getAttribute(attr)
    if (!id) return
    const rect = node.getBoundingClientRect()
    rects.push({ id, left: rect.left, top: rect.top, width: rect.width, height: rect.height })
  })
  return rects
}

/** Bridges the core sortable controller to the table's row/column pointer UI. */
export function createTableDrag<Row extends Record<string, unknown>>(
  options: TableDragConfig<Row>,
): TableDragResult {
  const rowController = createSortable()
  const rowState = useStore(rowController)
  const columnController = createSortable()
  const columnState = useStore(columnController)
  const rowRects: SortableRect[] = []
  const columnRects: SortableRect[] = []

  const onRowPointerDown = (event: PointerEvent, rowId: string): void => {
    if (!options.rowDrag() || event.button !== 0) return
    event.preventDefault()
    rowController.press(rowId, event.clientX, event.clientY)
  }

  const onRowPointerMove = (event: PointerEvent): void => {
    if (!options.rowDrag()) return
    if (rowController.isPending() && rowController.tryStart(event.clientX, event.clientY)) {
      rowRects.length = 0
      rowRects.push(
        ...collectRects(options.root(), '[data-iris-row-drag-handle]', 'data-iris-row-drag-handle'),
      )
    }
    if (rowController.getState().activeId !== null) {
      rowController.moveOver({ x: event.clientX, y: event.clientY }, rowRects)
    }
  }

  const onRowPointerUp = (): void => {
    if (!options.rowDrag()) return
    if (rowController.isPending()) {
      rowController.cancel()
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
              const next = [...options.rows()]
              const from = next.findIndex(
                (row, index) => String(options.rowId(row, index)) === activeId,
              )
              const to = next.findIndex(
                (row, index) => String(options.rowId(row, index)) === overId,
              )
              if (from < 0 || to < 0 || from === to) return null
              const [moved] = next.splice(from, 1)
              next.splice(to, 0, moved)
              return next
            })()
      if (rows) {
        if (!directCommit) options.commitRows?.(rows)
        options.onDataChange?.(rows)
        options.rowDrag()?.onReorder(rows)
      }
    }
    rowRects.length = 0
  }

  const onRowPointerLeave = (): void => {
    if (options.rowDrag() && rowController.getState().activeId !== null) rowController.cancel()
  }

  const onColumnPointerDown = (event: PointerEvent, columnKey: string): void => {
    if (!options.columnDrag() || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    columnController.press(columnKey, event.clientX, event.clientY)
  }

  const onColumnPointerMove = (event: PointerEvent): void => {
    if (!options.columnDrag()) return
    if (columnController.isPending() && columnController.tryStart(event.clientX, event.clientY)) {
      const columnKeys = new Set(options.columns().map((column) => column.key))
      columnRects.length = 0
      columnRects.push(
        ...collectRects(
          options.root(),
          '[data-iris-table-header]',
          'data-iris-table-header',
        ).filter((rect) => columnKeys.has(rect.id)),
      )
    }
    if (columnController.getState().activeId !== null) {
      columnController.moveOver({ x: event.clientX, y: event.clientY }, columnRects)
    }
  }

  const onColumnPointerUp = (): void => {
    if (!options.columnDrag()) return
    if (columnController.isPending()) {
      columnController.cancel()
      return
    }
    const { activeId, overId } = columnController.end()
    if (activeId !== null && overId !== null && activeId !== overId) {
      const columns = [...options.columns()]
      const from = columns.findIndex((column) => column.key === activeId)
      const to = columns.findIndex((column) => column.key === overId)
      if (from >= 0 && to >= 0 && from !== to) {
        const [moved] = columns.splice(from, 1)
        columns.splice(to, 0, moved)
        options.columnDrag()?.onReorder(columns)
        if (options.columnOrderControlled?.() && !options.grouped?.()) {
          options.setColumnOrder?.(columns.map((column) => column.key))
        }
      }
    }
    columnRects.length = 0
  }

  return {
    rowActive: () => rowState().activeId,
    rowOver: () => rowState().overId,
    columnActive: () => columnState().activeId,
    columnOver: () => columnState().overId,
    onRowPointerDown,
    onRowPointerMove,
    onRowPointerUp,
    onRowPointerLeave,
    onColumnPointerDown,
    onColumnPointerMove,
    onColumnPointerUp,
  }
}
