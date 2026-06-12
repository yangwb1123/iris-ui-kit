import * as React from 'react'
import { createSortable, type SortableRect } from '@iris-ui/core'
import { createKanban, type KanbanConfig } from '../core'

export type { KanbanCard, KanbanColumn, KanbanConfig, KanbanState, KanbanStore } from '../core'

export interface IrisKanbanProps {
  config: KanbanConfig
  className?: string
  style?: React.CSSProperties
}

/** Collect drop-target rects (id + client rect) for every `[attr]` under `root`. */
function collectRects(root: HTMLElement | null, attr: string): SortableRect[] {
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

/**
 * Render a Kanban board from a declarative config (React). Columns are laid out
 * horizontally; each card can be moved to any column. WIP-limit columns refuse
 * drops when full. Themed via CSS vars.
 *
 * Two coexisting drag paths: desktop **mouse** uses native HTML5 DnD; **touch /
 * pen** uses the pointer-based `createSortable` controller (native HTML5 DnD
 * never fires on touch, so the board would otherwise be unusable under
 * Cordova / touch laptops). The pointer path is gated on `pointerType !== 'mouse'`
 * so the mouse flow — and its tests — are unchanged.
 */
export function IrisKanban({ config, className, style }: IrisKanbanProps) {
  // Create the store ONCE (it owns all state); reads config at construction only.
  const storeRef = React.useRef<ReturnType<typeof createKanban> | null>(null)
  if (storeRef.current === null) {
    storeRef.current = createKanban(config)
  }
  const store = storeRef.current

  const kanbanState = React.useSyncExternalStore(store.subscribe, store.getState, store.getState)

  // Track the dragged card id in a ref — no re-render needed on dragstart/over.
  const dragCardId = React.useRef<string | null>(null)

  // Touch/pen reorder via the shared core controller. Subscribing re-renders the
  // board only when the hovered column (overId) actually changes — the store
  // bails on same-value updates — so we get a live drop highlight cheaply.
  const sortable = React.useRef(createSortable()).current
  const sortableState = React.useSyncExternalStore(
    sortable.subscribe,
    sortable.getState,
    sortable.getState,
  )

  const isAtLimit = (colId: string): boolean => {
    const col = store.getState().columns.find((c) => c.id === colId)
    return col?.limit !== undefined && col.cards.length >= col.limit
  }

  const onCardPointerDown = (cardId: string) => (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse') return // desktop mouse → native HTML5 DnD
    // setPointerCapture can throw (inactive pointer / jsdom) — best-effort.
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      /* ignore */
    }
    sortable.start(cardId)
  }
  const onCardPointerMove = (cardId: string) => (e: React.PointerEvent<HTMLElement>) => {
    if (!sortable.isActive(cardId)) return
    const root = e.currentTarget.closest<HTMLElement>('[data-iris-kanban]')
    sortable.moveOver({ x: e.clientX, y: e.clientY }, collectRects(root, 'data-iris-kanban-column'))
  }
  const onCardPointerUp = (cardId: string) => () => {
    if (!sortable.isActive(cardId)) return
    const { activeId, overId } = sortable.end()
    if (activeId && overId && !isAtLimit(overId)) store.moveCard(activeId, overId)
  }

  return (
    <div
      data-iris-kanban=""
      className={className}
      style={{
        display: 'flex',
        gap: 'var(--iris-kanban-gap, 16px)',
        alignItems: 'flex-start',
        overflowX: 'auto',
        ...style,
      }}
    >
      {kanbanState.columns.map((col) => {
        const atLimit = col.limit !== undefined && col.cards.length >= col.limit
        return (
          <div
            key={col.id}
            data-iris-kanban-column={col.id}
            style={{
              width: 'var(--iris-kanban-col-width, 280px)',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              // Live drop highlight for the touch/pen pointer path.
              outline:
                sortableState.activeId && sortableState.overId === col.id && !atLimit
                  ? '2px solid var(--iris-color-primary, #2563eb)'
                  : undefined,
              outlineOffset: 2,
            }}
            onDragOver={(e) => {
              e.preventDefault()
              if (e.dataTransfer) e.dataTransfer.dropEffect = atLimit ? 'none' : 'move'
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (dragCardId.current && !atLimit) {
                store.moveCard(dragCardId.current, col.id)
              }
              dragCardId.current = null
            }}
          >
            {/* Column header */}
            <div
              data-iris-kanban-col-header=""
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
            >
              <span>{col.title}</span>
              <span
                data-iris-kanban-count=""
                style={{ fontSize: '0.8em', color: 'var(--iris-color-muted, #6b7280)' }}
              >
                {col.cards.length}
                {col.limit !== undefined ? `/${col.limit}` : ''}
              </span>
              {atLimit && (
                <span
                  data-iris-kanban-wip-badge=""
                  style={{
                    fontSize: '0.7em',
                    background: 'var(--iris-color-warning, #f59e0b)',
                    color: '#fff',
                    borderRadius: 4,
                    padding: '1px 5px',
                  }}
                >
                  WIP
                </span>
              )}
            </div>

            {/* Cards */}
            {col.cards.map((card) => (
              <div
                key={card.id}
                data-iris-kanban-card={card.id}
                draggable
                style={{
                  background: 'var(--iris-kanban-card-bg, #fff)',
                  border: '1px solid var(--iris-color-border, #e5e7eb)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  cursor: 'grab',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  // Let the pointer path own touch gestures on the card (otherwise
                  // the browser claims them for scrolling and no pointermove fires).
                  touchAction: 'none',
                }}
                onDragStart={(e) => {
                  dragCardId.current = card.id
                  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={() => {
                  dragCardId.current = null
                }}
                onPointerDown={onCardPointerDown(card.id)}
                onPointerMove={onCardPointerMove(card.id)}
                onPointerUp={onCardPointerUp(card.id)}
                onPointerCancel={() => {
                  if (sortable.isActive(card.id)) sortable.cancel()
                }}
              >
                <span data-iris-kanban-card-title="" style={{ fontWeight: 500 }}>
                  {card.title}
                </span>
                {card.description && (
                  <span
                    data-iris-kanban-card-desc=""
                    style={{ fontSize: '0.85em', color: 'var(--iris-color-muted, #6b7280)' }}
                  >
                    {card.description}
                  </span>
                )}
                {card.tags && card.tags.length > 0 && (
                  <div
                    data-iris-kanban-card-tags=""
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}
                  >
                    {card.tags.map((tag) => (
                      <span
                        key={tag}
                        data-iris-kanban-tag=""
                        style={{
                          fontSize: '0.75em',
                          background: 'var(--iris-color-primary-subtle, #eff6ff)',
                          color: 'var(--iris-color-primary, #2563eb)',
                          borderRadius: 4,
                          padding: '1px 5px',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
