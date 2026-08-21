import { createSignal, type Accessor } from 'solid-js'
import { createSortable, type SortableRect, type SortableState } from '@iris-ui-kit/core'
import type { KanbanStore } from '../core'

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

/** Owns pointer/native drag state so the Kanban renderer stays declarative. */
export class KanbanDragController {
  readonly sortable = createSortable()
  readonly sortableState: Accessor<SortableState>
  private readonly unsubscribe: () => void
  private readonly store: KanbanStore
  private dragCardId: string | null = null
  private dragRects: SortableRect[] = []

  constructor(store: KanbanStore) {
    this.store = store
    const [state, setState] = createSignal(this.sortable.getState())
    this.sortableState = state
    this.unsubscribe = this.sortable.subscribe(setState)
  }

  dispose = (): void => {
    this.unsubscribe()
    this.sortable.cancel()
  }

  isAtLimit = (columnId: string): boolean => {
    const column = this.store.getState().columns.find((item) => item.id === columnId)
    return column?.limit !== undefined && column.cards.length >= column.limit
  }

  onCardPointerDown =
    (cardId: string) =>
    (event: PointerEvent): void => {
      if (event.pointerType === 'mouse') return
      try {
        ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
      } catch {
        /* ignore inactive pointers (including jsdom). */
      }
      this.sortable.press(cardId, event.clientX, event.clientY)
    }

  onCardPointerMove =
    (cardId: string) =>
    (event: PointerEvent): void => {
      if (this.sortable.tryStart(event.clientX, event.clientY)) {
        const root = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-iris-kanban]')
        this.dragRects = collectRects(root, 'data-iris-kanban-column')
      }
      if (!this.sortable.isActive(cardId)) return
      this.sortable.moveOver({ x: event.clientX, y: event.clientY }, this.dragRects)
    }

  onCardPointerUp = (cardId: string): void => {
    if (!this.sortable.isActive(cardId)) {
      this.sortable.cancel()
      return
    }
    const { activeId, overId } = this.sortable.end()
    if (activeId && overId && !this.isAtLimit(overId)) this.store.moveCard(activeId, overId)
  }

  onCardPointerCancel = (): void => {
    this.sortable.cancel()
  }

  onDragStart = (cardId: string, event: DragEvent): void => {
    this.dragCardId = cardId
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  }

  onDragEnd = (): void => {
    this.dragCardId = null
  }

  onDrop = (event: DragEvent, columnId: string): void => {
    event.preventDefault()
    if (this.dragCardId && !this.isAtLimit(columnId)) {
      this.store.moveCard(this.dragCardId, columnId)
    }
    this.dragCardId = null
  }
}
