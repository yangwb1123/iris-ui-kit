import { createSignal, type Accessor } from 'solid-js'
import { createSortable, type SortableRect, type SortableState } from '@iris-ui-kit/core'
import type { DashboardStore } from '../core'

function collectRects(root: HTMLElement | null, attr: string): SortableRect[] {
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(`[${attr}]`)).map((element) => {
    const rect = element.getBoundingClientRect()
    return {
      id: element.getAttribute(attr)!,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    }
  })
}

/** Own pointer/native drag state for the Dashboard Solid renderer. */
export class DashboardDragController {
  readonly sortable = createSortable()
  readonly sortableState: Accessor<SortableState>
  private readonly store: DashboardStore
  private readonly unsubscribe: () => void
  private dragWidgetId: string | null = null
  private dragRects: SortableRect[] = []

  constructor(store: DashboardStore) {
    this.store = store
    const [state, setState] = createSignal(this.sortable.getState())
    this.sortableState = state
    this.unsubscribe = this.sortable.subscribe(setState)
  }

  dispose = (): void => {
    this.unsubscribe()
    this.sortable.cancel()
  }

  onHeaderPointerDown = (widgetId: string, event: PointerEvent): void => {
    if (event.pointerType === 'mouse') return
    try {
      ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
    } catch {
      /* ignore inactive pointers (including jsdom). */
    }
    this.sortable.press(widgetId, event.clientX, event.clientY)
  }

  onHeaderPointerMove = (widgetId: string, event: PointerEvent): void => {
    if (this.sortable.tryStart(event.clientX, event.clientY)) {
      const root = (event.currentTarget as HTMLElement).closest<HTMLElement>(
        '[data-iris-dashboard]',
      )
      this.dragRects = collectRects(root, 'data-iris-dashboard-cell')
    }
    if (!this.sortable.isActive(widgetId)) return
    this.sortable.moveOver({ x: event.clientX, y: event.clientY }, this.dragRects)
  }

  onHeaderPointerUp = (widgetId: string): void => {
    if (!this.sortable.isActive(widgetId)) {
      this.sortable.cancel()
      return
    }
    const { activeId, overId } = this.sortable.end()
    if (!activeId || !overId) return
    const [column, row] = overId.split('-').map(Number)
    if (Number.isFinite(column) && Number.isFinite(row)) {
      this.store.moveWidget(activeId, column!, row!)
    }
  }

  onHeaderPointerCancel = (): void => {
    this.sortable.cancel()
  }

  onDragStart = (widgetId: string, event: DragEvent): void => {
    this.dragWidgetId = widgetId
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  }

  onDragEnd = (): void => {
    this.dragWidgetId = null
  }

  onDrop = (event: DragEvent, column: number, row: number): void => {
    event.preventDefault()
    if (this.dragWidgetId) this.store.moveWidget(this.dragWidgetId, column, row)
    this.dragWidgetId = null
  }
}
