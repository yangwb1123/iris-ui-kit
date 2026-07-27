import {
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  shallowRef,
  type PropType,
  type VNode,
} from 'vue'
import { createSortable, type SortableRect } from '@iris-ui-kit/core'
import { createKanban, type KanbanConfig, type KanbanColumn, type KanbanCard } from '../core'

export type { KanbanCard, KanbanColumn, KanbanConfig, KanbanState, KanbanStore } from '../core'

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
 * Render a Kanban board from a declarative config (Vue, render-function
 * authored to match the `@iris-ui-kit/vue` convention). Cards are draggable via
 * native HTML5 DnD; dropping onto a column calls `store.moveCard`. WIP-limited
 * columns refuse drops when full. Themed via CSS vars.
 *
 * Two coexisting drag paths: desktop **mouse** uses native HTML5 DnD; **touch /
 * pen** uses the pointer-based `createSortable` controller (native HTML5 DnD
 * never fires on touch, so the board would otherwise be unusable under
 * Cordova / touch laptops). The pointer path is gated on `pointerType !== 'mouse'`
 * so the mouse flow — and its tests — are unchanged.
 */
export const IrisKanban = defineComponent({
  name: 'IrisKanban',
  props: {
    config: { type: Object as PropType<KanbanConfig>, required: true },
    class: { type: String, default: undefined },
    style: { type: Object as PropType<Record<string, string>>, default: undefined },
  },
  setup(props) {
    const store = createKanban(props.config)
    const kanbanState = shallowRef(store.getState())
    let unsub = () => {}

    // Touch/pen reorder via the shared core controller. Subscribing keeps a
    // reactive copy of overId for the live drop highlight; the store bails on
    // same-value updates so we only re-render when the hovered column changes.
    const sortable = createSortable()
    const sortableState = shallowRef(sortable.getState())
    let unsubSortable = () => {}

    onMounted(() => {
      unsub = store.subscribe((s) => {
        kanbanState.value = s
      })
      unsubSortable = sortable.subscribe((s) => {
        sortableState.value = s
      })
    })
    onUnmounted(() => {
      unsub()
      unsubSortable()
    })

    // Track dragged card id without reactive overhead.
    let dragCardId: string | null = null

    // Drop-target rects, measured ONCE when a drag actually starts (not per move).
    let dragRects: SortableRect[] = []

    const isAtLimit = (colId: string): boolean => {
      const col = store.getState().columns.find((c) => c.id === colId)
      return col?.limit !== undefined && col.cards.length >= col.limit
    }

    const onCardPointerDown = (cardId: string) => (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return // desktop mouse → native HTML5 DnD
      // setPointerCapture can throw (inactive pointer / jsdom) — best-effort.
      try {
        ;(e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId)
      } catch {
        /* ignore */
      }
      // Record a pending press — no store write, so a tap never re-renders.
      sortable.press(cardId, e.clientX, e.clientY)
    }
    const onCardPointerMove = (cardId: string) => (e: PointerEvent) => {
      // Promote the pending press once it moves past the threshold; cache the
      // column rects at that moment (one getBoundingClientRect sweep per drag).
      if (sortable.tryStart(e.clientX, e.clientY)) {
        const root = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-iris-kanban]')
        dragRects = collectRects(root, 'data-iris-kanban-column')
      }
      if (!sortable.isActive(cardId)) return
      sortable.moveOver({ x: e.clientX, y: e.clientY }, dragRects)
    }
    const onCardPointerUp = (cardId: string) => () => {
      if (!sortable.isActive(cardId)) {
        sortable.cancel() // clear a pending tap (idle → no re-render)
        return
      }
      const { activeId, overId } = sortable.end()
      if (activeId && overId && !isAtLimit(overId)) store.moveCard(activeId, overId)
    }
    const onCardPointerCancel = () => () => {
      sortable.cancel()
    }

    return () => {
      const columns = kanbanState.value.columns

      const columnNodes: VNode[] = columns.map((col: KanbanColumn) => {
        const atLimit = col.limit !== undefined && col.cards.length >= col.limit

        const headerChildren: VNode[] = [
          h('span', {}, col.title),
          h(
            'span',
            {
              'data-iris-kanban-count': '',
              style: { fontSize: '0.8em', color: 'var(--iris-muted, #6b7280)' },
            },
            col.limit !== undefined ? `${col.cards.length}/${col.limit}` : String(col.cards.length),
          ),
        ]
        if (atLimit) {
          headerChildren.push(
            h(
              'span',
              {
                'data-iris-kanban-wip-badge': '',
                style: {
                  fontSize: '0.7em',
                  background: 'var(--iris-warning, #f59e0b)',
                  color: '#fff',
                  borderRadius: '4px',
                  padding: '1px 5px',
                },
              },
              'WIP',
            ),
          )
        }

        const cardNodes: VNode[] = col.cards.map((card: KanbanCard) => {
          const cardChildren: VNode[] = [
            h(
              'span',
              { 'data-iris-kanban-card-title': '', style: { fontWeight: 500 } },
              card.title,
            ),
          ]
          if (card.description) {
            cardChildren.push(
              h(
                'span',
                {
                  'data-iris-kanban-card-desc': '',
                  style: { fontSize: '0.85em', color: 'var(--iris-muted, #6b7280)' },
                },
                card.description,
              ),
            )
          }
          if (card.tags && card.tags.length > 0) {
            cardChildren.push(
              h(
                'div',
                {
                  'data-iris-kanban-card-tags': '',
                  style: { display: 'flex', flexWrap: 'wrap', gap: '4px' },
                },
                card.tags.map((tag) =>
                  h(
                    'span',
                    {
                      key: tag,
                      'data-iris-kanban-tag': '',
                      style: {
                        fontSize: '0.75em',
                        background: 'var(--iris-primary-subtle, #eff6ff)',
                        color: 'var(--iris-primary, #2563eb)',
                        borderRadius: '4px',
                        padding: '1px 5px',
                      },
                    },
                    tag,
                  ),
                ),
              ),
            )
          }

          return h(
            'div',
            {
              key: card.id,
              'data-iris-kanban-card': card.id,
              draggable: true,
              style: {
                background: 'var(--iris-kanban-card-bg, #fff)',
                border: '1px solid var(--iris-border, #e5e7eb)',
                borderRadius: '6px',
                padding: '8px 10px',
                cursor: 'grab',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                // Let the pointer path own touch gestures on the card (otherwise
                // the browser claims them for scrolling and no pointermove fires).
                touchAction: 'none',
              },
              onDragstart: (e: DragEvent) => {
                dragCardId = card.id
                if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
              },
              onDragend: () => {
                dragCardId = null
              },
              onPointerdown: onCardPointerDown(card.id),
              onPointermove: onCardPointerMove(card.id),
              onPointerup: onCardPointerUp(card.id),
              onPointercancel: onCardPointerCancel(),
            },
            cardChildren,
          )
        })

        const sState = sortableState.value
        return h(
          'div',
          {
            key: col.id,
            'data-iris-kanban-column': col.id,
            style: {
              width: 'var(--iris-kanban-col-width, 280px)',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              // Live drop highlight for the touch/pen pointer path.
              outline:
                sState.activeId && sState.overId === col.id && !atLimit
                  ? '2px solid var(--iris-primary, #2563eb)'
                  : undefined,
              outlineOffset: '2px',
            },
            onDragover: (e: DragEvent) => {
              e.preventDefault()
              if (e.dataTransfer) e.dataTransfer.dropEffect = atLimit ? 'none' : 'move'
            },
            onDrop: (e: DragEvent) => {
              e.preventDefault()
              if (dragCardId && !atLimit) {
                store.moveCard(dragCardId, col.id)
              }
              dragCardId = null
            },
          },
          [
            h(
              'div',
              {
                'data-iris-kanban-col-header': '',
                style: { display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 },
              },
              headerChildren,
            ),
            ...cardNodes,
          ],
        )
      })

      return h(
        'div',
        {
          'data-iris-kanban': '',
          class: props.class,
          style: {
            display: 'flex',
            gap: 'var(--iris-kanban-gap, 16px)',
            alignItems: 'flex-start',
            overflowX: 'auto',
            ...props.style,
          },
        },
        columnNodes,
      )
    }
  },
})
