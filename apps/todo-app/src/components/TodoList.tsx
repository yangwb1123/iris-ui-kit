/**
 * TodoList — the filtered list of todo items.
 *
 * When there are no filtered results it renders an IrisEmptyState;
 * otherwise it maps over items and renders a TodoItem for each.
 */

import { IrisEmptyState } from '@iris-ui-kit/react'
import { TodoItem } from './TodoItem'
import type { Todo } from '../types/todo'

export interface TodoListProps {
  /** The filtered (view-ready) todo items. */
  items: Todo[]
  /** The active filter name — used for contextual empty-state messages. */
  activeFilter: string
  onToggle: (id: string) => void
  onUpdate: (id: string, text: string) => void
  onDelete: (id: string) => void
}

const EMPTY_MESSAGES: Record<string, { title: string; description: string }> = {
  all: {
    title: 'No todos yet',
    description: 'Add a todo above to get started.',
  },
  active: {
    title: 'All done!',
    description: 'No active todos. Add more or switch to "All" to see completed items.',
  },
  completed: {
    title: 'No completed todos',
    description: 'Complete some todos to see them here.',
  },
}

export function TodoList({ items, activeFilter, onToggle, onUpdate, onDelete }: TodoListProps) {
  if (items.length === 0) {
    const msg = EMPTY_MESSAGES[activeFilter] ?? EMPTY_MESSAGES.all
    return (
      <IrisEmptyState
        title={msg.title}
        description={msg.description}
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            width="48"
            height="48"
            aria-hidden="true"
          >
            <path
              d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
              strokeLinecap="round"
            />
            <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
            <path d="M9 14l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
      />
    )
  }

  return (
    <div
      data-todo-list=""
      role="list"
      aria-label="Todo list"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}
    >
      {items.map((todo) => (
        <div key={todo.id} role="listitem">
          <TodoItem todo={todo} onToggle={onToggle} onUpdate={onUpdate} onDelete={onDelete} />
        </div>
      ))}
    </div>
  )
}
