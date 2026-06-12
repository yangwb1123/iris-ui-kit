import {
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  shallowRef,
  type PropType,
  type VNode,
} from 'vue'
import { createKanban, type KanbanConfig, type KanbanColumn, type KanbanCard } from '../core'

export type { KanbanCard, KanbanColumn, KanbanConfig, KanbanState, KanbanStore } from '../core'

/**
 * Render a Kanban board from a declarative config (Vue, render-function
 * authored to match the `@iris-ui/vue` convention). Cards are draggable via
 * native HTML5 DnD; dropping onto a column calls `store.moveCard`. WIP-limited
 * columns refuse drops when full. Themed via CSS vars.
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
    onMounted(() => {
      unsub = store.subscribe((s) => {
        kanbanState.value = s
      })
    })
    onUnmounted(() => unsub())

    // Track dragged card id without reactive overhead.
    let dragCardId: string | null = null

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
              style: { fontSize: '0.8em', color: 'var(--iris-color-muted, #6b7280)' },
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
                  background: 'var(--iris-color-warning, #f59e0b)',
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
                  style: { fontSize: '0.85em', color: 'var(--iris-color-muted, #6b7280)' },
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
                        background: 'var(--iris-color-primary-subtle, #eff6ff)',
                        color: 'var(--iris-color-primary, #2563eb)',
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
                border: '1px solid var(--iris-color-border, #e5e7eb)',
                borderRadius: '6px',
                padding: '8px 10px',
                cursor: 'grab',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              },
              onDragstart: (e: DragEvent) => {
                dragCardId = card.id
                if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
              },
              onDragend: () => {
                dragCardId = null
              },
            },
            cardChildren,
          )
        })

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
