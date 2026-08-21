import { createSignal, onCleanup, type JSX } from 'solid-js'
import { createKanban, type KanbanConfig } from '../core'
import { KanbanBoard } from './kanban-board'
import { KanbanDragController } from './kanban-drag'

export type { KanbanCard, KanbanColumn, KanbanConfig, KanbanState, KanbanStore } from '../core'

export interface IrisKanbanProps {
  config: KanbanConfig
  class?: string
  style?: JSX.CSSProperties
}

/** Render a touch-capable, token-themed Kanban board from a declarative config. */
export function IrisKanban(props: IrisKanbanProps): JSX.Element {
  const store = createKanban(props.config)
  const [state, setState] = createSignal(store.getState())
  onCleanup(store.subscribe(setState))

  const drag = new KanbanDragController(store)
  onCleanup(drag.dispose)

  return (
    <div
      data-iris-kanban=""
      class={props.class}
      style={{
        display: 'flex',
        gap: 'var(--iris-kanban-gap, var(--iris-space-md, 16px))',
        'align-items': 'flex-start',
        'overflow-x': 'auto',
        ...props.style,
      }}
    >
      <KanbanBoard state={state} drag={drag} />
    </div>
  )
}
