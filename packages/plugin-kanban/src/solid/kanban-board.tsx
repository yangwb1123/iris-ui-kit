import { For, type Accessor, type JSX } from 'solid-js'
import type { KanbanState } from '../core'
import { KanbanColumnView } from './kanban-column'
import { KanbanDragController } from './kanban-drag'

export function KanbanBoard(props: {
  state: Accessor<KanbanState>
  drag: KanbanDragController
}): JSX.Element {
  return (
    <For each={props.state().columns}>
      {(column) => <KanbanColumnView column={column} state={props.state} drag={props.drag} />}
    </For>
  )
}
