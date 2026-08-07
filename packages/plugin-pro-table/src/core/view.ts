import {
  buildOffsets,
  computeVirtualRange,
  createSortable,
  type SortableRect,
  type SortState,
  type VirtualWindow,
} from '@iris-ui-kit/core'
import type { ProTableLabels, ProTableState } from './types'

export const defaultProTableLabels: Required<ProTableLabels> = {
  selectAll: 'Select all',
  filterColumn: 'Filter {title}',
  selectRow: 'Select row {key}',
  prev: 'Prev',
  next: 'Next',
  summaryLabel: 'Summary',
}

/** Resolve and interpolate a host-overridable renderer label. */
export function proTableLabel(
  labels: ProTableLabels | undefined,
  key: keyof ProTableLabels,
  vars?: Record<string, string>,
): string {
  let text = labels?.[key] ?? defaultProTableLabels[key]
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replace(`{${name}}`, value)
    }
  }
  return text
}

/** Apply column windowing and report the leading offset. */
export function applyColumnWindow<T>(
  columns: T[],
  colWindow: VirtualWindow | null,
): { visible: T[]; offsetBefore: number } {
  if (!colWindow) return { visible: columns, offsetBefore: 0 }
  return {
    visible: columns.slice(colWindow.startIndex, colWindow.endIndex + 1),
    offsetBefore: colWindow.offsetBefore,
  }
}

/** Compute the horizontal virtual window from current table state. */
export function computeProTableColumnWindow<Row>(
  state: Pick<
    ProTableState<Row>,
    'columnViewportWidth' | 'horizontalScroll' | 'columns' | 'columnSizes'
  >,
): VirtualWindow | null {
  const { columnViewportWidth, horizontalScroll, columns, columnSizes } = state
  if (columnViewportWidth <= 0 || columns.length === 0) return null
  const offsets = buildOffsets(columns.length, (index) => {
    const column = columns[index]
    if (!column) return 150
    const size = columnSizes[column.key]
    if (typeof size === 'number') return size
    return typeof column.width === 'number' ? column.width : 150
  })
  const totalWidth = offsets[columns.length]
  const scrollLeft = Math.max(
    0,
    Math.min(horizontalScroll, Math.max(0, totalWidth - columnViewportWidth)),
  )
  return computeVirtualRange({
    itemCount: columns.length,
    scrollTop: scrollLeft,
    viewportSize: columnViewportWidth,
    itemSize: 150,
    offsets,
  })
}

/** CSS custom properties the ProTable reads; overridable by the host theme. */
export const proTableTokens: Record<string, string> = {
  '--iris-pro-table-selected-bg': 'var(--iris-primary-subtle)',
  '--iris-pro-table-chip-bg': 'var(--iris-surface-hover)',
}

/** Collect drop-target rectangles under `root`. */
export function collectRects(
  root: HTMLElement | null,
  attr: string,
): { id: string; left: number; top: number; width: number; height: number }[] {
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(`[${attr}]`)).map((el) => {
    const r = el.getBoundingClientRect()
    return {
      id: el.getAttribute(attr)!,
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
    }
  })
}

export interface ProTablePointerEvent {
  pointerType: string
  pointerId: number
  clientX: number
  clientY: number
  currentTarget: EventTarget | null
}

/**
 * Framework-neutral touch/pen column-reorder gesture. Adapters only bridge
 * their event shape and apply the completed `{ from, to }` move to the store.
 */
export function createProTableColumnReorder() {
  const sortable = createSortable()
  let dragRects: SortableRect[] = []

  return {
    sortable,
    pointerDown(enabled: boolean, key: string, event: ProTablePointerEvent): void {
      if (!enabled || event.pointerType === 'mouse') return
      const target = event.currentTarget as HTMLElement | null
      try {
        target?.setPointerCapture?.(event.pointerId)
      } catch {
        /* ignore unsupported pointer capture */
      }
      sortable.press(key, event.clientX, event.clientY)
    },
    pointerMove(key: string, event: ProTablePointerEvent): void {
      const target = event.currentTarget as HTMLElement | null
      if (sortable.tryStart(event.clientX, event.clientY)) {
        const root = target?.closest<HTMLElement>('[data-iris-pro-table]') ?? null
        dragRects = collectRects(root, 'data-iris-col-key')
      }
      if (sortable.isActive(key)) {
        sortable.moveOver({ x: event.clientX, y: event.clientY }, dragRects)
      }
    },
    pointerUp(key: string): { from: string; to: string } | null {
      if (!sortable.isActive(key)) {
        sortable.cancel()
        return null
      }
      const { activeId, overId } = sortable.end()
      return activeId && overId && activeId !== overId ? { from: activeId, to: overId } : null
    },
    pointerCancel(): void {
      sortable.cancel()
    },
  }
}

export interface ProTablePinnedStyle {
  position: 'sticky'
  insetInlineStart?: 0
  insetInlineEnd?: 0
  zIndex: 1
}

/** Compute logical sticky positioning for a pinned column. */
export function pinnedStyle(column: {
  pinned?: 'left' | 'right'
}): ProTablePinnedStyle | undefined {
  if (!column.pinned) return undefined
  return column.pinned === 'left'
    ? { position: 'sticky', insetInlineStart: 0, zIndex: 1 }
    : { position: 'sticky', insetInlineEnd: 0, zIndex: 1 }
}

/** The visual text appended to a sorted column heading. */
export function proTableSortIndicator(sort: SortState | null, key: string): string {
  return sort?.key === key ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : ''
}

/** WAI-ARIA sort state for a sortable column heading. */
export function proTableAriaSort(
  sort: SortState | null,
  column: { key: string; sortable?: boolean },
): 'ascending' | 'descending' | 'none' | undefined {
  return sort?.key === column.key
    ? sort.direction === 'asc'
      ? 'ascending'
      : 'descending'
    : column.sortable
      ? 'none'
      : undefined
}
