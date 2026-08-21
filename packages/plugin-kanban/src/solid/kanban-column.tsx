import { For, Show, type Accessor, type JSX } from 'solid-js'
import { type KanbanCard as KanbanCardModel, type KanbanColumn, type KanbanState } from '../core'
import { KanbanDragController } from './kanban-drag'

interface KanbanColumnProps {
  column: KanbanColumn
  state: Accessor<KanbanState>
  drag: KanbanDragController
}

const columnStyle: JSX.CSSProperties = {
  width: 'var(--iris-kanban-col-width, 280px)',
  'flex-shrink': '0',
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
}

function KanbanColumnHeader(props: {
  column: KanbanColumn
  count: Accessor<number>
  atLimit: Accessor<boolean>
}): JSX.Element {
  return (
    <div
      data-iris-kanban-col-header=""
      style={{
        display: 'flex',
        'align-items': 'center',
        gap: 'var(--iris-space-xs, 8px)',
        'font-weight': '600',
      }}
    >
      <span>{props.column.title}</span>
      <span
        data-iris-kanban-count=""
        style={{ 'font-size': '0.8em', color: 'var(--iris-muted, #64748b)' }}
      >
        {props.column.limit !== undefined
          ? `${props.count()}/${props.column.limit}`
          : String(props.count())}
      </span>
      <Show when={props.atLimit()}>
        <span
          data-iris-kanban-wip-badge=""
          style={{
            'font-size': '0.7em',
            background: 'var(--iris-warning, #f59e0b)',
            color: 'var(--iris-warning-foreground, #451a03)',
            'border-radius': '4px',
            padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
          }}
        >
          WIP
        </span>
      </Show>
    </div>
  )
}

function KanbanCardView(props: { card: KanbanCardModel; drag: KanbanDragController }): JSX.Element {
  return (
    <div
      data-iris-kanban-card={props.card.id}
      draggable={true}
      style={{
        background: 'var(--iris-kanban-card-bg, var(--iris-surface, #f8fafc))',
        border: '1px solid var(--iris-border, #e2e8f0)',
        'border-radius': '6px',
        padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
        cursor: 'grab',
        display: 'flex',
        'flex-direction': 'column',
        gap: '4px',
        'touch-action': 'none',
      }}
      onDragStart={(event) => props.drag.onDragStart(props.card.id, event)}
      onDragEnd={props.drag.onDragEnd}
      onPointerDown={props.drag.onCardPointerDown(props.card.id)}
      onPointerMove={props.drag.onCardPointerMove(props.card.id)}
      onPointerUp={() => props.drag.onCardPointerUp(props.card.id)}
      onPointerCancel={props.drag.onCardPointerCancel}
    >
      <span data-iris-kanban-card-title="" style={{ 'font-weight': '500' }}>
        {props.card.title}
      </span>
      <Show when={props.card.description}>
        <span
          data-iris-kanban-card-desc=""
          style={{ 'font-size': '0.85em', color: 'var(--iris-muted, #64748b)' }}
        >
          {props.card.description}
        </span>
      </Show>
      <Show when={props.card.tags && props.card.tags.length > 0}>
        <div
          data-iris-kanban-card-tags=""
          style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '4px' }}
        >
          <For each={props.card.tags}>
            {(tag) => (
              <span
                data-iris-kanban-tag=""
                style={{
                  'font-size': '0.75em',
                  background: 'var(--iris-primary-subtle, #eff6ff)',
                  color: 'var(--iris-primary, #6366f1)',
                  'border-radius': '4px',
                  padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
                }}
              >
                {tag}
              </span>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

function KanbanCards(props: {
  cards: Accessor<readonly KanbanCardModel[]>
  drag: KanbanDragController
}): JSX.Element {
  return (
    <For each={props.cards()}>{(card) => <KanbanCardView card={card} drag={props.drag} />}</For>
  )
}

/** Render one reactive column while the parent owns board-level drag state. */
export function KanbanColumnView(props: KanbanColumnProps): JSX.Element {
  const liveColumn = () =>
    props.state().columns.find((column) => column.id === props.column.id) ?? props.column
  const atLimit = () => {
    const column = liveColumn()
    return column.limit !== undefined && column.cards.length >= column.limit
  }
  const cards = () => liveColumn().cards

  return (
    <div
      data-iris-kanban-column={props.column.id}
      style={{
        ...columnStyle,
        outline:
          props.drag.sortableState().activeId &&
          props.drag.sortableState().overId === props.column.id &&
          !atLimit()
            ? '2px solid var(--iris-primary, #6366f1)'
            : undefined,
        'outline-offset': '2px',
      }}
      onDragOver={(event) => {
        event.preventDefault()
        if (event.dataTransfer) event.dataTransfer.dropEffect = atLimit() ? 'none' : 'move'
      }}
      onDrop={(event) => props.drag.onDrop(event, props.column.id)}
    >
      <KanbanColumnHeader column={props.column} count={() => cards().length} atLimit={atLimit} />
      <KanbanCards cards={cards} drag={props.drag} />
    </div>
  )
}
