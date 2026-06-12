import { createSignal, onCleanup, For, Show, type JSX } from 'solid-js'
import { createSortable, type SortableRect } from '@iris-ui/core'
import { createKanban, type KanbanConfig } from '../core'

export type { KanbanCard, KanbanColumn, KanbanConfig, KanbanState, KanbanStore } from '../core'

export interface IrisKanbanProps {
  config: KanbanConfig
  class?: string
  style?: JSX.CSSProperties
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
 * Render a Kanban board from a declarative config (SolidJS). Cards are
 * draggable via native HTML5 DnD; dropping onto a column calls `store.moveCard`.
 * WIP-limited columns refuse drops when full. Themed via CSS vars.
 *
 * Two coexisting drag paths: desktop **mouse** uses native HTML5 DnD; **touch /
 * pen** uses the pointer-based `createSortable` controller (native HTML5 DnD
 * never fires on touch, so the board would otherwise be unusable under
 * Cordova / touch laptops). The pointer path is gated on `pointerType !== 'mouse'`
 * so the mouse flow — and its tests — are unchanged.
 */
export function IrisKanban(props: IrisKanbanProps) {
  // Create the store ONCE (props are read at construction only).
  const store = createKanban(props.config)

  const [kanbanState, setKanbanState] = createSignal(store.getState())
  onCleanup(store.subscribe(setKanbanState))

  // Touch/pen reorder via the shared core controller. Subscribing keeps a
  // signal copy of overId for the live drop highlight; the store bails on
  // same-value updates so we only re-render when the hovered column changes.
  const sortable = createSortable()
  const [sortableState, setSortableState] = createSignal(sortable.getState())
  onCleanup(sortable.subscribe(setSortableState))

  // Track dragged card id in a plain variable — no reactive overhead.
  let dragCardId: string | null = null

  const isAtLimit = (colId: string): boolean => {
    const col = store.getState().columns.find((c) => c.id === colId)
    return col?.limit !== undefined && col.cards.length >= col.limit
  }

  const onCardPointerDown = (cardId: string) => (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return // desktop mouse → native HTML5 DnD
    // setPointerCapture can throw (inactive pointer / jsdom) — best-effort.
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    } catch {
      /* ignore */
    }
    sortable.start(cardId)
  }
  const onCardPointerMove = (cardId: string) => (e: PointerEvent) => {
    if (!sortable.isActive(cardId)) return
    const root = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-iris-kanban]')
    sortable.moveOver({ x: e.clientX, y: e.clientY }, collectRects(root, 'data-iris-kanban-column'))
  }
  const onCardPointerUp = (cardId: string) => () => {
    if (!sortable.isActive(cardId)) return
    const { activeId, overId } = sortable.end()
    if (activeId && overId && !isAtLimit(overId)) store.moveCard(activeId, overId)
  }
  const onCardPointerCancel = (cardId: string) => () => {
    if (sortable.isActive(cardId)) sortable.cancel()
  }

  return (
    <div
      data-iris-kanban=""
      class={props.class}
      style={{
        display: 'flex',
        gap: 'var(--iris-kanban-gap, 16px)',
        'align-items': 'flex-start',
        'overflow-x': 'auto',
        ...props.style,
      }}
    >
      <For each={kanbanState().columns}>
        {(col) => {
          const atLimit = () =>
            col.limit !== undefined &&
            kanbanState().columns.find((c) => c.id === col.id)!.cards.length >= col.limit!

          return (
            <div
              data-iris-kanban-column={col.id}
              style={{
                width: 'var(--iris-kanban-col-width, 280px)',
                'flex-shrink': '0',
                display: 'flex',
                'flex-direction': 'column',
                gap: '8px',
                // Live drop highlight for the touch/pen pointer path.
                outline:
                  sortableState().activeId && sortableState().overId === col.id && !atLimit()
                    ? '2px solid var(--iris-color-primary, #2563eb)'
                    : undefined,
                'outline-offset': '2px',
              }}
              onDragOver={(e) => {
                e.preventDefault()
                if (e.dataTransfer) e.dataTransfer.dropEffect = atLimit() ? 'none' : 'move'
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragCardId && !atLimit()) {
                  store.moveCard(dragCardId, col.id)
                }
                dragCardId = null
              }}
            >
              {/* Column header */}
              <div
                data-iris-kanban-col-header=""
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  gap: '6px',
                  'font-weight': '600',
                }}
              >
                <span>{col.title}</span>
                <span
                  data-iris-kanban-count=""
                  style={{ 'font-size': '0.8em', color: 'var(--iris-color-muted, #6b7280)' }}
                >
                  {col.limit !== undefined
                    ? `${kanbanState().columns.find((c) => c.id === col.id)!.cards.length}/${col.limit}`
                    : String(kanbanState().columns.find((c) => c.id === col.id)!.cards.length)}
                </span>
                <Show when={atLimit()}>
                  <span
                    data-iris-kanban-wip-badge=""
                    style={{
                      'font-size': '0.7em',
                      background: 'var(--iris-color-warning, #f59e0b)',
                      color: '#fff',
                      'border-radius': '4px',
                      padding: '1px 5px',
                    }}
                  >
                    WIP
                  </span>
                </Show>
              </div>

              {/* Cards */}
              <For each={kanbanState().columns.find((c) => c.id === col.id)!.cards}>
                {(card) => (
                  <div
                    data-iris-kanban-card={card.id}
                    draggable={true}
                    style={{
                      background: 'var(--iris-kanban-card-bg, #fff)',
                      border: '1px solid var(--iris-color-border, #e5e7eb)',
                      'border-radius': '6px',
                      padding: '8px 10px',
                      cursor: 'grab',
                      display: 'flex',
                      'flex-direction': 'column',
                      gap: '4px',
                      // Let the pointer path own touch gestures on the card (otherwise
                      // the browser claims them for scrolling and no pointermove fires).
                      'touch-action': 'none',
                    }}
                    onDragStart={(e) => {
                      dragCardId = card.id
                      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragEnd={() => {
                      dragCardId = null
                    }}
                    onPointerDown={onCardPointerDown(card.id)}
                    onPointerMove={onCardPointerMove(card.id)}
                    onPointerUp={onCardPointerUp(card.id)}
                    onPointerCancel={onCardPointerCancel(card.id)}
                  >
                    <span data-iris-kanban-card-title="" style={{ 'font-weight': '500' }}>
                      {card.title}
                    </span>
                    <Show when={card.description}>
                      <span
                        data-iris-kanban-card-desc=""
                        style={{ 'font-size': '0.85em', color: 'var(--iris-color-muted, #6b7280)' }}
                      >
                        {card.description}
                      </span>
                    </Show>
                    <Show when={card.tags && card.tags.length > 0}>
                      <div
                        data-iris-kanban-card-tags=""
                        style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '4px' }}
                      >
                        <For each={card.tags}>
                          {(tag) => (
                            <span
                              data-iris-kanban-tag=""
                              style={{
                                'font-size': '0.75em',
                                background: 'var(--iris-color-primary-subtle, #eff6ff)',
                                color: 'var(--iris-color-primary, #2563eb)',
                                'border-radius': '4px',
                                padding: '1px 5px',
                              }}
                            >
                              {tag}
                            </span>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          )
        }}
      </For>
    </div>
  )
}
